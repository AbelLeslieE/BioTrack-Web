"""Spreadsheet import helpers for BioTrack assets."""

from __future__ import annotations

import math

import pandas as pd
from sqlalchemy.exc import IntegrityError

from backend.models.asset import Asset


def _optional_text(value) -> str | None:
    """Return clean text while preserving a genuinely missing value as NULL."""
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    cleaned = str(value).strip()
    return cleaned or None


def _number(value) -> float:
    if value is None:
        return 0.0
    try:
        if pd.isna(value):
            return 0.0
    except (TypeError, ValueError):
        pass
    if isinstance(value, str):
        value = value.replace(",", "").strip()
    parsed = float(value or 0)
    return 0.0 if math.isnan(parsed) else parsed


def import_assets_from_excel(file, db, service_team="Biomedical"):
    imported = 0
    skipped = 0
    errors = 0

    try:
        # The hospital export's headings begin on row seven.
        dataframe = pd.read_excel(file, header=6)

        # These fields are unique across the complete asset register, not only
        # within one service team. Keeping the sets in memory also catches a
        # duplicate that occurs twice in the same spreadsheet.
        known_equipment_numbers = {
            cleaned
            for (value,) in db.query(Asset.equipment_no).filter(Asset.equipment_no.isnot(None)).all()
            if (cleaned := _optional_text(value))
        }
        known_serial_numbers = {
            cleaned
            for (value,) in db.query(Asset.serial_number).filter(Asset.serial_number.isnot(None)).all()
            if (cleaned := _optional_text(value))
        }

        for _, row in dataframe.iterrows():
            equipment_no = _optional_text(row.get("Equipment No"))
            if not equipment_no:
                continue

            serial_number = _optional_text(row.get("Manuf.SlNo"))
            if equipment_no in known_equipment_numbers or (
                serial_number and serial_number in known_serial_numbers
            ):
                skipped += 1
                continue

            try:
                asset = Asset(
                    asset_code=f"BT-{equipment_no}",
                    equipment_no=equipment_no,
                    equipment_name=_optional_text(row.get("Equipment")) or "Unnamed equipment",
                    classification=_optional_text(row.get("Classification")),
                    equipment_type=_optional_text(row.get("Eq Type")),
                    manufacturer=_optional_text(row.get("Manufacture")),
                    manufacturer_address=_optional_text(row.get("Manufacture Address")),
                    model=_optional_text(row.get("Model/Make")),
                    # PostgreSQL unique constraints permit multiple NULLs but
                    # reject repeated empty strings. Missing serials must stay
                    # NULL rather than being coerced to "".
                    serial_number=serial_number,
                    maintained_by=_optional_text(row.get("Maint.By")),
                    service_team=service_team,
                    purchase_value=_number(row.get("Value")),
                    tax_amount=_number(row.get("Tax Amount")),
                )
                db.add(asset)
                known_equipment_numbers.add(equipment_no)
                if serial_number:
                    known_serial_numbers.add(serial_number)
                imported += 1
            except (TypeError, ValueError):
                errors += 1

        db.commit()
        return {
            "success": True,
            "imported": imported,
            "skipped": skipped,
            "errors": errors,
        }
    except IntegrityError:
        db.rollback()
        return {
            "success": False,
            "message": (
                "The spreadsheet contains an asset code, equipment number or "
                "serial number that is already registered."
            ),
        }
    except Exception as exc:
        db.rollback()
        return {"success": False, "message": str(exc)}
