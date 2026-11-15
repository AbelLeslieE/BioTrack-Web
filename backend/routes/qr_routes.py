"""Role-aware QR generation, lookup, and preventive-maintenance actions."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models.asset import Asset
from backend.models.pm_history import PMHistory
from backend.models.pm_schedule import PMSchedule
from backend.models.request import Request
from backend.models.user import User
from backend.services.pm_service import complete_pm
from backend.services.qr_service import generate_qr
from backend.services.service_team import scope_to_team


router = APIRouter(
    prefix="/api/qr",
    tags=["QR"],
    dependencies=[Depends(get_current_user)],
)


def _visible_asset(db: Session, current_user: User, asset_id: int) -> Asset:
    query = scope_to_team(db.query(Asset), Asset, current_user)
    if current_user.role == "User":
        if not current_user.department:
            raise HTTPException(status_code=404, detail="Asset not found for your department.")
        query = query.filter(Asset.department == current_user.department)
    asset = query.filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found for your portal.")
    return asset


def _maintenance_data(db: Session, asset: Asset) -> dict:
    histories = (
        db.query(PMHistory)
        .filter(PMHistory.asset_id == asset.id)
        .order_by(PMHistory.completed_date.desc(), PMHistory.id.desc())
        .all()
    )
    schedules = (
        db.query(PMSchedule)
        .filter(PMSchedule.asset_id == asset.id)
        .order_by(PMSchedule.scheduled_date.asc(), PMSchedule.id.asc())
        .all()
    )
    upcoming = next((item for item in schedules if item.status != "Completed"), None)

    identifiers = [
        value for value in (asset.asset_code, asset.equipment_no, asset.serial_number)
        if value
    ]
    repair_query = db.query(Request).filter(Request.equipment_identifier.in_(identifiers))
    repair_calls = repair_query.order_by(Request.call_received_datetime.desc()).all() if identifiers else []
    completed_repairs = [item for item in repair_calls if item.status in {"Completed", "Closed"}]

    return {
        "last_pm_date": histories[0].completed_date if histories else None,
        "next_pm_date": upcoming.scheduled_date if upcoming else None,
        "pm_status": upcoming.status if upcoming else "Not scheduled",
        "pm_frequency_days": upcoming.frequency_days if upcoming else asset.pm_frequency,
        "open_maintenance_calls": sum(item.status not in {"Completed", "Closed"} for item in repair_calls),
        "completed_repairs": len(completed_repairs),
        "last_repair_date": completed_repairs[0].fixed_datetime if completed_repairs else None,
        "pm_history": [
            {
                "completed_date": item.completed_date,
                "scheduled_date": item.scheduled_date,
                "engineer_name": item.engineer_name or "Engineering team",
                "remarks": item.remarks or "",
                "status": item.status_after or "Completed",
            }
            for item in histories[:10]
        ],
        "repairs": [
            {
                "ticket": item.ticket_number,
                "status": item.status,
                "priority": item.priority,
                "received": item.call_received_datetime,
                "completed": item.fixed_datetime,
                "work_done": item.work_done or "",
                "engineer_notes": item.engineer_notes or "",
                "downtime_hours": item.final_downtime_hours or 0,
            }
            for item in repair_calls[:10]
        ],
    }


def _asset_identity(asset: Asset) -> dict:
    return {
        "id": asset.id,
        "asset_code": asset.asset_code,
        "equipment_no": asset.equipment_no,
        "equipment_name": asset.equipment_name,
        "model": asset.model,
        "serial_number": asset.serial_number,
        "image_path": asset.image_path,
        "location": asset.location,
        "department": asset.department,
        "status": asset.status,
        "service_team": asset.service_team,
    }


def _same_department(current_user: User, asset: Asset) -> bool:
    user_department = (current_user.department or "").strip().casefold()
    asset_department = (asset.department or "").strip().casefold()
    return bool(user_department and asset_department and user_department == asset_department)


@router.post(
    "/generate/{asset_id}",
    dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))],
)
def generate_asset_qr(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = _visible_asset(db, current_user, asset_id)
    qr_path = generate_qr(asset.asset_code)
    asset.qr_generated = True
    asset.qr_code = qr_path
    db.commit()
    return {
        "success": True,
        "asset_id": asset.id,
        "asset_code": asset.asset_code,
        "equipment_name": asset.equipment_name,
        "qr_url": qr_path,
    }


@router.get("/lookup/{asset_code}")
def lookup_qr_asset(
    asset_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve a scanned QR without adding other departments to asset lists."""
    role = (current_user.role or "").casefold()
    if role == "user":
        query = db.query(Asset)
    elif role in {"manager", "bme", "electrical", "it"}:
        query = scope_to_team(db.query(Asset), Asset, current_user)
    else:
        raise HTTPException(status_code=403, detail="This role cannot scan equipment QR codes.")

    asset = query.filter(Asset.asset_code == asset_code).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found for your portal.")
    return {"success": True, "asset": {"id": asset.id}}


@router.get("/profile/{asset_id}")
def get_qr_asset_profile(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return only the scanned-asset fields and actions permitted for this role."""
    role = (current_user.role or "").casefold()
    if role == "user":
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found.")
    else:
        asset = _visible_asset(db, current_user, asset_id)
    maintenance = _maintenance_data(db, asset)
    identity = _asset_identity(asset)

    if role == "user":
        belongs_to_department = _same_department(current_user, asset)
        return {
            "view": "department",
            "asset": {
                key: identity[key]
                for key in (
                    "id", "asset_code", "equipment_no", "equipment_name", "model",
                    "serial_number", "image_path", "location", "department", "status",
                )
            },
            "maintenance": {"last_pm_date": maintenance["last_pm_date"]},
            "actions": {
                "can_start_maintenance_call": belongs_to_department,
                "can_complete_pm": False,
            },
            "access_notice": None if belongs_to_department else "This is not an asset of your department.",
            "ticket_defaults": {
                "department": current_user.department or asset.department or "",
                "location": asset.location or "",
                "equipment_identifier": asset.equipment_no or asset.asset_code,
                "equipment_name": asset.equipment_name,
                "make_model": " / ".join(value for value in (asset.manufacturer, asset.model) if value),
                "service_team": asset.service_team,
            } if belongs_to_department else None,
        }

    if role in {"bme", "electrical", "it"}:
        return {
            "view": "engineer",
            "asset": {
                **identity,
                "manufacturer": asset.manufacturer,
                "classification": asset.classification,
                "equipment_type": asset.equipment_type,
                "purchase_date": asset.purchase_date,
            },
            "maintenance": maintenance,
            "actions": {"can_start_maintenance_call": False, "can_complete_pm": True},
        }

    if role == "manager":
        return {
            "view": "admin",
            "asset": {
                **identity,
                "classification": asset.classification,
                "equipment_type": asset.equipment_type,
                "manufacturer": asset.manufacturer,
                "manufacturer_address": asset.manufacturer_address,
                "manufacturing_year": asset.manufacturing_year,
                "maintained_by": asset.maintained_by,
                "supplier": asset.supplier,
                "purchase_value": asset.purchase_value,
                "tax_amount": asset.tax_amount,
                "net_value": asset.net_value,
                "purchase_date": asset.purchase_date,
                "installation_date": asset.installation_date,
                "warranty": asset.warranty,
                "pm_frequency": asset.pm_frequency,
                "calibration_required": asset.calibration_required,
                "remarks": asset.remarks,
                "qr_generated": asset.qr_generated,
                "qr_code": asset.qr_code,
                "created_at": asset.created_at,
                "updated_at": asset.updated_at,
            },
            "maintenance": maintenance,
            "actions": {"can_start_maintenance_call": False, "can_complete_pm": False},
        }

    raise HTTPException(status_code=403, detail="This role cannot open QR asset profiles.")


@router.post(
    "/profile/{asset_id}/complete-pm",
    dependencies=[Depends(require_roles("BME", "Electrical", "IT"))],
)
def complete_qr_preventive_maintenance(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record an engineer-confirmed PM visit and roll the schedule forward."""
    asset = _visible_asset(db, current_user, asset_id)
    schedule = (
        db.query(PMSchedule)
        .filter(PMSchedule.asset_id == asset.id, PMSchedule.status != "Completed")
        .order_by(PMSchedule.scheduled_date.asc(), PMSchedule.id.asc())
        .first()
    )

    if not schedule:
        if not asset.pm_frequency:
            raise HTTPException(
                status_code=409,
                detail="Set a PM frequency on this asset before completing preventive maintenance.",
            )
        schedule = PMSchedule(
            asset_id=asset.id,
            department=asset.department,
            location=asset.location,
            engineer_id=current_user.id,
            scheduled_date=date.today(),
            frequency_days=asset.pm_frequency,
            status="Due",
        )
        db.add(schedule)
        db.flush()

    result = complete_pm(
        db,
        schedule.id,
        current_user.name or current_user.username,
        remarks="Completed from the equipment QR profile.",
        engineer_id=current_user.id,
    )
    if result is None:
        raise HTTPException(status_code=409, detail="The PM schedule could not be completed.")

    return {
        "success": True,
        "message": "Preventive maintenance completed successfully.",
        "last_pm_date": date.today(),
        "next_pm_date": result.scheduled_date,
    }
