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
from backend.models.asset import Asset
from backend.models.inventory import Inventory
from backend.models.pm_schedule import PMSchedule
from backend.auth import get_current_user, require_roles

from datetime import date, datetime

# ==========================================
# ROUTER
# ==========================================

router = APIRouter(dependencies=[Depends(get_current_user)])


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




@router.get(
    "/api/dashboard/v2",
    dependencies=[Depends(require_roles("Manager"))],
)
def dashboard_v2(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Executive dashboard data for every engineering service team."""
    del current_user  # The role check above grants access; data is hospital-wide.
    team_definitions = (
        ("Biomedical", "BME"),
        ("Electrical", "Electrical"),
        ("IT", "IT"),
    )
    active_statuses = {"Open", "Assigned", "In Progress", "Awaiting Parts"}
    completed_statuses = {"Completed", "Closed"}

    def normalized_team(value: str | None) -> str:
        value = (value or "Biomedical").strip().lower()
        if value in {"it", "information technology"}:
            return "IT"
        if value == "electrical":
            return "Electrical"
        return "Biomedical"

    requests = db.query(Request).order_by(Request.id.desc()).all()
    assets = db.query(Asset).all()
    inventory_items = db.query(Inventory).all()
    today = date.today()

    team_activity = []
    for team, role in team_definitions:
        team_requests = [item for item in requests if normalized_team(item.service_team) == team]
        team_assets = [item for item in assets if normalized_team(item.service_team) == team]
        team_inventory = [item for item in inventory_items if normalized_team(item.service_team) == team]
        completed_today = sum(
            item.status in completed_statuses
            and item.fixed_datetime is not None
            and item.fixed_datetime.date() == today
            for item in team_requests
        )
        low_stock = sum(
            (item.current_stock or 0) <= (item.minimum_stock or 0)
            for item in team_inventory
        )
        team_activity.append({
            "team": team,
            "active_calls": sum(item.status in active_statuses for item in team_requests),
            "open_calls": sum(item.status in {"Open", "Assigned"} for item in team_requests),
            "in_progress": sum(item.status == "In Progress" for item in team_requests),
            "awaiting_parts": sum(item.status == "Awaiting Parts" for item in team_requests),
            "completed_today": completed_today,
            "critical_calls": sum(
                item.status in active_statuses and (item.priority or "").lower() == "critical"
                for item in team_requests
            ),
            "assets": len(team_assets),
            "out_of_service_assets": sum(
                (item.status or "").lower() in {"out of service", "inactive"}
                for item in team_assets
            ),
            "inventory_items": len(team_inventory),
            "low_stock": low_stock,
            "engineers": db.query(User).filter(User.role == role).count(),
        })

    completed_requests = [
        item for item in requests
        if item.status in completed_statuses and (item.final_downtime_hours or 0) > 0
    ]
    recent_activity = []
    for item in sorted(
        requests,
        key=lambda request: request.fixed_datetime or request.engineer_start_datetime or request.call_received_datetime or datetime.min,
        reverse=True,
    )[:10]:
        occurred_at = item.fixed_datetime or item.engineer_start_datetime or item.call_received_datetime
        recent_activity.append({
            "ticket_number": item.ticket_number or f"Call #{item.id}",
            "equipment_name": item.equipment_name or item.equipment_identifier or "Maintenance call",
            "department": item.department or "Not specified",
            "team": normalized_team(item.service_team),
            "priority": item.priority or "Normal",
            "status": item.status or "Open",
            "occurred_at": occurred_at.isoformat() if occurred_at else None,
        })

    active_calls = sum(item["active_calls"] for item in team_activity)
    critical_calls = sum(item["critical_calls"] for item in team_activity)
    inventory_alerts = sum(item["low_stock"] for item in team_activity)
    return {
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "active_calls": active_calls,
            "critical_calls": critical_calls,
            "completed_today": sum(item["completed_today"] for item in team_activity),
            "total_assets": len(assets),
            "inventory_alerts": inventory_alerts,
            "engineers": sum(item["engineers"] for item in team_activity),
            "pm_due": db.query(PMSchedule).filter(PMSchedule.status.in_(["Due", "Overdue"])).count(),
            "avg_downtime": round(
                sum(item.final_downtime_hours or 0 for item in completed_requests) / len(completed_requests),
                2,
            ) if completed_requests else 0,
        },
        "teams": team_activity,
        "recent_activity": recent_activity,
    }

# ==========================================
# EDIT REQUEST
# ==========================================

@router.put(
    "/api/requests/{ticket}/edit",
    dependencies=[Depends(require_roles("Manager", "BME"))],
)
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
 
