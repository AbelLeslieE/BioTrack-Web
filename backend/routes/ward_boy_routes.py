from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models.request import Request
from backend.models.user import User
from backend.models.ward_boy_task import WardBoyTask
from backend.models.central_store import SparePartRequest, StoreDeliveryTask
from backend.services.ward_boy_service import create_ward_boy_task, serialize_ward_boy_task


router = APIRouter(prefix="/api/ward-boy", tags=["Ward Boy"])


class WardBoyTaskCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    request_id: int = Field(gt=0)
    movement_type: Literal["Pickup", "Return"]
    notes: str = Field(default="", max_length=500)


def _request_for_task(db: Session, request_id: int) -> Request:
    request = db.get(Request, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Maintenance call not found.")
    return request


def _spare_request_for_task(db: Session, request_id: int) -> SparePartRequest:
    request = db.get(SparePartRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Central Store request not found.")
    return request


def _serialize_store_delivery(task: StoreDeliveryTask, request: SparePartRequest) -> dict:
    return {
        "id": task.id,
        "task_kind": "store",
        "request_id": request.id,
        "ticket": request.request_number,
        "equipment": request.requested_item_name,
        "equipment_identifier": f"{request.quantity} {request.unit or 'pieces'}",
        "department": request.service_team,
        "location": request.delivery_location,
        "service_team": request.service_team,
        "priority": request.priority,
        "movement_type": "Spare Delivery",
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


def _ensure_request_access(request: Request, current_user: User, movement_type: str) -> None:
    if current_user.role == "Manager":
        return
    if current_user.role == "User":
        if movement_type != "Pickup" or request.created_by != current_user.username:
            raise HTTPException(status_code=403, detail="You can only request pickup for your own maintenance calls.")
        return

    expected_team = {"BME": "Biomedical", "Electrical": "Electrical", "IT": "IT"}.get(current_user.role)
    if expected_team != request.service_team:
        raise HTTPException(status_code=403, detail="This maintenance call belongs to another engineering team.")


@router.get("/dashboard")
def ward_boy_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("WardBoy", "Manager")),
):
    query = db.query(WardBoyTask)
    if current_user.role == "WardBoy":
        query = query.filter(
            or_(
                WardBoyTask.status == "Pending",
                and_(
                    WardBoyTask.assigned_to_username == current_user.username,
                    WardBoyTask.status.in_(("Accepted", "Completed")),
                ),
            )
        )
    tasks = query.order_by(WardBoyTask.requested_at.desc()).limit(100).all()
    requests = {
        request.id: request
        for request in db.query(Request).filter(Request.id.in_([task.request_id for task in tasks] or [-1])).all()
    }
    visible_tasks = [task for task in tasks if task.request_id in requests]

    store_query = db.query(StoreDeliveryTask)
    if current_user.role == "WardBoy":
        store_query = store_query.filter(
            or_(
                StoreDeliveryTask.status == "Pending",
                and_(
                    StoreDeliveryTask.assigned_to_username == current_user.username,
                    StoreDeliveryTask.status.in_(("Accepted", "Completed")),
                ),
            )
        )
    store_tasks = store_query.order_by(StoreDeliveryTask.requested_at.desc()).limit(100).all()
    spare_requests = {
        request.id: request
        for request in db.query(SparePartRequest).filter(
            SparePartRequest.id.in_([task.spare_request_id for task in store_tasks] or [-1])
        ).all()
    }
    visible_store_tasks = [task for task in store_tasks if task.spare_request_id in spare_requests]
    today = date.today()
    all_tasks = [
        serialize_ward_boy_task(task, requests[task.request_id]) | {"task_kind": "equipment"}
        for task in visible_tasks
    ] + [
        _serialize_store_delivery(task, spare_requests[task.spare_request_id])
        for task in visible_store_tasks
    ]
    all_tasks.sort(key=lambda item: item.get("requested_at") or "", reverse=True)
    return {
        "summary": {
            "pending": sum(task.status == "Pending" for task in visible_tasks)
            + sum(task.status == "Pending" for task in visible_store_tasks),
            "my_active": sum(
                task.status == "Accepted" and task.assigned_to_username == current_user.username
                for task in visible_tasks
            ) + sum(
                task.status == "Accepted" and task.assigned_to_username == current_user.username
                for task in visible_store_tasks
            ),
            "completed_today": sum(
                task.status == "Completed" and task.completed_at and task.completed_at.date() == today
                for task in visible_tasks
            ) + sum(
                task.status == "Completed" and task.completed_at and task.completed_at.date() == today
                for task in visible_store_tasks
            ),
        },
        "tasks": all_tasks,
    }


@router.post("/tasks", dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT", "User"))])
def request_ward_boy(
    payload: WardBoyTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = _request_for_task(db, payload.request_id)
    _ensure_request_access(request, current_user, payload.movement_type)
    if payload.movement_type == "Return" and request.status not in {"Completed", "Closed"}:
        raise HTTPException(status_code=422, detail="Complete the repair before requesting return transport.")
    try:
        task = create_ward_boy_task(
            db,
            request,
            payload.movement_type,
            current_user.username,
            current_user.name or current_user.username,
            current_user.role,
            payload.notes,
        )
        db.commit()
        db.refresh(task)
    except (ValueError, IntegrityError) as error:
        db.rollback()
        detail = str(error) if isinstance(error, ValueError) else f"A Ward Boy {payload.movement_type.lower()} job already exists for this call."
        raise HTTPException(status_code=409, detail=detail) from error
    return {"success": True, "task": serialize_ward_boy_task(task, request)}


@router.patch("/tasks/{task_id}/accept")
def accept_ward_boy_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("WardBoy")),
):
    task = db.get(WardBoyTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Transport job not found.")
    if task.status == "Accepted" and task.assigned_to_username == current_user.username:
        request = _request_for_task(db, task.request_id)
        return {"success": True, "task": serialize_ward_boy_task(task, request)}
    accepted_at = datetime.now()
    updated = (
        db.query(WardBoyTask)
        .filter(WardBoyTask.id == task_id, WardBoyTask.status == "Pending")
        .update(
            {
                WardBoyTask.status: "Accepted",
                WardBoyTask.assigned_to_username: current_user.username,
                WardBoyTask.assigned_to_name: current_user.name or current_user.username,
                WardBoyTask.accepted_at: accepted_at,
            },
            synchronize_session=False,
        )
    )
    if not updated:
        db.rollback()
        raise HTTPException(status_code=409, detail="This transport job has already been taken.")
    db.commit()
    task = db.get(WardBoyTask, task_id)
    db.refresh(task)
    request = _request_for_task(db, task.request_id)
    return {"success": True, "task": serialize_ward_boy_task(task, request)}


@router.patch("/tasks/{task_id}/complete")
def complete_ward_boy_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("WardBoy")),
):
    task = db.get(WardBoyTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Transport job not found.")
    if task.status != "Accepted" or task.assigned_to_username != current_user.username:
        raise HTTPException(status_code=409, detail="Accept this transport job before completing it.")
    task.status = "Completed"
    task.completed_at = datetime.now()
    db.commit()
    db.refresh(task)
    request = _request_for_task(db, task.request_id)
    return {"success": True, "task": serialize_ward_boy_task(task, request)}


@router.patch("/store-tasks/{task_id}/accept")
def accept_store_delivery_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("WardBoy")),
):
    task = db.get(StoreDeliveryTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Spare delivery job not found.")
    if task.status == "Accepted" and task.assigned_to_username == current_user.username:
        request = _spare_request_for_task(db, task.spare_request_id)
        return {"success": True, "task": _serialize_store_delivery(task, request)}
    accepted_at = datetime.now()
    updated = (
        db.query(StoreDeliveryTask)
        .filter(StoreDeliveryTask.id == task_id, StoreDeliveryTask.status == "Pending")
        .update(
            {
                StoreDeliveryTask.status: "Accepted",
                StoreDeliveryTask.assigned_to_username: current_user.username,
                StoreDeliveryTask.assigned_to_name: current_user.name or current_user.username,
                StoreDeliveryTask.accepted_at: accepted_at,
            },
            synchronize_session=False,
        )
    )
    if not updated:
        db.rollback()
        raise HTTPException(status_code=409, detail="This spare delivery has already been taken.")
    db.commit()
    task = db.get(StoreDeliveryTask, task_id)
    request = _spare_request_for_task(db, task.spare_request_id)
    return {"success": True, "task": _serialize_store_delivery(task, request)}


@router.patch("/store-tasks/{task_id}/complete")
def complete_store_delivery_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("WardBoy")),
):
    task = db.get(StoreDeliveryTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Spare delivery job not found.")
    if task.status != "Accepted" or task.assigned_to_username != current_user.username:
        raise HTTPException(status_code=409, detail="Accept this spare delivery before completing it.")
    request = _spare_request_for_task(db, task.spare_request_id)
    now = datetime.now()
    task.status = "Completed"
    task.completed_at = now
    request.ward_boy_completed_at = now
    request.status = "Awaiting Engineer Confirmation"
    db.commit()
    db.refresh(task)
    db.refresh(request)
    return {"success": True, "task": _serialize_store_delivery(task, request)}
