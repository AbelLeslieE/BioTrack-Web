# ==========================================
# IMPORTS
# ==========================================

from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from fastapi import Depends

from backend.database import get_db
from backend.models.request import Request
from backend.models.device import Device
from backend.models.user import User
from backend.models.asset import Asset
from backend.models.inventory import Inventory
from backend.models.pm_schedule import PMSchedule
from backend.models.asset_relocation_request import AssetRelocationRequest
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
    pm_schedules = db.query(PMSchedule).all()
    today = date.today()
    now = datetime.now()

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
    active_requests = [item for item in requests if item.status in active_statuses]
    active_downtime_values = [
        max((now - item.call_received_datetime).total_seconds() / 3600, 0)
        for item in active_requests
        if item.call_received_datetime is not None
    ]
    out_of_stock = sum((item.current_stock or 0) <= 0 for item in inventory_items)
    out_of_service_assets = sum(
        (item.status or "").lower() in {"out of service", "inactive"}
        for item in assets
    )
    pm_due = sum((item.status or "") in {"Due", "Overdue"} for item in pm_schedules)
    pm_overdue = sum((item.status or "") == "Overdue" for item in pm_schedules)
    pm_pending_confirmation = sum(
        (item.department_response or "Pending") == "Pending"
        and (item.status or "") not in {"Completed", "Closed"}
        for item in pm_schedules
    )
    stock_health_percent = round(
        ((len(inventory_items) - inventory_alerts) / len(inventory_items)) * 100
    ) if inventory_items else 100
    asset_availability_percent = round(
        ((len(assets) - out_of_service_assets) / len(assets)) * 100
    ) if assets else 100
    return {
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "active_calls": active_calls,
            "critical_calls": critical_calls,
            "completed_today": sum(item["completed_today"] for item in team_activity),
            "total_assets": len(assets),
            "inventory_alerts": inventory_alerts,
            "inventory_items": len(inventory_items),
            "out_of_stock": out_of_stock,
            "stock_health_percent": stock_health_percent,
            "inventory_value": round(sum(
                (item.current_stock or 0) * (item.purchase_price or 0)
                for item in inventory_items
            ), 2),
            "engineers": sum(item["engineers"] for item in team_activity),
            "pm_due": pm_due,
            "pm_overdue": pm_overdue,
            "pm_pending_confirmation": pm_pending_confirmation,
            "open_calls": sum(item.status in {"Open", "Assigned"} for item in requests),
            "in_progress": sum(item.status == "In Progress" for item in requests),
            "awaiting_parts": sum(item.status == "Awaiting Parts" for item in requests),
            "out_of_service_assets": out_of_service_assets,
            "asset_availability_percent": asset_availability_percent,
            "active_downtime_hours": round(sum(active_downtime_values), 1),
            "oldest_active_call_hours": round(max(active_downtime_values), 1) if active_downtime_values else 0,
            "avg_downtime": round(
                sum(item.final_downtime_hours or 0 for item in completed_requests) / len(completed_requests),
                2,
            ) if completed_requests else 0,
        },
        "teams": team_activity,
        "recent_activity": recent_activity,
    }


@router.get("/api/notifications")
def notification_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a role-aware feed used by the in-app and browser notification center."""
    role = (current_user.role or "").strip().lower()
    active_statuses = {"Open", "Assigned", "In Progress", "Awaiting Parts"}
    items: list[dict] = []

    def add_item(
        notification_id: str,
        kind: str,
        title: str,
        message: str,
        page: str,
        priority: str,
        created_at,
    ) -> None:
        if isinstance(created_at, date) and not isinstance(created_at, datetime):
            created_at = datetime.combine(created_at, datetime.min.time())
        items.append({
            "id": notification_id,
            "kind": kind,
            "title": title,
            "message": message,
            "page": page,
            "priority": priority,
            "created_at": created_at.isoformat() if created_at else datetime.now().isoformat(),
        })

    if role == "user":
        requests = (
            db.query(Request)
            .filter(Request.created_by == current_user.username)
            .order_by(Request.id.desc())
            .limit(10)
            .all()
        )
        for request in requests:
            priority = "critical" if (request.priority or "").lower() == "critical" else "info"
            add_item(
                f"request:{request.id}:{request.status}",
                "request",
                f"{request.ticket_number or 'Maintenance request'} · {request.status or 'Open'}",
                f"{request.equipment_name or 'Equipment'} in {request.department or current_user.department or 'your department'}.",
                "myRequests",
                priority,
                request.fixed_datetime or request.engineer_start_datetime or request.call_received_datetime,
            )

        relocation_requests = (
            db.query(AssetRelocationRequest)
            .filter(AssetRelocationRequest.requested_by == current_user.username)
            .order_by(AssetRelocationRequest.id.desc())
            .limit(8)
            .all()
        )
        for relocation in relocation_requests:
            asset = db.get(Asset, relocation.asset_id)
            add_item(
                f"relocation:{relocation.id}:{relocation.status}",
                "relocation",
                f"Relocation request · {relocation.status}",
                f"{asset.equipment_name if asset else 'Asset'} to {relocation.target_department}{f' · {relocation.target_location}' if relocation.target_location else ''}.",
                "myAssets",
                "warning" if relocation.status == "Pending" else "info",
                relocation.reviewed_at or relocation.created_at,
            )

        if current_user.department:
            schedules = (
                db.query(PMSchedule)
                .filter(PMSchedule.department == current_user.department)
                .order_by(PMSchedule.scheduled_date.asc())
                .all()
            )
            for schedule in schedules:
                if (schedule.status or "") not in {"Due", "Overdue"} and (schedule.department_response or "Pending") != "Pending":
                    continue
                asset_name = schedule.asset.equipment_name if schedule.asset else "Department equipment"
                add_item(
                    f"pm:{schedule.id}:{schedule.status}:{schedule.department_response}",
                    "maintenance",
                    f"PM visit {str(schedule.status or 'scheduled').lower()}",
                    f"{asset_name} is scheduled for {schedule.scheduled_date.strftime('%d %b %Y')}.",
                    "departmentPMSchedule",
                    "critical" if schedule.status == "Overdue" else "warning",
                    schedule.updated_at or schedule.scheduled_date,
                )
    else:
        service_team = {
            "bme": "Biomedical",
            "electrical": "Electrical",
            "it": "IT",
        }.get(role)

        request_query = db.query(Request)
        inventory_query = db.query(Inventory)
        asset_query = db.query(Asset)
        if service_team:
            request_query = request_query.filter(Request.service_team == service_team)
            inventory_query = inventory_query.filter(Inventory.service_team == service_team)
            asset_query = asset_query.filter(Asset.service_team == service_team)

        relocation_query = db.query(AssetRelocationRequest).filter(AssetRelocationRequest.status == "Pending")
        if service_team:
            relocation_query = relocation_query.filter(AssetRelocationRequest.service_team == service_team)
        for relocation in relocation_query.order_by(AssetRelocationRequest.id.desc()).limit(8).all():
            asset = db.get(Asset, relocation.asset_id)
            add_item(
                f"relocation:{relocation.id}:pending",
                "relocation",
                "Asset relocation approval needed",
                f"{asset.equipment_name if asset else 'Asset'}: {relocation.from_department or 'Unassigned'} → {relocation.target_department}.",
                "assets",
                "warning",
                relocation.created_at,
            )

        critical_requests = (
            request_query
            .filter(Request.status.in_(active_statuses), Request.priority == "Critical")
            .order_by(Request.id.desc())
            .limit(8)
            .all()
        )
        for request in critical_requests:
            add_item(
                f"critical-call:{request.id}:{request.status}",
                "critical-call",
                f"Critical call · {request.ticket_number or f'#{request.id}'}",
                f"{request.equipment_name or 'Equipment'} is {str(request.status or 'open').lower()} in {request.department or 'an unassigned department'}.",
                "callManagement",
                "critical",
                request.engineer_start_datetime or request.call_received_datetime,
            )

        low_stock_items = (
            inventory_query
            .filter(Inventory.current_stock <= Inventory.minimum_stock)
            .order_by(Inventory.current_stock.asc(), Inventory.id.desc())
            .limit(8)
            .all()
        )
        for stock in low_stock_items:
            current_stock = stock.current_stock or 0
            add_item(
                f"stock:{stock.id}:{current_stock}",
                "stock",
                "Out of stock" if current_stock <= 0 else "Low stock alert",
                f"{stock.item_name} has {current_stock} {stock.unit or 'units'} remaining (minimum {stock.minimum_stock or 0}).",
                "inventory",
                "critical" if current_stock <= 0 else "warning",
                stock.updated_at or stock.created_at,
            )

        unavailable_assets = (
            asset_query
            .filter(Asset.status.in_(("Out of Service", "Inactive")))
            .order_by(Asset.updated_at.desc(), Asset.id.desc())
            .limit(5)
            .all()
        )
        for asset in unavailable_assets:
            add_item(
                f"asset:{asset.id}:{asset.status}",
                "asset",
                f"Asset {str(asset.status or 'unavailable').lower()}",
                f"{asset.equipment_name} ({asset.asset_code}) is unavailable in {asset.department or 'the hospital'}.",
                "assets",
                "warning",
                asset.updated_at or asset.created_at,
            )

        if role in {"manager", "admin", "bme"}:
            pm_query = db.query(PMSchedule).filter(PMSchedule.status.in_(("Due", "Overdue")))
            if service_team:
                biomedical_asset_ids = db.query(Asset.id).filter(Asset.service_team == service_team)
                pm_query = pm_query.filter(PMSchedule.asset_id.in_(biomedical_asset_ids))
            for schedule in pm_query.order_by(PMSchedule.scheduled_date.asc()).limit(8).all():
                asset_name = schedule.asset.equipment_name if schedule.asset else "Equipment"
                add_item(
                    f"pm:{schedule.id}:{schedule.status}",
                    "maintenance",
                    f"Preventive maintenance {str(schedule.status or 'due').lower()}",
                    f"{asset_name} was scheduled for {schedule.scheduled_date.strftime('%d %b %Y')}.",
                    "pm",
                    "critical" if schedule.status == "Overdue" else "warning",
                    schedule.updated_at or schedule.scheduled_date,
                )

    priority_order = {"critical": 0, "warning": 1, "info": 2}
    items.sort(
        key=lambda item: (
            priority_order.get(item["priority"], 3),
            item["created_at"],
        )
    )
    return {
        "generated_at": datetime.now().isoformat(),
        "items": items[:25],
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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

        if "downtime" in data:
            if current_user.role.casefold() != "manager":
                raise HTTPException(status_code=403, detail="Only administrators can change downtime.")
            request.manual_downtime_hours = round(float(data["downtime"]), 2)
            request.final_downtime_hours = request.manual_downtime_hours

        db.commit()

        return {
            "success": True
        }

    except Exception as error:

        return {
            "success": False,
            "message": str(error)
        }   
 
