# ==========================================
# IMPORTS
# ==========================================

from fastapi import APIRouter, HTTPException
from sqlalchemy import func
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
from backend.models.ward_boy_task import WardBoyTask
from backend.auth import get_current_user, require_roles

from datetime import date, datetime, timedelta

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

    today = date.today()
    now = datetime.now()
    tomorrow = today + timedelta(days=1)

    def team_filter(column, team: str):
        normalized = func.lower(func.trim(func.coalesce(column, "Biomedical")))
        if team == "IT":
            return normalized.in_(("it", "information technology"))
        if team == "Electrical":
            return normalized == "electrical"
        return normalized.notin_(("electrical", "it", "information technology"))

    team_activity = []
    for team, role in team_definitions:
        request_scope = db.query(Request).filter(team_filter(Request.service_team, team))
        asset_scope = db.query(Asset).filter(team_filter(Asset.service_team, team))
        inventory_scope = db.query(Inventory).filter(team_filter(Inventory.service_team, team))
        active_calls = request_scope.filter(Request.status.in_(active_statuses)).count()
        open_calls = request_scope.filter(Request.status.in_(("Open", "Assigned"))).count()
        in_progress = request_scope.filter(Request.status == "In Progress").count()
        awaiting_parts = request_scope.filter(Request.status == "Awaiting Parts").count()
        completed_today = request_scope.filter(
            Request.status.in_(completed_statuses),
            Request.fixed_datetime >= datetime.combine(today, datetime.min.time()),
            Request.fixed_datetime < datetime.combine(tomorrow, datetime.min.time()),
        ).count()
        critical_calls = request_scope.filter(
            Request.status.in_(active_statuses),
            func.lower(func.coalesce(Request.priority, "")) == "critical",
        ).count()
        asset_count = asset_scope.count()
        out_of_service = asset_scope.filter(
            func.lower(func.coalesce(Asset.status, "")).in_(("out of service", "inactive"))
        ).count()
        inventory_count = inventory_scope.count()
        low_stock = inventory_scope.filter(
            func.coalesce(Inventory.current_stock, 0)
            <= func.coalesce(Inventory.minimum_stock, 0)
        ).count()
        team_activity.append({
            "team": team,
            "active_calls": active_calls,
            "open_calls": open_calls,
            "in_progress": in_progress,
            "awaiting_parts": awaiting_parts,
            "completed_today": completed_today,
            "critical_calls": critical_calls,
            "assets": asset_count,
            "out_of_service_assets": out_of_service,
            "inventory_items": inventory_count,
            "low_stock": low_stock,
            "engineers": db.query(User).filter(User.role == role).count(),
        })

    recent_requests = (
        db.query(Request)
        .order_by(
            func.coalesce(
                Request.fixed_datetime,
                Request.engineer_start_datetime,
                Request.call_received_datetime,
            ).desc(),
            Request.id.desc(),
        )
        .limit(10)
        .all()
    )
    recent_activity = []
    for item in recent_requests:
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
    active_received_times = (
        db.query(Request.call_received_datetime)
        .filter(
            Request.status.in_(active_statuses),
            Request.call_received_datetime.is_not(None),
        )
        .all()
    )
    active_downtime_values = [
        max((now - received_at).total_seconds() / 3600, 0)
        for (received_at,) in active_received_times
    ]
    inventory_count = db.query(Inventory).count()
    out_of_stock = db.query(Inventory).filter(
        func.coalesce(Inventory.current_stock, 0) <= 0
    ).count()
    inventory_value = db.query(
        func.coalesce(func.sum(
            func.coalesce(Inventory.current_stock, 0)
            * func.coalesce(Inventory.purchase_price, 0)
        ), 0)
    ).scalar()
    asset_count = db.query(Asset).count()
    out_of_service_assets = db.query(Asset).filter(
        func.lower(func.coalesce(Asset.status, "")).in_(("out of service", "inactive"))
    ).count()
    pm_due = db.query(PMSchedule).filter(PMSchedule.status.in_(("Due", "Overdue"))).count()
    pm_overdue = db.query(PMSchedule).filter(PMSchedule.status == "Overdue").count()
    pm_pending_confirmation = db.query(PMSchedule).filter(
        func.coalesce(PMSchedule.department_response, "Pending") == "Pending",
        func.coalesce(PMSchedule.status, "").notin_(("Completed", "Closed")),
    ).count()
    average_downtime = db.query(func.avg(Request.final_downtime_hours)).filter(
        Request.status.in_(completed_statuses),
        Request.final_downtime_hours > 0,
    ).scalar()
    stock_health_percent = round(
        ((inventory_count - inventory_alerts) / inventory_count) * 100
    ) if inventory_count else 100
    asset_availability_percent = round(
        ((asset_count - out_of_service_assets) / asset_count) * 100
    ) if asset_count else 100
    return {
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "active_calls": active_calls,
            "critical_calls": critical_calls,
            "completed_today": sum(item["completed_today"] for item in team_activity),
            "total_assets": asset_count,
            "inventory_alerts": inventory_alerts,
            "inventory_items": inventory_count,
            "out_of_stock": out_of_stock,
            "stock_health_percent": stock_health_percent,
            "inventory_value": round(float(inventory_value or 0), 2),
            "engineers": sum(item["engineers"] for item in team_activity),
            "pm_due": pm_due,
            "pm_overdue": pm_overdue,
            "pm_pending_confirmation": pm_pending_confirmation,
            "open_calls": sum(item["open_calls"] for item in team_activity),
            "in_progress": sum(item["in_progress"] for item in team_activity),
            "awaiting_parts": sum(item["awaiting_parts"] for item in team_activity),
            "out_of_service_assets": out_of_service_assets,
            "asset_availability_percent": asset_availability_percent,
            "active_downtime_hours": round(sum(active_downtime_values), 1),
            "oldest_active_call_hours": round(max(active_downtime_values), 1) if active_downtime_values else 0,
            "avg_downtime": round(float(average_downtime or 0), 2),
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

    if role == "wardboy":
        ward_tasks = (
            db.query(WardBoyTask)
            .filter(
                (WardBoyTask.status == "Pending")
                | (
                    (WardBoyTask.assigned_to_username == current_user.username)
                    & (WardBoyTask.status == "Accepted")
                )
            )
            .order_by(WardBoyTask.requested_at.desc())
            .limit(20)
            .all()
        )
        request_ids = [task.request_id for task in ward_tasks]
        requests_by_id = {
            request.id: request
            for request in db.query(Request).filter(Request.id.in_(request_ids or [-1])).all()
        }
        for task in ward_tasks:
            request = requests_by_id.get(task.request_id)
            if not request:
                continue
            add_item(
                f"ward-boy:{task.id}:{task.status}",
                "ward-boy",
                f"{task.movement_type} · {request.ticket_number or f'Call #{request.id}'}",
                f"{request.equipment_name or 'Equipment'}: {task.source_location} → {task.destination_location}.",
                "wardBoyDashboard",
                "critical" if (request.priority or "").lower() == "critical" else "warning",
                task.accepted_at or task.requested_at,
            )
    elif role == "user":
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

        request_ids = [request.id for request in requests]
        transport_tasks = (
            db.query(WardBoyTask)
            .filter(WardBoyTask.request_id.in_(request_ids or [-1]))
            .order_by(WardBoyTask.requested_at.desc())
            .limit(8)
            .all()
        )
        requests_by_id = {request.id: request for request in requests}
        for task in transport_tasks:
            request = requests_by_id.get(task.request_id)
            if not request:
                continue
            add_item(
                f"ward-boy:{task.id}:{task.status}",
                "ward-boy",
                f"Ward Boy {task.movement_type.lower()} · {task.status}",
                f"{request.equipment_name or 'Equipment'} transport is {task.status.lower()}.",
                "myRequests",
                "warning" if task.status == "Pending" else "info",
                task.completed_at or task.accepted_at or task.requested_at,
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

        transport_query = db.query(WardBoyTask).join(Request, WardBoyTask.request_id == Request.id)
        if service_team:
            transport_query = transport_query.filter(Request.service_team == service_team)
        for task in transport_query.order_by(WardBoyTask.requested_at.desc()).limit(6).all():
            request = db.get(Request, task.request_id)
            if not request:
                continue
            add_item(
                f"ward-boy:{task.id}:{task.status}",
                "ward-boy",
                f"Transport {task.movement_type.lower()} · {task.status}",
                f"{request.equipment_name or 'Equipment'}: {task.source_location} → {task.destination_location}.",
                "callManagement",
                "warning" if task.status == "Pending" else "info",
                task.completed_at or task.accepted_at or task.requested_at,
            )

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
 
