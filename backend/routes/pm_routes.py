# ==========================================
# IMPORTS
# ==========================================
from backend.schemas.pm_schema import (
    PMScheduleCreate,
    PMScheduleUpdate,
    PMComplete,
    PMResponse,
    PMDepartmentResponse,
)
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db

from backend.models.pm_schedule import PMSchedule
from backend.models.asset import Asset
from backend.models.user import User
from backend.services.service_team import scope_to_team

from backend.services.pm_service import (
    complete_pm,
    get_dashboard_statistics,
    get_due_pm,
    get_overdue_pm,
    get_upcoming_pm,
    update_all_pm_status
)
from backend.auth import get_current_user, require_roles

# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/api/pm",
    tags=["Preventive Maintenance"],
    dependencies=[Depends(require_roles("Manager", "BME"))],
)

department_user_router = APIRouter(
    prefix="/api/user/pm-schedule",
    tags=["Department PM Schedule"],
)


def serialize_pm_schedule(schedule: PMSchedule) -> dict:
    asset = schedule.asset
    return {
        "id": schedule.id,
        "asset_id": schedule.asset_id,
        "asset_code": asset.asset_code if asset else "",
        "equipment_name": asset.equipment_name if asset else "Unknown equipment",
        "department": asset.department if asset else schedule.department,
        "location": asset.location if asset else schedule.location,
        "scheduled_date": schedule.scheduled_date,
        "completed_date": schedule.completed_date,
        "frequency_days": schedule.frequency_days,
        "status": schedule.status,
        "remarks": schedule.remarks or "",
        "department_response": schedule.department_response or "Pending",
        "department_response_note": schedule.department_response_note or "",
        "department_response_at": schedule.department_response_at,
    }


@department_user_router.get("", dependencies=[Depends(require_roles("User"))])
def get_department_pm_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Expose PM schedules only for assets assigned to the user's department."""
    if not current_user.department:
        return []

    update_all_pm_status(db)
    schedules = (
        db.query(PMSchedule)
        .join(Asset, PMSchedule.asset_id == Asset.id)
        .filter(Asset.department == current_user.department)
        .order_by(PMSchedule.scheduled_date.asc())
        .all()
    )
    return [serialize_pm_schedule(schedule) for schedule in schedules]


@department_user_router.post("/{schedule_id}/response", dependencies=[Depends(require_roles("User"))])
def respond_to_department_pm_schedule(
    schedule_id: int,
    payload: PMDepartmentResponse,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    response = payload.response.strip().title()
    if response not in {"Approved", "Denied"}:
        raise HTTPException(status_code=422, detail="Choose Approved or Denied.")

    schedule = (
        db.query(PMSchedule)
        .join(Asset, PMSchedule.asset_id == Asset.id)
        .filter(PMSchedule.id == schedule_id, Asset.department == current_user.department)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="PM schedule not found for your department.")
    if schedule.status == "Completed":
        raise HTTPException(status_code=409, detail="Completed PM schedules cannot be changed.")

    schedule.department_response = response
    schedule.department_response_note = (payload.note or "").strip()
    schedule.department_response_at = datetime.now()
    db.commit()
    db.refresh(schedule)
    return {"success": True, "schedule": serialize_pm_schedule(schedule)}


# ==========================================
# DASHBOARD
# ==========================================

@router.get("/form-data")
def pm_form_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return one consistent data set for the PM scheduling drawer."""
    assets = (
        scope_to_team(db.query(Asset), Asset, current_user)
        .filter(Asset.service_team == "Biomedical")
        .order_by(Asset.equipment_name.asc())
        .all()
    )
    departments = {
        value.strip()
        for value, in db.query(User.department)
        .filter(User.role == "User", User.department.is_not(None))
        .all()
        if value and value.strip()
    }
    departments.update(
        asset.department.strip()
        for asset in assets
        if asset.department and asset.department.strip()
    )
    engineers = (
        db.query(User)
        .filter(User.role == "BME")
        .order_by(User.name.asc(), User.username.asc())
        .all()
    )
    return {
        "departments": sorted(departments),
        "assets": [
            {
                "id": asset.id,
                "equipment_name": asset.equipment_name,
                "asset_code": asset.asset_code,
                "department": asset.department,
                "pm_frequency": asset.pm_frequency,
            }
            for asset in assets
        ],
        "engineers": [
            {
                "id": engineer.id,
                "name": engineer.name or engineer.username,
            }
            for engineer in engineers
        ],
    }

@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):

    return get_dashboard_statistics(db)


# ==========================================
# ALL PM
# ==========================================

@router.get("/all")
def all_pm(db: Session = Depends(get_db)):

    update_all_pm_status(db)

    schedules = db.query(PMSchedule).order_by(PMSchedule.scheduled_date.asc()).all()
    return [serialize_pm_schedule(schedule) for schedule in schedules]


# ==========================================
# UPCOMING PM
# ==========================================

@router.get("/upcoming")
def upcoming_pm(db: Session = Depends(get_db)):

    return get_upcoming_pm(db)


# ==========================================
# DUE PM
# ==========================================

@router.get("/due")
def due_pm(db: Session = Depends(get_db)):

    return get_due_pm(db)


# ==========================================
# OVERDUE PM
# ==========================================

@router.get("/overdue")
def overdue_pm(db: Session = Depends(get_db)):

    return get_overdue_pm(db)


# ==========================================
# SINGLE PM
# ==========================================

@router.get("/{schedule_id}")
def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db)
):

    schedule = db.query(PMSchedule).filter(
        PMSchedule.id == schedule_id
    ).first()

    if schedule is None:

        raise HTTPException(
            status_code=404,
            detail="PM Schedule not found"
        )

    return schedule


# ==========================================
# CREATE PM
# ==========================================

@router.post("/create")
def create_schedule(
    request: PMScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    department = request.department.strip()
    asset = (
        scope_to_team(db.query(Asset), Asset, current_user)
        .filter(Asset.id == request.asset_id, Asset.service_team == "Biomedical")
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Selected biomedical asset was not found.")
    if asset.department and asset.department.strip() != department:
        raise HTTPException(
            status_code=422,
            detail="This asset is assigned to a different department.",
        )
    engineer = db.get(User, request.engineer_id) if request.engineer_id else None
    if not engineer or engineer.role != "BME":
        raise HTTPException(status_code=422, detail="Select a biomedical engineer.")
    duplicate = (
        db.query(PMSchedule)
        .filter(
            PMSchedule.asset_id == asset.id,
            PMSchedule.scheduled_date == request.scheduled_date,
            PMSchedule.status != "Completed",
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="This asset already has a PM visit on that date.")

    # Scheduling an unassigned asset also assigns it to the selected department.
    if not asset.department:
        asset.department = department

    # The asset owns the recurring interval used to calculate its next PM visit
    # after the current visit is completed.
    asset.pm_frequency = request.frequency_days

    schedule = PMSchedule(

        asset_id=request.asset_id,

        frequency_days=request.frequency_days,

        scheduled_date=request.scheduled_date,

        engineer_id=request.engineer_id,

        remarks=request.remarks,

        department=department,

        location=asset.location

    )

    db.add(schedule)

    db.commit()

    db.refresh(schedule)

    return schedule

# ==========================================
# COMPLETE PM
# ==========================================

@router.post("/{schedule_id}/complete")
def complete_schedule(
    schedule_id: int,
    request: PMComplete,
    db: Session = Depends(get_db)
):

    result = complete_pm(

        db,

        schedule_id,

        request.engineer_name,

        request.remarks

    )

    if result is None:

        raise HTTPException(
            status_code=404,
            detail="PM Schedule not found"
        )

    return {
        "message": "PM Completed Successfully",
        "next_pm_date": result.scheduled_date
    }


# ==========================================
# DELETE PM
# ==========================================

@router.delete("/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db)
):

    schedule = db.query(PMSchedule).filter(

        PMSchedule.id == schedule_id

    ).first()

    if schedule is None:

        raise HTTPException(

            status_code=404,

            detail="PM Schedule not found"

        )

    db.delete(schedule)

    db.commit()

    return {

        "message": "PM Schedule Deleted"

    }
