# ==========================================
# IMPORTS
# ==========================================

from datetime import date, timedelta

from sqlalchemy.orm import Session

from backend.models.pm_schedule import PMSchedule
from backend.models.pm_history import PMHistory
from backend.models.asset import Asset


# ==========================================
# PM STATUS CALCULATION
# ==========================================

def calculate_pm_status(schedule: PMSchedule):

    """
    Automatically calculate PM status.
    """

    # Already completed
    if schedule.completed_date:
        return "Completed"

    today = date.today()

    if today < schedule.scheduled_date:
        return "Upcoming"

    elif today == schedule.scheduled_date:
        return "Due"

    else:
        return "Overdue"


# ==========================================
# NEXT PM DATE
# ==========================================

def calculate_next_pm_date(asset: Asset, completed_on=None, frequency_days=None):

    """
    Generate the next PM date
    based on frequency.
    """

    frequency = frequency_days or asset.pm_frequency
    if not frequency:
        return None
    return (completed_on or date.today()) + timedelta(days=frequency)


# ==========================================
# UPDATE ALL PM STATUS
# ==========================================

def update_all_pm_status(db: Session):

    """
    Refresh status of every schedule.
    """

    schedules = db.query(PMSchedule).all()

    for schedule in schedules:

        schedule.status = calculate_pm_status(schedule)

    db.commit()


# ==========================================
# DASHBOARD COUNTS
# ==========================================

def get_dashboard_statistics(db: Session):

    """
    Returns dashboard KPIs.
    """

    update_all_pm_status(db)

    total = db.query(PMSchedule).count()

    upcoming = db.query(PMSchedule).filter(
        PMSchedule.status == "Upcoming"
    ).count()

    due = db.query(PMSchedule).filter(
        PMSchedule.status == "Due"
    ).count()

    overdue = db.query(PMSchedule).filter(
        PMSchedule.status == "Overdue"
    ).count()

    completed = db.query(PMSchedule).filter(
        PMSchedule.status == "Completed"
    ).count()

    return {

        "total": total,

        "upcoming": upcoming,

        "due": due,

        "overdue": overdue,

        "completed": completed

    }


# ==========================================
# COMPLETE PM
# ==========================================

def complete_pm(
    db: Session,
    schedule_id: int,
    engineer_name: str,
    remarks: str = "",
    engineer_id: int | None = None,
):

    """
    Complete Preventive Maintenance.
    """

    schedule = db.query(PMSchedule).filter(
        PMSchedule.id == schedule_id
    ).first()

    if not schedule:
        return None

    asset = db.query(Asset).filter(
        Asset.id == schedule.asset_id
    ).first()

    completed_on = date.today()
    status_before = schedule.status or "Due"
    schedule.completed_date = completed_on

    schedule.status = "Completed"

    history = PMHistory(

        asset_id=schedule.asset_id,

        pm_schedule_id=schedule.id,

        engineer_id=engineer_id,

        engineer_name=engineer_name,

        scheduled_date=schedule.scheduled_date,

        completed_date=completed_on,

        remarks=remarks,

        checklist_status="Completed",

        status_before=status_before,

        status_after="Completed"

    )

    db.add(history)

    next_pm_date = calculate_next_pm_date(
        asset,
        completed_on=completed_on,
        frequency_days=schedule.frequency_days,
    )
    if next_pm_date is None:
        db.rollback()
        return None

    asset.pm_frequency = schedule.frequency_days
    schedule.scheduled_date = next_pm_date

    schedule.completed_date = None

    schedule.status = "Upcoming"

    # The following PM cycle needs a new response from the department.
    schedule.department_response = "Pending"
    schedule.department_response_note = None
    schedule.department_response_at = None

    db.commit()

    return schedule


# ==========================================
# GET UPCOMING PM
# ==========================================

def get_upcoming_pm(db: Session):

    update_all_pm_status(db)

    return db.query(PMSchedule).filter(

        PMSchedule.status == "Upcoming"

    ).all()


# ==========================================
# GET DUE PM
# ==========================================

def get_due_pm(db: Session):

    update_all_pm_status(db)

    return db.query(PMSchedule).filter(

        PMSchedule.status == "Due"

    ).all()


# ==========================================
# GET OVERDUE PM
# ==========================================

def get_overdue_pm(db: Session):

    update_all_pm_status(db)

    return db.query(PMSchedule).filter(

        PMSchedule.status == "Overdue"

    ).all()
