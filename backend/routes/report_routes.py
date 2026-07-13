# ==========================================
# IMPORTS
# ==========================================

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from backend.database import get_db
from backend.models import Request, Asset

# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"]
)

# ==========================================
# REPORT SUMMARY
# ==========================================

@router.get("/summary")
def report_summary(db: Session = Depends(get_db)):

    total_assets = db.query(Asset).count()

    active_assets = (
        db.query(Asset)
        .filter(Asset.status == "Active")
        .count()
    )

    maintenance_requests = db.query(Request).count()

    completed_requests = (
        db.query(Request)
        .filter(Request.status == "Completed")
        .count()
    )

    pending_requests = (
        db.query(Request)
        .filter(
            Request.status.in_(
                [
                    "Open",
                    "Pending",
                    "Assigned",
                    "In Progress"
                ]
            )
        )
        .count()
    )

    overdue_requests = (
        db.query(Request)
        .filter(Request.status == "Overdue")
        .count()
    )

    average_downtime = (
        db.query(
            func.avg(Request.final_downtime_hours)
        ).scalar()
    )

    if average_downtime is None:
        average_downtime = 0

    return {

        "total_assets": total_assets,

        "active_assets": active_assets,

        "maintenance_requests": maintenance_requests,

        "completed_requests": completed_requests,

        "pending_requests": pending_requests,

        "overdue_requests": overdue_requests,

        "average_downtime": round(
            average_downtime,
            2
        )

    }

# ==========================================
# MAINTENANCE TREND
# ==========================================

@router.get("/maintenance-trend")
def maintenance_trend(db: Session = Depends(get_db)):

    months = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"
    ]

    values = []

    for month in range(1,13):

        total = (

            db.query(Request)

            .filter(

                extract(
                    "month",
                    Request.call_received_datetime
                ) == month

            )

            .count()

        )

        values.append(total)

    return {

        "labels": months,

        "values": values

    }

# ==========================================
# STATUS SUMMARY
# ==========================================

@router.get("/status")
def report_status(db: Session = Depends(get_db)):

    completed = (

        db.query(Request)

        .filter(Request.status == "Completed")

        .count()

    )

    pending = (

        db.query(Request)

        .filter(

            Request.status.in_(

                [

                    "Open",

                    "Pending",

                    "Assigned",

                    "In Progress"

                ]

            )

        )

        .count()

    )

    overdue = (

        db.query(Request)

        .filter(Request.status == "Overdue")

        .count()

    )

    return {

        "labels":[

            "Completed",

            "Pending",

            "Overdue"

        ],

        "values":[

            completed,

            pending,

            overdue

        ]

    }
# ==========================================
# DEPARTMENT STATISTICS
# ==========================================

@router.get("/departments")
def report_departments(db: Session = Depends(get_db)):

    results = (

        db.query(

            Request.department,

            func.count(Request.id)

        )

        .group_by(Request.department)

        .all()

    )

    return {

        "labels":[

            row[0] if row[0] else "Unknown"

            for row in results

        ],

        "values":[

            row[1]

            for row in results

        ]

    }


# ==========================================
# CATEGORY STATISTICS
# ==========================================

@router.get("/categories")
def report_categories(db: Session = Depends(get_db)):

    results = (

        db.query(

            Request.problem_category,

            func.count(Request.id)

        )

        .group_by(Request.problem_category)

        .all()

    )

    return {

        "labels":[

            row[0] if row[0] else "Others"

            for row in results

        ],

        "values":[

            row[1]

            for row in results

        ]

    }


# ==========================================
# DOWNTIME TREND
# ==========================================

@router.get("/downtime")
def report_downtime(db: Session = Depends(get_db)):

    months = [

        "Jan","Feb","Mar","Apr","May","Jun",

        "Jul","Aug","Sep","Oct","Nov","Dec"

    ]

    values = []

    for month in range(1,13):

        avg = (

            db.query(

                func.avg(

                    Request.final_downtime_hours

                )

            )

            .filter(

                extract(

                    "month",

                    Request.call_received_datetime

                ) == month

            )

            .scalar()

        )

        values.append(

            round(avg or 0,2)

        )

    return {

        "labels":months,

        "values":values

    }
    # ==========================================
# REPORT TABLE
# ==========================================

@router.get("/table")
def report_table(db: Session = Depends(get_db)):

    requests = (

        db.query(Request)

        .order_by(

            Request.call_received_datetime.desc()

        )

        .limit(100)

        .all()

    )

    return [

        {

            "ticket": r.ticket_number,

            "equipment": r.equipment_name,

            "department": r.department,

            "priority": r.priority,

            "status": r.status,

            "reported_by": r.reported_by,

            "downtime": r.final_downtime_hours,

            "date": (

                r.call_received_datetime.strftime(

                    "%d-%m-%Y"

                )

                if r.call_received_datetime

                else ""

            )

        }

        for r in requests

    ]