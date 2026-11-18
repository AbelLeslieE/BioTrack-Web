from sqlalchemy.orm import Session

from backend.models.request import Request
from backend.models.ward_boy_task import WardBoyTask


ENGINEERING_DESTINATIONS = {
    "Biomedical": "Biomedical Engineering Workshop",
    "Electrical": "Electrical Engineering Workshop",
    "IT": "IT Service Desk",
}


def department_location(request: Request) -> str:
    values = [value.strip() for value in (request.department or "", request.location or "") if value and value.strip()]
    return " · ".join(values) or "Requesting department"


def engineering_destination(request: Request) -> str:
    return ENGINEERING_DESTINATIONS.get(
        request.service_team or "Biomedical",
        f"{request.service_team or 'Biomedical'} Engineering Workshop",
    )


def create_ward_boy_task(
    db: Session,
    request: Request,
    movement_type: str,
    requested_by_username: str,
    requested_by_name: str,
    requested_by_role: str,
    notes: str = "",
) -> WardBoyTask:
    if movement_type not in {"Pickup", "Return"}:
        raise ValueError("Movement type must be Pickup or Return.")

    existing = (
        db.query(WardBoyTask)
        .filter(
            WardBoyTask.request_id == request.id,
            WardBoyTask.movement_type == movement_type,
        )
        .first()
    )
    if existing:
        raise ValueError(f"A Ward Boy {movement_type.lower()} job already exists for this call.")

    ward_location = department_location(request)
    workshop = engineering_destination(request)
    source, destination = (ward_location, workshop) if movement_type == "Pickup" else (workshop, ward_location)
    task = WardBoyTask(
        request_id=request.id,
        movement_type=movement_type,
        status="Pending",
        source_location=source,
        destination_location=destination,
        notes=(notes or "").strip(),
        requested_by_username=requested_by_username,
        requested_by_name=requested_by_name,
        requested_by_role=requested_by_role,
    )
    db.add(task)
    return task


def serialize_ward_boy_task(task: WardBoyTask, request: Request) -> dict:
    return {
        "id": task.id,
        "request_id": task.request_id,
        "ticket": request.ticket_number,
        "equipment": request.equipment_name,
        "equipment_identifier": request.equipment_identifier,
        "department": request.department,
        "location": request.location,
        "service_team": request.service_team,
        "priority": request.priority,
        "movement_type": task.movement_type,
        "status": task.status,
        "source_location": task.source_location,
        "destination_location": task.destination_location,
        "notes": task.notes,
        "requested_by": task.requested_by_name,
        "requested_by_username": task.requested_by_username,
        "assigned_to": task.assigned_to_name,
        "assigned_to_username": task.assigned_to_username,
        "requested_at": task.requested_at.isoformat() if task.requested_at else None,
        "accepted_at": task.accepted_at.isoformat() if task.accepted_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }
