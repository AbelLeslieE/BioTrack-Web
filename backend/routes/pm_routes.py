# ==========================================
# IMPORTS
# ==========================================
from backend.schemas.pm_schema import (
    PMScheduleCreate,
    PMScheduleUpdate,
    PMComplete,
    PMResponse
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db

from backend.models.pm_schedule import PMSchedule

from backend.services.pm_service import (
    complete_pm,
    get_dashboard_statistics,
    get_due_pm,
    get_overdue_pm,
    get_upcoming_pm,
    update_all_pm_status
)

# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/api/pm",
    tags=["Preventive Maintenance"]
)


# ==========================================
# DASHBOARD
# ==========================================

@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):

    return get_dashboard_statistics(db)


# ==========================================
# ALL PM
# ==========================================

@router.get("/all")
def all_pm(db: Session = Depends(get_db)):

    update_all_pm_status(db)

    return db.query(PMSchedule).all()


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
@router.post("/create")
def create_schedule(
    request: PMScheduleCreate,
    db: Session = Depends(get_db)
):

    schedule = PMSchedule(

        asset_id=request.asset_id,

        frequency_days=request.frequency_days,

        scheduled_date=request.scheduled_date,

        engineer_id=request.engineer_id,

        remarks=request.remarks

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