from datetime import datetime
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models.central_store import CentralStoreItem, SparePartRequest, StoreDeliveryTask
from backend.models.inventory import Inventory
from backend.models.request import Request
from backend.models.user import User


router = APIRouter(prefix="/api/central-store", tags=["Central Store"])

ENGINEERING_TEAMS = {"BME": "Biomedical", "Electrical": "Electrical", "IT": "IT"}
ENGINEERING_DESTINATIONS = {
    "Biomedical": "Biomedical Engineering Workshop",
    "Electrical": "Electrical Engineering Workshop",
    "IT": "IT Service Desk",
}


class CatalogueItemFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    item_code: str = Field(min_length=1, max_length=80)
    item_name: str = Field(min_length=1, max_length=240)
    category: str = Field(default="", max_length=120)
    manufacturer: str = Field(default="", max_length=160)
    supplier: str = Field(default="", max_length=160)
    unit: str = Field(default="pieces", min_length=1, max_length=40)
    current_stock: int = Field(default=0, ge=0)
    minimum_stock: int = Field(default=5, ge=0)
    maximum_stock: int = Field(default=100, ge=0)
    location: str = Field(default="Central Store", min_length=1, max_length=160)
    rack: str = Field(default="", max_length=80)
    purchase_price: float = Field(default=0, ge=0)
    active: bool = True

    @field_validator("maximum_stock")
    @classmethod
    def validate_maximum(cls, value: int, info):
        minimum = info.data.get("minimum_stock", 0)
        if value < minimum:
            raise ValueError("Maximum stock cannot be below minimum stock.")
        return value


class SpareRequestCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    request_type: Literal["Internal", "External"]
    central_store_item_id: int | None = Field(default=None, gt=0)
    item_name: str = Field(default="", max_length=240)
    item_code: str = Field(default="", max_length=80)
    category: str = Field(default="", max_length=120)
    manufacturer: str = Field(default="", max_length=160)
    specification: str = Field(default="", max_length=500)
    quantity: int = Field(gt=0, le=100000)
    unit: str = Field(default="pieces", min_length=1, max_length=40)
    request_reason: Literal["Low Stock", "Out of Stock", "External Item", "General"] = "General"
    priority: Literal["Low", "Medium", "High", "Critical"] = "Medium"
    linked_request_id: int | None = Field(default=None, gt=0)
    delivery_location: str = Field(default="", max_length=240)
    notes: str = Field(default="", max_length=1000)


class StoreRequestAction(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    action: Literal["Approve", "MarkReady", "DispatchWardBoy", "ReadyForPickup", "Reject"]
    notes: str = Field(default="", max_length=1000)


def _team_for_user(user: User) -> str | None:
    if user.role == "Manager":
        return None
    team = ENGINEERING_TEAMS.get(user.role)
    if not team:
        raise HTTPException(status_code=403, detail="An engineering account is required.")
    return team


def _sync_catalogue_from_engineering(db: Session) -> int:
    """Ensure every engineering stock name exists in the hospital master catalogue."""

    existing_codes = {
        str(code).strip().casefold()
        for (code,) in db.query(CentralStoreItem.item_code).all()
        if code and str(code).strip()
    }
    added = 0
    for item in db.query(Inventory).order_by(Inventory.id.asc()).all():
        code = (item.bpk_number or f"INV-{item.id}").strip()
        if code.casefold() in existing_codes:
            continue
        db.add(CentralStoreItem(
            item_code=code,
            item_name=item.item_name,
            category=item.category or "",
            manufacturer=item.manufacturer or "",
            supplier=item.supplier or "",
            unit=item.unit or "pieces",
            current_stock=0,
            minimum_stock=item.minimum_stock or 5,
            maximum_stock=item.maximum_stock or 100,
            location="Central Store",
            rack="",
            purchase_price=item.purchase_price or 0,
            active=True,
        ))
        existing_codes.add(code.casefold())
        added += 1
    if added:
        db.commit()
    return added


def _catalogue_state(item: CentralStoreItem) -> str:
    if (item.current_stock or 0) <= 0:
        return "Out of Stock"
    if (item.current_stock or 0) <= (item.minimum_stock or 0):
        return "Low Stock"
    return "Available"


def _serialize_item(item: CentralStoreItem) -> dict:
    return {
        "id": item.id,
        "item_code": item.item_code,
        "item_name": item.item_name,
        "category": item.category or "",
        "manufacturer": item.manufacturer or "",
        "supplier": item.supplier or "",
        "unit": item.unit or "pieces",
        "current_stock": item.current_stock or 0,
        "minimum_stock": item.minimum_stock or 0,
        "maximum_stock": item.maximum_stock or 0,
        "location": item.location or "Central Store",
        "rack": item.rack or "",
        "purchase_price": item.purchase_price or 0,
        "active": bool(item.active),
        "stock_state": _catalogue_state(item),
    }


def _serialize_delivery(task: StoreDeliveryTask | None) -> dict | None:
    if not task:
        return None
    return {
        "id": task.id,
        "status": task.status,
        "assigned_to": task.assigned_to_name or "",
        "assigned_to_username": task.assigned_to_username or "",
        "requested_at": task.requested_at.isoformat() if task.requested_at else None,
        "accepted_at": task.accepted_at.isoformat() if task.accepted_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


def _serialize_request(db: Session, request: SparePartRequest) -> dict:
    item = db.get(CentralStoreItem, request.central_store_item_id) if request.central_store_item_id else None
    delivery = (
        db.query(StoreDeliveryTask)
        .filter(StoreDeliveryTask.spare_request_id == request.id)
        .first()
    )
    return {
        "id": request.id,
        "request_number": request.request_number,
        "requested_by_username": request.requested_by_username,
        "requested_by_name": request.requested_by_name,
        "requested_by_role": request.requested_by_role,
        "service_team": request.service_team,
        "request_type": request.request_type,
        "central_store_item_id": request.central_store_item_id,
        "item_name": request.requested_item_name,
        "item_code": request.requested_item_code or "",
        "category": request.category or "",
        "manufacturer": request.manufacturer or "",
        "specification": request.specification or "",
        "quantity": request.quantity,
        "unit": request.unit or "pieces",
        "request_reason": request.request_reason,
        "priority": request.priority,
        "linked_request_id": request.linked_request_id,
        "delivery_location": request.delivery_location,
        "notes": request.notes or "",
        "status": request.status,
        "central_store_notes": request.central_store_notes or "",
        "stock_issued": bool(request.stock_issued),
        "fulfilled_quantity": request.fulfilled_quantity or 0,
        "delivery_mode": request.delivery_mode or "",
        "catalogue_stock": item.current_stock if item else None,
        "requested_at": request.requested_at.isoformat() if request.requested_at else None,
        "approved_at": request.approved_at.isoformat() if request.approved_at else None,
        "ready_at": request.ready_at.isoformat() if request.ready_at else None,
        "dispatched_at": request.dispatched_at.isoformat() if request.dispatched_at else None,
        "ward_boy_completed_at": request.ward_boy_completed_at.isoformat() if request.ward_boy_completed_at else None,
        "engineer_confirmed_at": request.engineer_confirmed_at.isoformat() if request.engineer_confirmed_at else None,
        "completed_at": request.completed_at.isoformat() if request.completed_at else None,
        "delivery_task": _serialize_delivery(delivery),
    }


def _issue_internal_stock(db: Session, request: SparePartRequest) -> None:
    if request.stock_issued:
        return
    item = (
        db.query(CentralStoreItem)
        .filter(CentralStoreItem.id == request.central_store_item_id)
        .with_for_update()
        .one_or_none()
    )
    if not item or not item.active:
        raise HTTPException(status_code=409, detail="The selected Central Store item is unavailable.")
    if (item.current_stock or 0) < request.quantity:
        raise HTTPException(
            status_code=409,
            detail=f"Only {item.current_stock or 0} {item.unit or 'items'} are available in Central Store.",
        )
    item.current_stock = (item.current_stock or 0) - request.quantity
    request.stock_issued = True
    request.fulfilled_quantity = request.quantity


def _create_external_catalogue_item(db: Session, request: SparePartRequest) -> CentralStoreItem:
    requested_code = (request.requested_item_code or f"EXT-{request.id:05d}").strip()
    existing = (
        db.query(CentralStoreItem)
        .filter(func.lower(CentralStoreItem.item_code) == requested_code.casefold())
        .first()
    )
    if existing:
        return existing
    item = CentralStoreItem(
        item_code=requested_code,
        item_name=request.requested_item_name,
        category=request.category or "External procurement",
        manufacturer=request.manufacturer or "",
        unit=request.unit or "pieces",
        current_stock=0,
        minimum_stock=1,
        maximum_stock=max(10, request.quantity),
        location="Central Store",
        active=True,
    )
    db.add(item)
    db.flush()
    return item


@router.get("/catalog")
def list_catalogue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Manager", "CentralStore", "BME", "Electrical", "IT")),
):
    _sync_catalogue_from_engineering(db)
    items = db.query(CentralStoreItem).order_by(CentralStoreItem.item_name.asc()).all()
    if current_user.role not in {"Manager", "CentralStore"}:
        items = [item for item in items if item.active]
    return [_serialize_item(item) for item in items]


@router.post("/catalog")
def create_catalogue_item(
    payload: CatalogueItemFields,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Manager", "CentralStore")),
):
    del current_user
    if db.query(CentralStoreItem).filter(func.lower(CentralStoreItem.item_code) == payload.item_code.casefold()).first():
        raise HTTPException(status_code=409, detail="This Central Store item code already exists.")
    item = CentralStoreItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"success": True, "item": _serialize_item(item)}


@router.put("/catalog/{item_id}")
def update_catalogue_item(
    item_id: int,
    payload: CatalogueItemFields,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Manager", "CentralStore")),
):
    del current_user
    item = db.get(CentralStoreItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Central Store item not found.")
    conflict = (
        db.query(CentralStoreItem)
        .filter(func.lower(CentralStoreItem.item_code) == payload.item_code.casefold(), CentralStoreItem.id != item_id)
        .first()
    )
    if conflict:
        raise HTTPException(status_code=409, detail="This Central Store item code already exists.")
    for field, value in payload.model_dump().items():
        setattr(item, field, value)
    item.updated_at = datetime.now()
    db.commit()
    db.refresh(item)
    return {"success": True, "item": _serialize_item(item)}


@router.get("/engineer-calls")
def engineer_calls(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Manager", "BME", "Electrical", "IT")),
):
    team = _team_for_user(current_user)
    query = db.query(Request)
    if team:
        query = query.filter(Request.service_team == team)
    calls = query.order_by(Request.call_received_datetime.desc()).limit(100).all()
    return [{
        "id": call.id,
        "ticket": call.ticket_number,
        "equipment": call.equipment_name or "Equipment",
        "department": call.department or "",
        "location": call.location or "",
        "status": call.status,
    } for call in calls]


@router.post("/requests")
def create_spare_request(
    payload: SpareRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Manager", "BME", "Electrical", "IT")),
):
    team = _team_for_user(current_user) or "Biomedical"
    item = None
    if payload.request_type == "Internal":
        if not payload.central_store_item_id:
            raise HTTPException(status_code=422, detail="Select an item from the Central Store catalogue.")
        item = db.get(CentralStoreItem, payload.central_store_item_id)
        if not item or not item.active:
            raise HTTPException(status_code=404, detail="The selected Central Store item is unavailable.")
        item_name = item.item_name
        item_code = item.item_code
        category = item.category or ""
        manufacturer = item.manufacturer or ""
        unit = item.unit or payload.unit
        reason = payload.request_reason if payload.request_reason != "External Item" else "General"
    else:
        if not payload.item_name:
            raise HTTPException(status_code=422, detail="Enter the external spare-part name.")
        item_name = payload.item_name
        item_code = payload.item_code
        category = payload.category
        manufacturer = payload.manufacturer
        unit = payload.unit
        reason = "External Item"

    linked_call = None
    if payload.linked_request_id:
        linked_call = db.get(Request, payload.linked_request_id)
        if not linked_call or (current_user.role != "Manager" and linked_call.service_team != team):
            raise HTTPException(status_code=403, detail="The selected maintenance call belongs to another team.")

    location = payload.delivery_location or ENGINEERING_DESTINATIONS[team]
    request = SparePartRequest(
        request_number=f"CSR-{datetime.now():%Y%m%d}-{uuid4().hex[:6].upper()}",
        requested_by_username=current_user.username,
        requested_by_name=current_user.name or current_user.username,
        requested_by_role=current_user.role,
        service_team=team,
        request_type=payload.request_type,
        central_store_item_id=item.id if item else None,
        requested_item_name=item_name,
        requested_item_code=item_code,
        category=category,
        manufacturer=manufacturer,
        specification=payload.specification,
        quantity=payload.quantity,
        unit=unit,
        request_reason=reason,
        priority=payload.priority,
        linked_request_id=linked_call.id if linked_call else None,
        delivery_location=location,
        notes=payload.notes,
        status="Submitted",
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return {"success": True, "request": _serialize_request(db, request)}


@router.get("/my-requests")
def my_spare_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Manager", "BME", "Electrical", "IT")),
):
    query = db.query(SparePartRequest)
    if current_user.role != "Manager":
        query = query.filter(SparePartRequest.service_team == _team_for_user(current_user))
    requests = query.order_by(SparePartRequest.requested_at.desc()).limit(200).all()
    return [_serialize_request(db, request) for request in requests]


@router.get("/dashboard")
def central_store_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Manager", "CentralStore")),
):
    del current_user
    _sync_catalogue_from_engineering(db)
    requests = db.query(SparePartRequest).order_by(SparePartRequest.requested_at.desc()).limit(250).all()
    inventory = db.query(Inventory).order_by(Inventory.item_name.asc()).all()
    low_stock = []
    out_of_stock = []
    for item in inventory:
        available = max(0, (item.current_stock or 0) - (item.reserved_stock or 0))
        row = {
            "id": item.id,
            "service_team": item.service_team,
            "bpk_number": item.bpk_number,
            "item_name": item.item_name,
            "available_stock": available,
            "minimum_stock": item.minimum_stock or 0,
            "unit": item.unit or "pieces",
            "location": item.location or "Engineering store",
        }
        if available <= 0:
            out_of_stock.append(row)
        elif available <= (item.minimum_stock or 0):
            low_stock.append(row)

    catalogue = db.query(CentralStoreItem).order_by(CentralStoreItem.item_name.asc()).all()
    active_statuses = {"Submitted", "Awaiting Procurement", "Ready", "Dispatched", "Awaiting Engineer Confirmation"}
    return {
        "summary": {
            "new_requests": sum(request.status == "Submitted" for request in requests),
            "active_requests": sum(request.status in active_statuses for request in requests),
            "low_stock": len(low_stock),
            "out_of_stock": len(out_of_stock),
            "catalogue_items": len(catalogue),
            "completed_today": sum(
                bool(request.completed_at and request.completed_at.date() == datetime.now().date())
                for request in requests
            ),
        },
        "requests": [_serialize_request(db, request) for request in requests],
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "catalogue": [_serialize_item(item) for item in catalogue],
    }


@router.patch("/requests/{request_id}/action")
def process_spare_request(
    request_id: int,
    payload: StoreRequestAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Manager", "CentralStore")),
):
    request = (
        db.query(SparePartRequest)
        .filter(SparePartRequest.id == request_id)
        .with_for_update()
        .one_or_none()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Spare-part request not found.")
    now = datetime.now()
    request.central_store_notes = payload.notes or request.central_store_notes or ""

    if payload.action == "Approve":
        if request.status != "Submitted":
            raise HTTPException(status_code=409, detail="Only submitted requests can be approved.")
        request.approved_by_username = current_user.username
        request.approved_by_name = current_user.name or current_user.username
        request.approved_at = now
        if request.request_type == "Internal":
            item = db.get(CentralStoreItem, request.central_store_item_id)
            if item and (item.current_stock or 0) >= request.quantity:
                _issue_internal_stock(db, request)
                request.status = "Ready"
                request.ready_at = now
            else:
                request.status = "Awaiting Procurement"
        else:
            request.status = "Awaiting Procurement"

    elif payload.action == "MarkReady":
        if request.status not in {"Submitted", "Awaiting Procurement"}:
            raise HTTPException(status_code=409, detail="This request cannot be marked ready from its current status.")
        if not request.approved_at:
            request.approved_by_username = current_user.username
            request.approved_by_name = current_user.name or current_user.username
            request.approved_at = now
        if request.request_type == "Internal":
            _issue_internal_stock(db, request)
        else:
            item = _create_external_catalogue_item(db, request)
            request.central_store_item_id = item.id
            request.stock_issued = True
            request.fulfilled_quantity = request.quantity
        request.status = "Ready"
        request.ready_at = now

    elif payload.action == "DispatchWardBoy":
        if request.status != "Ready":
            raise HTTPException(status_code=409, detail="Prepare the spare parts before requesting delivery.")
        existing = db.query(StoreDeliveryTask).filter(StoreDeliveryTask.spare_request_id == request.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="A Ward Boy delivery already exists for this request.")
        db.add(StoreDeliveryTask(
            spare_request_id=request.id,
            status="Pending",
            source_location="Central Store",
            destination_location=request.delivery_location,
            notes=payload.notes or request.notes or "",
            requested_by_username=current_user.username,
            requested_by_name=current_user.name or current_user.username,
        ))
        request.delivery_mode = "Ward Boy"
        request.status = "Dispatched"
        request.dispatched_at = now

    elif payload.action == "ReadyForPickup":
        if request.status != "Ready":
            raise HTTPException(status_code=409, detail="Prepare the spare parts before handover.")
        request.delivery_mode = "Engineer Pickup"
        request.status = "Awaiting Engineer Confirmation"
        request.dispatched_at = now

    else:
        if request.status in {"Completed", "Rejected", "Dispatched", "Awaiting Engineer Confirmation"}:
            raise HTTPException(status_code=409, detail="This request can no longer be rejected.")
        if request.stock_issued and request.central_store_item_id:
            item = db.get(CentralStoreItem, request.central_store_item_id)
            if item:
                item.current_stock = (item.current_stock or 0) + (request.fulfilled_quantity or request.quantity)
        request.stock_issued = False
        request.fulfilled_quantity = 0
        request.status = "Rejected"
        request.rejected_at = now

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="This request was updated by another user. Refresh and try again.") from error
    db.refresh(request)
    return {"success": True, "request": _serialize_request(db, request)}


@router.patch("/requests/{request_id}/confirm-receipt")
def confirm_spare_receipt(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Manager", "BME", "Electrical", "IT")),
):
    request = db.get(SparePartRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Spare-part request not found.")
    team = _team_for_user(current_user)
    if current_user.role != "Manager" and team != request.service_team:
        raise HTTPException(status_code=403, detail="This request belongs to another engineering team.")
    if request.status != "Awaiting Engineer Confirmation":
        raise HTTPException(status_code=409, detail="Delivery must be completed before receipt can be confirmed.")
    now = datetime.now()
    request.engineer_confirmed_at = now
    request.completed_at = now
    request.status = "Completed"
    db.commit()
    db.refresh(request)
    return {"success": True, "request": _serialize_request(db, request)}
