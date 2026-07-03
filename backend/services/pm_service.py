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

def calculate_next_pm_date(asset: Asset):

    """
    Generate the next PM date
    based on frequency.
    """

    if asset.pm_frequency is None:
        return None

    start_date = asset.last_pm_date

    if start_date is None:
        start_date = date.today()

    return start_date + timedelta(
        days=asset.pm_frequency
    )


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
    remarks: str = ""
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

    schedule.completed_date = date.today()

    schedule.status = "Completed"

    history = PMHistory(

        asset_id=schedule.asset_id,

        pm_schedule_id=schedule.id,

        engineer_name=engineer_name,

        scheduled_date=schedule.scheduled_date,

        completed_date=date.today(),

        remarks=remarks,

        checklist_status="Completed",

        status_before="Due",

        status_after="Completed"

    )

    db.add(history)

    asset.last_pm_date = date.today()

    asset.next_pm_date = calculate_next_pm_date(asset)

    schedule.scheduled_date = asset.next_pm_date

    schedule.completed_date = None

    schedule.status = "Upcoming"

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