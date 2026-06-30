# ==========================================
# IMPORTS
# ==========================================

import pandas as pd

from backend.models.asset import Asset


# ==========================================
# IMPORT ASSETS FROM EXCEL
# ==========================================

def import_assets_from_excel(file, db):

    imported = 0
    skipped = 0
    errors = 0

    try:

        # Hospital export starts from row 7
        dataframe = pd.read_excel(
            file,
            header=6
        )

        dataframe = dataframe.fillna("")

        for _, row in dataframe.iterrows():

            equipment_no = str(
                row.get("Equipment No", "")
            ).strip()

            # Skip empty equipment numbers
            if equipment_no == "":

                continue

            # Skip duplicates
            existing = (
                db.query(Asset)
                .filter(
                    Asset.equipment_no == equipment_no
                )
                .first()
            )

            if existing:

                skipped += 1
                continue

            try:

                asset = Asset(

                asset_code=f"BT-{equipment_no}",

                equipment_no=equipment_no,

                equipment_name=str(
                    row.get("Equipment", "")
                ),

                classification=str(
                    row.get("Classification", "")
                ),

                equipment_type=str(
                    row.get("Eq Type", "")
                ),

                manufacturer=str(
                    row.get("Manufacture", "")
                ),

                manufacturer_address=str(
                    row.get("Manufacture Address", "")
                ),

                model=str(
                    row.get("Model/Make", "")
                ),

                serial_number=str(
                    row.get("Manuf.SlNo", "")
                ),

                maintained_by=str(
                    row.get("Maint.By", "")
                ),

                purchase_value=float(
                    row.get("Value", 0) or 0
                ),

                tax_amount=float(
                    row.get("Tax Amount", 0) or 0
                )

            )

                db.add(asset)

                imported += 1

            except Exception:

                errors += 1

        db.commit()

        return {

            "success": True,

            "imported": imported,

            "skipped": skipped,

            "errors": errors

        }

    except Exception as e:

        return {

            "success": False,

            "message": str(e)

        }