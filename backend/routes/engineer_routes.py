import json
from collections import defaultdict
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Query, Session

from backend.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models.asset import Asset
from backend.models.inventory import Inventory
from backend.models.request import Request
from backend.models.user import User
from backend.models.ward_boy_task import WardBoyTask
from backend.services.ward_boy_service import serialize_ward_boy_task


ENGINEER_ROLES = ("Manager", "BME", "Electrical", "IT")
VALID_STATUSES = {
    "Open",
    "Assigned",
    "In Progress",
    "Awaiting Parts",
    "External Service",
    "Calibration",
    "Completed",
    "Closed",
}

router = APIRouter(
    prefix="/api/engineer",
    tags=["Engineering"],
    dependencies=[Depends(require_roles(*ENGINEER_ROLES))],
)


def _service_team_for(current_user: User) -> str | None:
    """Managers can see every call; each engineering role sees its own discipline."""
    if current_user.role == "BME":
        return "Biomedical"
    if current_user.role == "Electrical":
        return "Electrical"
    if current_user.role == "IT":
        return "IT"
    return None


def _calls_for_team(db: Session, current_user: User) -> Query:
    calls = db.query(Request)
    service_team = _service_team_for(current_user)
    if service_team:
        calls = calls.filter(Request.service_team == service_team)
    return calls


def _saved_spare_parts(value: str | None) -> list[dict]:
    """Read structured parts from new tickets while tolerating legacy free text."""
    try:
        parts = json.loads(value or "[]")
        return parts if isinstance(parts, list) else []
    except (TypeError, json.JSONDecodeError):
        return []


def _normalise_spare_parts(parts: list["SparePartUse"]) -> list[dict]:
    quantities: dict[int, int] = defaultdict(int)
    for part in parts:
        quantities[part.inventory_id] += part.quantity
    return [
        {"inventory_id": inventory_id, "quantity": quantity}
        for inventory_id, quantity in sorted(quantities.items())
    ]


def _inventory_items_for_parts(db: Session, service_team: str, *part_lists: list[dict]) -> dict[int, Inventory]:
    item_ids = sorted({part["inventory_id"] for parts in part_lists for part in parts})
    if not item_ids:
        return {}
    items = (
        db.query(Inventory)
        .filter(Inventory.id.in_(item_ids), Inventory.service_team == service_team)
        .order_by(Inventory.id.asc())
        .with_for_update()
        .all()
    )
    items_by_id = {item.id: item for item in items}
    missing = [item_id for item_id in item_ids if item_id not in items_by_id]
    if missing:
        raise HTTPException(status_code=422, detail="One or more selected spare parts are not in this department's inventory.")
    return items_by_id


def _part_quantity_map(parts: list[dict]) -> dict[int, int]:
    return {part["inventory_id"]: part["quantity"] for part in parts}


def _sync_spare_part_reservations(
    db: Session,
    ticket: Request,
    selected_parts: list[dict],
    saved_parts: list[dict],
) -> dict[int, Inventory]:
    old_parts = saved_parts if ticket.parts_reserved else []
    items_by_id = _inventory_items_for_parts(db, ticket.service_team, selected_parts, old_parts)
    old_quantities = _part_quantity_map(old_parts)
    new_quantities = _part_quantity_map(selected_parts)

    insufficient = []
    for inventory_id, new_quantity in new_quantities.items():
        item = items_by_id[inventory_id]
        available_for_ticket = (
            (item.current_stock or 0)
            - (item.reserved_stock or 0)
            + old_quantities.get(inventory_id, 0)
        )
        if new_quantity > available_for_ticket:
            insufficient.append(item.item_name)

    if insufficient:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient unreserved stock for: {', '.join(insufficient)}.",
        )

    for inventory_id in set(old_quantities) | set(new_quantities):
        item = items_by_id[inventory_id]
        item.reserved_stock = max(
            0,
            (item.reserved_stock or 0)
            - old_quantities.get(inventory_id, 0)
            + new_quantities.get(inventory_id, 0),
        )
    ticket.parts_reserved = bool(selected_parts)
    return items_by_id


def _consume_reserved_parts(ticket: Request, parts: list[dict], items_by_id: dict[int, Inventory]) -> None:
    for part in parts:
        item = items_by_id[part["inventory_id"]]
        quantity = part["quantity"]
        if (item.current_stock or 0) < quantity:
            raise HTTPException(status_code=422, detail=f"Insufficient stock for: {item.item_name}.")
        item.current_stock = (item.current_stock or 0) - quantity
        item.reserved_stock = max(0, (item.reserved_stock or 0) - quantity)
    ticket.parts_reserved = False
    ticket.stock_deducted = True


def _parts_cost(parts: list[dict], items_by_id: dict[int, Inventory]) -> float:
    return round(sum(
        (items_by_id[part["inventory_id"]].purchase_price or 0) * part["quantity"]
        for part in parts
    ), 2)


@router.get("/dashboard")
def engineer_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    calls = _calls_for_team(db, current_user).order_by(Request.call_received_datetime.desc()).all()
    active_statuses = {"Open", "Assigned", "In Progress", "Awaiting Parts"}
    completed_today = sum(
        1
        for call in calls
        if call.status in {"Completed", "Closed"}
        and call.fixed_datetime
        and call.fixed_datetime.date() == date.today()
    )
    service_team = _service_team_for(current_user)

    return {
        "service_team": service_team or "All",
        "assigned_calls": sum(call.status in active_statuses for call in calls),
        "in_progress": sum(call.status == "In Progress" for call in calls),
        "critical_calls": sum(call.priority == "Critical" for call in calls),
        "completed_today": completed_today,
        "online_equipment": db.query(Asset).filter(Asset.status == "Active").count(),
        "offline_equipment": db.query(Asset).filter(Asset.status == "Out of Service").count(),
        "pm_due_today": sum(
            call.problem_category == "Preventive Maintenance" and call.status in active_statuses
            for call in calls
        ),
        "assigned": [
            {
                "id": call.id,
                "ticket": call.ticket_number,
                "equipment": call.equipment_name,
                "equipment_id": call.equipment_identifier,
                "department": call.department,
                "location": call.location,
                "reported_by": call.reported_by,
                "issue": call.problem_category,
                "description": call.failure_description,
                "priority": call.priority,
                "status": call.status,
                "assigned_to_username": call.assigned_to_username or "",
                "assigned_to_name": call.assigned_to_name or "",
                "reported_time": call.call_received_datetime.strftime("%d %b %Y %I:%M %p")
                if call.call_received_datetime
                else "",
            }
            for call in calls
            if call.status in active_statuses
        ][:10],
        "activity": [
            {
                "title": f"{call.ticket_number} · {call.status}",
                "time": call.call_received_datetime.strftime("%d %b %Y %I:%M %p")
                if call.call_received_datetime
                else "",
            }
            for call in calls[:5]
        ],
    }


@router.get("/ticket/{ticket_id}")
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = (
        _calls_for_team(db, current_user)
        .filter(Request.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Maintenance call not found.")

    ward_boy_tasks = (
        db.query(WardBoyTask)
        .filter(WardBoyTask.request_id == ticket.id)
        .order_by(WardBoyTask.requested_at.asc())
        .all()
    )

    return {
        "id": ticket.id,
        "ticket": ticket.ticket_number,
        "service_team": ticket.service_team,
        "equipment": ticket.equipment_name,
        "equipment_id": ticket.equipment_identifier,
        "department": ticket.department,
        "location": ticket.location,
        "reported_by": ticket.reported_by,
        "priority": ticket.priority,
        "status": ticket.status,
        "assigned_to_username": ticket.assigned_to_username or "",
        "assigned_to_name": ticket.assigned_to_name or "",
        "issue": ticket.problem_category,
        "description": ticket.failure_description,
        "received": ticket.call_received_datetime.strftime("%d %b %Y %I:%M %p")
        if ticket.call_received_datetime
        else "",
        "notes": ticket.engineer_notes or "",
        "work_done": ticket.work_done or "",
        "downtime": ticket.final_downtime_hours or 0,
        "spare_parts": _saved_spare_parts(ticket.spare_parts),
        "stock_deducted": ticket.stock_deducted,
        "parts_reserved": ticket.parts_reserved,
        "parts_cost": ticket.parts_cost or 0,
        "ward_boy_tasks": [serialize_ward_boy_task(task, ticket) for task in ward_boy_tasks],
    }


@router.get("/maintenance")
def get_maintenance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    calls = _calls_for_team(db, current_user).order_by(Request.call_received_datetime.desc()).all()
    return {
        "total_calls": len(calls),
        "inprogress": sum(call.status == "In Progress" for call in calls),
        "completed": sum(call.status in {"Completed", "Closed"} for call in calls),
        "downtime": round(sum(call.final_downtime_hours or 0 for call in calls), 2),
        "calls": [
            {
                "id": call.id,
                "ticket": call.ticket_number,
                "service_team": call.service_team,
                "equipment": call.equipment_name,
                "department": call.department,
                "location": call.location,
                "received": call.call_received_datetime.strftime("%d %b %Y %I:%M %p")
                if call.call_received_datetime
                else "",
                "status": call.status,
                "assigned_to_username": call.assigned_to_username or "",
                "assigned_to_name": call.assigned_to_name or "",
                "priority": call.priority,
                "downtime": call.final_downtime_hours or 0,
                "issue": call.problem_category,
                "description": call.failure_description,
            }
            for call in calls
        ],
    }


class SparePartUse(BaseModel):
    inventory_id: int
    quantity: int = Field(gt=0)


class TicketUpdate(BaseModel):
    status: str
    engineer_notes: str = ""
    work_done: str = ""
    spare_parts: list[SparePartUse] = Field(default_factory=list)
    start_work: bool = False
    complete_work: bool = False


class AssignmentUpdate(BaseModel):
    username: str | None = None


@router.get("/technicians")
def list_technicians(
    service_team: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enforced_team = _service_team_for(current_user)
    selected_team = enforced_team or service_team
    role_for_team = {"Biomedical": "BME", "Electrical": "Electrical", "IT": "IT"}.get(selected_team)
    query = db.query(User).filter(User.role.in_(("BME", "Electrical", "IT")))
    if role_for_team:
        query = query.filter(User.role == role_for_team)
    return [
        {"username": user.username, "name": user.name or user.username, "service_team": _service_team_for(user)}
        for user in query.order_by(User.name.asc()).all()
    ]


@router.patch("/ticket/{ticket_id}/assignment")
def assign_ticket(
    ticket_id: int,
    payload: AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = (
        _calls_for_team(db, current_user)
        .filter(Request.id == ticket_id)
        .with_for_update()
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Maintenance call not found.")

    if payload.username:
        technician = db.query(User).filter(User.username == payload.username).first()
        if not technician or _service_team_for(technician) != ticket.service_team:
            raise HTTPException(status_code=422, detail="Select a technician from this engineering department.")
        ticket.assigned_to_username = technician.username
        ticket.assigned_to_name = technician.name or technician.username
        if ticket.status == "Open":
            ticket.status = "Assigned"
    else:
        ticket.assigned_to_username = None
        ticket.assigned_to_name = None
        if ticket.status == "Assigned":
            ticket.status = "Open"
    db.commit()
    return {
        "success": True,
        "status": ticket.status,
        "assigned_to_username": ticket.assigned_to_username or "",
        "assigned_to_name": ticket.assigned_to_name or "",
    }


@router.put("/ticket/{ticket_id}")
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = (
        _calls_for_team(db, current_user)
        .filter(Request.id == ticket_id)
        .with_for_update()
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Maintenance call not found.")
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid maintenance status.")

    selected_parts = _normalise_spare_parts(payload.spare_parts)
    saved_parts = _saved_spare_parts(ticket.spare_parts)
    next_status = "In Progress" if payload.start_work else "Completed" if payload.complete_work else payload.status
    completing = next_status in {"Completed", "Closed"}

    if ticket.stock_deducted and selected_parts != saved_parts:
        raise HTTPException(
            status_code=409,
            detail="Spare parts cannot be changed after stock has been deducted.",
        )
    if not ticket.stock_deducted:
        items_by_id = _sync_spare_part_reservations(
            db,
            ticket,
            selected_parts,
            saved_parts,
        )
        ticket.parts_cost = _parts_cost(selected_parts, items_by_id)
        if completing:
            _consume_reserved_parts(ticket, selected_parts, items_by_id)

    ticket.engineer_notes = payload.engineer_notes
    ticket.work_done = payload.work_done
    ticket.spare_parts = json.dumps(selected_parts)
    ticket.status = next_status

    if payload.start_work and not ticket.assigned_to_username and current_user.role != "Manager":
        ticket.assigned_to_username = current_user.username
        ticket.assigned_to_name = current_user.name or current_user.username

    if ticket.status == "In Progress" and ticket.engineer_start_datetime is None:
        ticket.engineer_start_datetime = datetime.now()
    if ticket.status in {"Completed", "Closed"} and ticket.fixed_datetime is None:
        ticket.fixed_datetime = datetime.now()
        if ticket.call_received_datetime:
            ticket.calculated_downtime_hours = round(
                (ticket.fixed_datetime - ticket.call_received_datetime).total_seconds() / 3600,
                2,
            )
            if ticket.manual_downtime_hours is None:
                ticket.final_downtime_hours = ticket.calculated_downtime_hours

    db.commit()
    db.refresh(ticket)
    return {"success": True, "message": "Ticket updated successfully.", "status": ticket.status}
