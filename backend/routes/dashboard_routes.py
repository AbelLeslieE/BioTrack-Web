# ==========================================
# IMPORTS
# ==========================================

from fastapi import APIRouter
from sqlalchemy.orm import Session
from fastapi import Depends

from backend.database import get_db
from backend.models.request import Request
from backend.models.device import Device
from backend.models.user import User

from datetime import date

# ==========================================
# ROUTER
# ==========================================

router = APIRouter()


# ==========================================
# KPI DATA
# ==========================================

@router.get("/api/dashboard")

def dashboard_data(
    db: Session = Depends(get_db)
):

    requests = (
    db.query(Request)
    .order_by(Request.id.desc())
    .all()
)

    open_calls = len([
        r for r in requests
        if r.status == "Open"
    ])

    in_progress = len([
        r for r in requests
        if r.status == "In Progress"
    ])

    awaiting_parts = len([
        r for r in requests
        if r.status == "Awaiting Parts"
    ])

    closed_today = len([
        r for r in requests
        if (
            r.status == "Closed"
            and
            r.fixed_datetime
            and
            r.fixed_datetime.date()
            == date.today()
        )
    ])

    closed_requests = [
        r for r in requests
        if r.final_downtime_hours
    ]

    avg_downtime = 0

    if closed_requests:

        avg_downtime = round(

            sum(
                r.final_downtime_hours
                for r in closed_requests
            )
            /
            len(closed_requests),

            2
        )

    recent_logs = []

    for r in requests[:10]:

        recent_logs.append({

            "ticket":
                r.ticket_number,

            "equipment":
                r.equipment_name,

            "department":
                r.department,

            "priority":
                r.priority,

            "status":
                r.status,

            "call_received":
                str(r.call_received_datetime)
                if r.call_received_datetime
                else None,

            "engineer_start":
                str(r.engineer_start_datetime)
                if r.engineer_start_datetime
                else None,

            "fixed_time":
                str(r.fixed_datetime)
                if r.fixed_datetime
                else None,

            "downtime":
                r.final_downtime_hours
        })

    return {

        "open_calls":
            open_calls,

        "closed_calls":
            len([
                r for r in requests
                if r.status == "Closed"
            ]),

        "today_calls":
            len([
                r for r in requests
                if (
                    r.call_received_datetime
                    and
                    r.call_received_datetime.date()
                    == date.today()
                )
            ]),

        "avg_downtime":
            avg_downtime,

        "recent_logs":
            recent_logs
    }
# ==========================================
# DASHBOARD V2
# ==========================================




@router.get("/api/dashboard/v2")
def dashboard_v2(
    db: Session = Depends(get_db)
):

    total_assets = db.query(Device).count()

    open_calls = db.query(Request).filter(
        Request.status == "Open"
    ).count()

    working_calls = db.query(Request).filter(
        Request.status == "In Progress"
    ).count()

    awaiting_parts = db.query(Request).filter(
        Request.status == "Awaiting Parts"
    ).count()

    completed_today = (
        db.query(Request)
        .filter(
            Request.status == "Closed",
            Request.fixed_datetime.isnot(None)
        )
        .all()
    )

    completed_today = len([
        r for r in completed_today
        if r.fixed_datetime.date() == date.today()
    ])
    today_calls = db.query(Request).filter(
       Request.call_received_datetime.isnot(None)
    ).all()

    today_calls = len([
        r for r in today_calls
        if r.call_received_datetime.date() == date.today()
    ])

    engineers_online = (
        db.query(User)
        .filter(User.role == "BME")
        .count()
    )

    pm_due = (
        db.query(Request)
        .filter(
            Request.problem_category == "Preventive Maintenance"
        )
        .count()
    )

    critical_requests = (
        db.query(Request)
        .filter(
            Request.priority == "Critical"
        )
        .count()
    )
    out_of_service = db.query(Request).filter(
        Request.status == "Out of Service"
    ).count()
    closed_requests = db.query(Request).filter(
    Request.final_downtime_hours > 0
    ).all()

    avg_downtime = 0

    if closed_requests:

        avg_downtime = round(
            
            sum(r.final_downtime_hours for r in closed_requests)

            / len(closed_requests),
            
            2

        )

    return {
        

    # Maintenance
    "open_calls": open_calls,
    "working_calls": working_calls,
    "awaiting_parts": awaiting_parts,
    "completed_today": completed_today,
    "today_calls": today_calls,
    "avg_downtime": avg_downtime,
    "engineers_online": engineers_online,
    "out_of_service": out_of_service,
    # Assets
    "total_assets": total_assets,
    "pm_due": pm_due,
    "critical_requests": critical_requests
    
}

# ==========================================
# EDIT REQUEST
# ==========================================

@router.put("/api/requests/{ticket}/edit")
def edit_request(
    ticket: str,
    data: dict,
    db: Session = Depends(get_db)
):

    request = (
        db.query(Request)
        .filter(
            Request.ticket_number == ticket
        )
        .first()
    )

    if not request:

        return {
            "success": False,
            "message": "Request not found"
        }

    from datetime import datetime

    try:

        if data.get("call_received"):

            request.call_received_datetime = (
                datetime.strptime(
                    data["call_received"],
                    "%d-%m-%Y %I:%M %p"
                )
            )

        if data.get("engineer_start"):

            request.engineer_start_datetime = (
                datetime.strptime(
                    data["engineer_start"],
                    "%d-%m-%Y %I:%M %p"
                )
            )

        if data.get("fixed_time"):

            request.fixed_datetime = (
                datetime.strptime(
                    data["fixed_time"],
                    "%d-%m-%Y %I:%M %p"
                )
            )

        request.final_downtime_hours = (
            data.get(
                "downtime",
                request.final_downtime_hours
            )
        )

        db.commit()

        return {
            "success": True
        }

    except Exception as error:

        return {
            "success": False,
            "message": str(error)
        }   
 