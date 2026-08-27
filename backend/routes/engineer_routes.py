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


def _deduct_spare_parts(db: Session, service_team: str, parts: list[dict]) -> None:
    if not parts:
        return

    item_ids = [part["inventory_id"] for part in parts]
    items = (
        db.query(Inventory)
        .filter(Inventory.id.in_(item_ids), Inventory.service_team == service_team)
        .all()
    )
    items_by_id = {item.id: item for item in items}
    missing = [part["inventory_id"] for part in parts if part["inventory_id"] not in items_by_id]
    if missing:
        raise HTTPException(status_code=422, detail="One or more selected spare parts are not in this department's inventory.")

    insufficient = [
        items_by_id[part["inventory_id"]].item_name
        for part in parts
        if (items_by_id[part["inventory_id"]].current_stock or 0) < part["quantity"]
    ]
    if insufficient:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient stock for: {', '.join(insufficient)}.",
        )

    for part in parts:
        items_by_id[part["inventory_id"]].current_stock -= part["quantity"]


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
    ticket = _calls_for_team(db, current_user).filter(Request.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Maintenance call not found.")

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
        "issue": ticket.problem_category,
        "description": ticket.failure_description,
        "received": ticket.call_received_datetime.strftime("%d %b %Y %I:%M %p")
        if ticket.call_received_datetime
        else "",
        "notes": ticket.engineer_notes or "",
        "work_done": ticket.work_done or "",
        "spare_parts": _saved_spare_parts(ticket.spare_parts),
        "stock_deducted": ticket.stock_deducted,
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
                "received": call.call_received_datetime.strftime("%d %b %Y %I:%M %p")
                if call.call_received_datetime
                else "",
                "status": call.status,
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


@router.put("/ticket/{ticket_id}")
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _calls_for_team(db, current_user).filter(Request.id == ticket_id).first()
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
    if completing and not ticket.stock_deducted:
        _deduct_spare_parts(db, ticket.service_team, selected_parts)
        ticket.stock_deducted = True

    ticket.engineer_notes = payload.engineer_notes
    ticket.work_done = payload.work_done
    ticket.spare_parts = json.dumps(selected_parts)
    ticket.status = next_status

    if ticket.status == "In Progress" and ticket.engineer_start_datetime is None:
        ticket.engineer_start_datetime = datetime.now()
    if ticket.status in {"Completed", "Closed"} and ticket.fixed_datetime is None:
        ticket.fixed_datetime = datetime.now()
        if ticket.call_received_datetime:
            ticket.final_downtime_hours = round(
                (ticket.fixed_datetime - ticket.call_received_datetime).total_seconds() / 3600,
                2,
            )

    db.commit()
    db.refresh(ticket)
    return {"success": True, "message": "Ticket updated successfully.", "status": ticket.status}
