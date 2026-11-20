from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models.user import User
from backend.models.vendor_contract import VendorContract, VendorServiceHistory
from backend.services.service_team import team_for_user


router = APIRouter(
    prefix="/api/vendors",
    tags=["Vendor contracts"],
    dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))],
)


class ContractPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    service_team: str = "Biomedical"
    vendor_name: str = Field(min_length=1, max_length=200)
    contact_person: str = Field(default="", max_length=160)
    phone: str = Field(default="", max_length=40)
    email: EmailStr | None = None
    contract_type: str = Field(default="AMC", pattern="^(AMC|CMC)$")
    contract_number: str = Field(default="", max_length=120)
    start_date: date
    end_date: date
    response_sla_hours: int = Field(default=24, ge=1, le=720)
    coverage: str = Field(default="", max_length=4000)
    status: str = Field(default="Active", pattern="^(Active|On Hold|Cancelled)$")


class HistoryPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    service_date: date
    reference_number: str = Field(default="", max_length=120)
    technician_name: str = Field(default="", max_length=160)
    summary: str = Field(min_length=1, max_length=4000)
    cost: float = Field(default=0, ge=0)


def _query_for_user(db: Session, current_user: User):
    query = db.query(VendorContract)
    team = team_for_user(current_user) if current_user.role != "Manager" else None
    return query.filter(VendorContract.service_team == team) if team else query


def _contract_for_user(db: Session, contract_id: int, current_user: User) -> VendorContract:
    contract = _query_for_user(db, current_user).filter(VendorContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Vendor contract not found.")
    return contract


def _renewal_state(contract: VendorContract) -> str:
    if contract.status != "Active":
        return contract.status
    if contract.end_date < date.today():
        return "Expired"
    if contract.end_date <= date.today() + timedelta(days=60):
        return "Renewal due"
    return "Active"


def _serialize_history(item: VendorServiceHistory) -> dict:
    return {
        "id": item.id,
        "service_date": item.service_date,
        "reference_number": item.reference_number or "",
        "technician_name": item.technician_name or "",
        "summary": item.summary,
        "cost": item.cost or 0,
    }


def _serialize_contract(contract: VendorContract, history: list[VendorServiceHistory]) -> dict:
    return {
        "id": contract.id,
        "service_team": contract.service_team,
        "vendor_name": contract.vendor_name,
        "contact_person": contract.contact_person or "",
        "phone": contract.phone or "",
        "email": contract.email or "",
        "contract_type": contract.contract_type,
        "contract_number": contract.contract_number or "",
        "start_date": contract.start_date,
        "end_date": contract.end_date,
        "response_sla_hours": contract.response_sla_hours,
        "coverage": contract.coverage or "",
        "status": contract.status,
        "renewal_state": _renewal_state(contract),
        "service_history": [_serialize_history(item) for item in history],
    }


@router.get("")
def list_contracts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contracts = _query_for_user(db, current_user).order_by(VendorContract.end_date.asc()).all()
    histories = db.query(VendorServiceHistory).filter(
        VendorServiceHistory.contract_id.in_([item.id for item in contracts] or [-1])
    ).order_by(VendorServiceHistory.service_date.desc()).all()
    by_contract: dict[int, list[VendorServiceHistory]] = {}
    for history in histories:
        by_contract.setdefault(history.contract_id, []).append(history)
    return [_serialize_contract(item, by_contract.get(item.id, [])) for item in contracts]


def _apply_contract(contract: VendorContract, payload: ContractPayload, current_user: User) -> None:
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="Renewal date must be after the contract start date.")
    contract.service_team = team_for_user(current_user, payload.service_team)
    contract.vendor_name = payload.vendor_name
    contract.contact_person = payload.contact_person
    contract.phone = payload.phone
    contract.email = str(payload.email or "")
    contract.contract_type = payload.contract_type
    contract.contract_number = payload.contract_number
    contract.start_date = payload.start_date
    contract.end_date = payload.end_date
    contract.response_sla_hours = payload.response_sla_hours
    contract.coverage = payload.coverage
    contract.status = payload.status


@router.post("")
def create_contract(
    payload: ContractPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = VendorContract()
    _apply_contract(contract, payload, current_user)
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return {"success": True, "id": contract.id}


@router.put("/{contract_id}")
def update_contract(
    contract_id: int,
    payload: ContractPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = _contract_for_user(db, contract_id, current_user)
    _apply_contract(contract, payload, current_user)
    db.commit()
    return {"success": True}


@router.post("/{contract_id}/history")
def add_service_history(
    contract_id: int,
    payload: HistoryPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = _contract_for_user(db, contract_id, current_user)
    entry = VendorServiceHistory(contract_id=contract.id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"success": True, "history": _serialize_history(entry)}
