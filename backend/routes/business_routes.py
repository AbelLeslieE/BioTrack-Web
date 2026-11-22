"""Business Office API: budgets, procurement, payments and payer settlements."""

import csv
import io
from datetime import date, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request as WebRequest
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models.asset import Asset
from backend.models.business import (
    BusinessBudget,
    BusinessTransaction,
    InsuranceClaimBatch,
    InsurancePolicy,
    PurchaseRequest,
)
from backend.models.central_store import CentralStoreItem
from backend.models.inventory import Inventory
from backend.models.user import User
from backend.models.vendor_contract import VendorServiceHistory
from backend.schemas.business_schema import (
    BudgetInput,
    ClaimBatchInput,
    ClaimBatchUpdate,
    PolicyInput,
    PurchaseDecision,
    PurchaseInput,
    PurchaseStatusUpdate,
    TransactionInput,
)
from backend.services.security_service import record_security_event


router = APIRouter(
    prefix="/api/business",
    tags=["business-office"],
    dependencies=[Depends(require_roles("Business", "Manager"))],
)


def _money(value) -> float:
    return round(float(value or 0), 2)


def _iso(value):
    return value.isoformat() if value else None


def _reference(prefix: str) -> str:
    return f"{prefix}-{date.today().year}-{uuid4().hex[:8].upper()}"


def _budget_row(row: BusinessBudget, purchases: list[PurchaseRequest], transactions: list[BusinessTransaction]) -> dict:
    related = [item for item in purchases if item.budget_id == row.id]
    committed = sum(item.total_amount or 0 for item in related if item.status in {"Approved", "Ordered", "Received"})
    actual = sum(item.amount or 0 for item in transactions if item.transaction_type == "Expense" and item.status == "Paid" and item.budget_id == row.id)
    allocated = _money(row.allocated_amount)
    return {
        "id": row.id,
        "fiscal_year": row.fiscal_year,
        "department": row.department,
        "category": row.category,
        "allocated_amount": allocated,
        "committed_amount": _money(committed),
        "actual_spend": _money(actual),
        "available_amount": _money(allocated - committed - actual),
        "utilisation_percent": round((actual / allocated * 100), 1) if allocated else 0,
        "status": row.status,
        "notes": row.notes,
        "updated_at": _iso(row.updated_at),
    }


def _purchase_row(row: PurchaseRequest) -> dict:
    return {
        "id": row.id,
        "request_number": row.request_number,
        "budget_id": row.budget_id,
        "department": row.department,
        "category": row.category,
        "item_name": row.item_name,
        "specification": row.specification,
        "vendor_name": row.vendor_name,
        "quantity": row.quantity,
        "unit": row.unit,
        "unit_cost": _money(row.unit_cost),
        "total_amount": _money(row.total_amount),
        "justification": row.justification,
        "priority": row.priority,
        "status": row.status,
        "requested_by": row.requested_by_name,
        "approved_by": row.approved_by_name,
        "approval_note": row.approval_note,
        "requested_at": _iso(row.requested_at),
        "reviewed_at": _iso(row.reviewed_at),
        "paid_at": _iso(row.paid_at),
    }


def _transaction_row(row: BusinessTransaction) -> dict:
    return {
        "id": row.id,
        "reference_number": row.reference_number,
        "budget_id": row.budget_id,
        "transaction_type": row.transaction_type,
        "category": row.category,
        "department": row.department,
        "counterparty": row.counterparty,
        "description": row.description,
        "amount": _money(row.amount),
        "transaction_date": _iso(row.transaction_date),
        "status": row.status,
        "payment_method": row.payment_method,
        "invoice_number": row.invoice_number,
        "source_type": row.source_type,
        "source_id": row.source_id,
    }


def _policy_row(row: InsurancePolicy) -> dict:
    effective_status = "Expired" if row.status == "Active" and row.valid_to < date.today() else row.status
    return {
        "id": row.id,
        "provider_name": row.provider_name,
        "policy_name": row.policy_name,
        "policy_code": row.policy_code,
        "payer_type": row.payer_type,
        "coverage_model": row.coverage_model,
        "valid_from": _iso(row.valid_from),
        "valid_to": _iso(row.valid_to),
        "claim_submission_days": row.claim_submission_days,
        "payment_due_days": row.payment_due_days,
        "status": effective_status,
        "contact_person": row.contact_person,
        "contact_email": row.contact_email,
        "contact_phone": row.contact_phone,
        "notes": row.notes,
    }


def _claim_row(row: InsuranceClaimBatch, policy: InsurancePolicy | None = None) -> dict:
    outstanding = max((row.approved_amount or 0) - (row.received_amount or 0), 0)
    return {
        "id": row.id,
        "batch_reference": row.batch_reference,
        "policy_id": row.policy_id,
        "provider_name": policy.provider_name if policy else "Unknown payer",
        "policy_name": policy.policy_name if policy else "",
        "service_period_start": _iso(row.service_period_start),
        "service_period_end": _iso(row.service_period_end),
        "claim_count": row.claim_count,
        "claimed_amount": _money(row.claimed_amount),
        "approved_amount": _money(row.approved_amount),
        "received_amount": _money(row.received_amount),
        "deductions_amount": _money(row.deductions_amount),
        "outstanding_amount": _money(outstanding),
        "status": row.status,
        "submitted_at": _iso(row.submitted_at),
        "expected_payment_date": _iso(row.expected_payment_date),
        "received_at": _iso(row.received_at),
        "query_reason": row.query_reason,
        "notes": row.notes,
    }


def _sync_claim_receipt(db: Session, claim: InsuranceClaimBatch, policy: InsurancePolicy, username: str) -> None:
    transaction = db.query(BusinessTransaction).filter(
        BusinessTransaction.source_type == "insurance_claim",
        BusinessTransaction.source_id == claim.id,
    ).first()
    if claim.received_amount <= 0:
        if transaction:
            transaction.status = "Cancelled"
            transaction.amount = 0
        return
    if not transaction:
        transaction = BusinessTransaction(
            reference_number=_reference("RCPT"),
            transaction_type="Insurance Receipt",
            category="Insurance settlement",
            department="Hospital-wide",
            counterparty=policy.provider_name,
            description=f"Aggregate settlement for claim batch {claim.batch_reference}",
            transaction_date=date.today(),
            source_type="insurance_claim",
            source_id=claim.id,
            created_by=username,
        )
        db.add(transaction)
    transaction.amount = _money(claim.received_amount)
    transaction.status = "Received"
    transaction.approved_by = username


@router.get("/dashboard")
def business_dashboard(fiscal_year: str | None = None, db: Session = Depends(get_db)):
    budgets_query = db.query(BusinessBudget)
    if fiscal_year:
        budgets_query = budgets_query.filter(BusinessBudget.fiscal_year == fiscal_year)
    budgets = budgets_query.order_by(BusinessBudget.fiscal_year.desc(), BusinessBudget.department, BusinessBudget.category).all()
    purchases = db.query(PurchaseRequest).order_by(PurchaseRequest.requested_at.desc()).all()
    transactions = db.query(BusinessTransaction).order_by(BusinessTransaction.transaction_date.desc()).all()
    policies = db.query(InsurancePolicy).order_by(InsurancePolicy.provider_name).all()
    claims = db.query(InsuranceClaimBatch).order_by(InsuranceClaimBatch.created_at.desc()).all()
    policy_map = {policy.id: policy for policy in policies}

    budget_rows = [_budget_row(row, purchases, transactions) for row in budgets]
    paid_expenses = [row for row in transactions if row.transaction_type == "Expense" and row.status == "Paid"]
    income = [row for row in transactions if row.transaction_type != "Expense" and row.status in {"Paid", "Received"}]
    total_approved = sum(row.approved_amount or 0 for row in claims)
    total_received = sum(row.received_amount or 0 for row in claims)
    spend_by_category: dict[str, float] = {}
    for row in paid_expenses:
        spend_by_category[row.category] = _money(spend_by_category.get(row.category, 0) + row.amount)

    return {
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "allocated_budget": _money(sum(row["allocated_amount"] for row in budget_rows)),
            "committed_spend": _money(sum(row["committed_amount"] for row in budget_rows)),
            "paid_spend": _money(sum(row.amount or 0 for row in paid_expenses)),
            "recorded_income": _money(sum(row.amount or 0 for row in income)),
            "available_budget": _money(sum(row["available_amount"] for row in budget_rows)),
            "pending_purchase_count": sum(row.status == "Submitted" for row in purchases),
            "pending_purchase_amount": _money(sum(row.total_amount or 0 for row in purchases if row.status == "Submitted")),
            "active_policies": sum(row.status == "Active" and row.valid_to >= date.today() for row in policies),
            "claim_batches": len(claims),
            "claims_approved": _money(total_approved),
            "claims_received": _money(total_received),
            "claims_outstanding": _money(max(total_approved - total_received, 0)),
        },
        "operational_values": {
            "registered_asset_value": _money(sum((row.net_value or row.purchase_value or 0) for row in db.query(Asset).all())),
            "department_inventory_value": _money(sum((row.purchase_price or 0) * (row.current_stock or 0) for row in db.query(Inventory).all())),
            "central_store_value": _money(sum((row.purchase_price or 0) * (row.current_stock or 0) for row in db.query(CentralStoreItem).all())),
            "vendor_service_cost": _money(sum(row.cost or 0 for row in db.query(VendorServiceHistory).all())),
        },
        "budgets": budget_rows,
        "purchases": [_purchase_row(row) for row in purchases[:100]],
        "transactions": [_transaction_row(row) for row in transactions[:100]],
        "policies": [_policy_row(row) for row in policies],
        "claims": [_claim_row(row, policy_map.get(row.policy_id)) for row in claims[:100]],
        "spend_by_category": [{"category": key, "amount": value} for key, value in sorted(spend_by_category.items(), key=lambda item: item[1], reverse=True)],
        "privacy_boundary": "Institutional and aggregate finance only. Patient billing and patient identifiers are not stored here.",
    }


@router.get("/admin-summary", dependencies=[Depends(require_roles("Manager"))])
def admin_summary(db: Session = Depends(get_db)):
    purchases = db.query(PurchaseRequest).all()
    transactions = db.query(BusinessTransaction).all()
    claims = db.query(InsuranceClaimBatch).all()
    budgets = db.query(BusinessBudget).filter(BusinessBudget.status == "Active").all()
    allocated = sum(row.allocated_amount or 0 for row in budgets)
    paid = sum(row.amount or 0 for row in transactions if row.transaction_type == "Expense" and row.status == "Paid")
    approved_claims = sum(row.approved_amount or 0 for row in claims)
    received_claims = sum(row.received_amount or 0 for row in claims)
    return {
        "allocated_budget": _money(allocated),
        "paid_spend": _money(paid),
        "remaining_budget": _money(allocated - paid),
        "pending_purchase_count": sum(row.status == "Submitted" for row in purchases),
        "pending_purchase_amount": _money(sum(row.total_amount or 0 for row in purchases if row.status == "Submitted")),
        "insurance_outstanding": _money(max(approved_claims - received_claims, 0)),
        "recent_pending": [_purchase_row(row) for row in sorted((item for item in purchases if item.status == "Submitted"), key=lambda item: item.requested_at, reverse=True)[:5]],
    }


@router.post("/budgets")
def save_budget(data: BudgetInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.query(BusinessBudget).filter(
        BusinessBudget.fiscal_year == data.fiscal_year,
        BusinessBudget.department == data.department,
        BusinessBudget.category == data.category,
    ).first()
    if row:
        for key, value in data.model_dump().items():
            setattr(row, key, value)
    else:
        row = BusinessBudget(**data.model_dump(), created_by=current_user.username)
        db.add(row)
    record_security_event(db, "business.budget.saved", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="business_budget", target_id=f"{data.fiscal_year}:{data.department}:{data.category}", details={"allocated_amount": data.allocated_amount}, commit=False)
    db.commit()
    db.refresh(row)
    return _budget_row(row, [], [])


@router.post("/purchases")
def create_purchase(data: PurchaseInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.budget_id and not db.get(BusinessBudget, data.budget_id):
        raise HTTPException(status_code=404, detail="Selected budget was not found.")
    row = PurchaseRequest(
        **data.model_dump(),
        request_number=_reference("PUR"),
        total_amount=_money(data.quantity * data.unit_cost),
        requested_by_username=current_user.username,
        requested_by_name=current_user.name or current_user.username,
    )
    db.add(row)
    record_security_event(db, "business.purchase.submitted", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="purchase_request", target_id=row.request_number, details={"amount": row.total_amount}, commit=False)
    db.commit()
    db.refresh(row)
    return _purchase_row(row)


@router.patch("/purchases/{purchase_id}/decision", dependencies=[Depends(require_roles("Manager"))])
def decide_purchase(purchase_id: int, data: PurchaseDecision, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(PurchaseRequest, purchase_id)
    if not row:
        raise HTTPException(status_code=404, detail="Purchase request not found.")
    if row.status != "Submitted":
        raise HTTPException(status_code=409, detail="Only submitted purchases can be reviewed.")
    row.status = data.decision
    row.approval_note = data.note
    row.approved_by_username = current_user.username
    row.approved_by_name = current_user.name or current_user.username
    row.reviewed_at = datetime.now()
    record_security_event(db, f"business.purchase.{data.decision.casefold()}", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="purchase_request", target_id=row.request_number, details={"amount": row.total_amount, "note": data.note}, commit=False)
    db.commit()
    return _purchase_row(row)


@router.patch("/purchases/{purchase_id}/status")
def update_purchase_status(purchase_id: int, data: PurchaseStatusUpdate, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(PurchaseRequest, purchase_id)
    if not row:
        raise HTTPException(status_code=404, detail="Purchase request not found.")
    allowed = {
        "Approved": {"Ordered", "Cancelled"},
        "Ordered": {"Received", "Cancelled"},
        "Received": {"Paid", "Cancelled"},
    }
    if data.status not in allowed.get(row.status, set()):
        raise HTTPException(status_code=409, detail=f"A {row.status} purchase cannot move to {data.status}.")
    row.status = data.status
    row.approval_note = data.note or row.approval_note
    now = datetime.now()
    if data.status == "Ordered":
        row.ordered_at = now
    elif data.status == "Received":
        row.received_at = now
    elif data.status == "Paid":
        row.paid_at = now
        transaction = BusinessTransaction(
            reference_number=_reference("PAY"),
            transaction_type="Expense",
            category=row.category,
            department=row.department,
            counterparty=row.vendor_name,
            description=f"Payment for {row.request_number}: {row.item_name}",
            amount=row.total_amount,
            transaction_date=date.today(),
            status="Paid",
            payment_method=data.payment_method,
            invoice_number=data.invoice_number,
            budget_id=row.budget_id,
            source_type="purchase",
            source_id=row.id,
            created_by=current_user.username,
            approved_by=row.approved_by_username,
        )
        db.add(transaction)
    record_security_event(db, f"business.purchase.{data.status.casefold()}", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="purchase_request", target_id=row.request_number, details={"amount": row.total_amount}, commit=False)
    db.commit()
    return _purchase_row(row)


@router.post("/transactions")
def create_transaction(data: TransactionInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.budget_id and not db.get(BusinessBudget, data.budget_id):
        raise HTTPException(status_code=404, detail="Selected budget was not found.")
    row = BusinessTransaction(**data.model_dump(), reference_number=_reference("TXN"), created_by=current_user.username)
    db.add(row)
    record_security_event(db, "business.transaction.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="business_transaction", target_id=row.reference_number, details={"type": row.transaction_type, "amount": row.amount}, commit=False)
    db.commit()
    db.refresh(row)
    return _transaction_row(row)


@router.post("/policies")
def create_policy(data: PolicyInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(InsurancePolicy).filter(InsurancePolicy.policy_code == data.policy_code).first():
        raise HTTPException(status_code=409, detail="That policy or scheme code already exists.")
    row = InsurancePolicy(**data.model_dump(), created_by=current_user.username)
    db.add(row)
    record_security_event(db, "business.policy.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="insurance_policy", target_id=row.policy_code, details={"provider": row.provider_name}, commit=False)
    db.commit()
    db.refresh(row)
    return _policy_row(row)


@router.put("/policies/{policy_id}")
def update_policy(policy_id: int, data: PolicyInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(InsurancePolicy, policy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Payer policy or scheme not found.")
    duplicate = db.query(InsurancePolicy).filter(InsurancePolicy.policy_code == data.policy_code, InsurancePolicy.id != policy_id).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="That policy or scheme code already exists.")
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    record_security_event(db, "business.policy.updated", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="insurance_policy", target_id=row.policy_code, details={"provider": row.provider_name, "status": row.status}, commit=False)
    db.commit()
    db.refresh(row)
    return _policy_row(row)


@router.post("/claims")
def create_claim(data: ClaimBatchInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    policy = db.get(InsurancePolicy, data.policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Payer policy or scheme not found.")
    if db.query(InsuranceClaimBatch).filter(InsuranceClaimBatch.batch_reference == data.batch_reference).first():
        raise HTTPException(status_code=409, detail="That claim batch reference already exists.")
    values = data.model_dump()
    values["deductions_amount"] = _money(values["claimed_amount"] - values["approved_amount"])
    values["submitted_at"] = datetime.now() if data.status != "Draft" else None
    values["received_at"] = datetime.now() if data.received_amount else None
    row = InsuranceClaimBatch(**values, created_by=current_user.username)
    db.add(row)
    db.flush()
    _sync_claim_receipt(db, row, policy, current_user.username)
    record_security_event(db, "business.claim.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="insurance_claim_batch", target_id=row.batch_reference, details={"claim_count": row.claim_count, "claimed_amount": row.claimed_amount}, commit=False)
    db.commit()
    db.refresh(row)
    return _claim_row(row, policy)


@router.patch("/claims/{claim_id}")
def update_claim(claim_id: int, data: ClaimBatchUpdate, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(InsuranceClaimBatch, claim_id)
    if not row:
        raise HTTPException(status_code=404, detail="Claim batch not found.")
    if data.approved_amount > row.claimed_amount or data.received_amount > data.approved_amount:
        raise HTTPException(status_code=422, detail="Received amount must not exceed approved amount, and approved must not exceed claimed.")
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    row.deductions_amount = _money(row.claimed_amount - row.approved_amount)
    row.received_at = datetime.now() if row.received_amount else None
    if row.received_amount >= row.approved_amount > 0:
        row.status = "Paid"
    elif row.received_amount > 0:
        row.status = "Partially Paid"
    policy = db.get(InsurancePolicy, row.policy_id)
    _sync_claim_receipt(db, row, policy, current_user.username)
    record_security_event(db, "business.claim.updated", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="insurance_claim_batch", target_id=row.batch_reference, details={"status": row.status, "approved_amount": row.approved_amount, "received_amount": row.received_amount}, commit=False)
    db.commit()
    return _claim_row(row, policy)


@router.get("/report.csv")
def export_report(fiscal_year: str | None = Query(default=None, max_length=20), db: Session = Depends(get_db)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["BioTrack Business Office institutional finance report"])
    writer.writerow(["Scope", "Hospital budgets, procurement, institutional payments and aggregate payer settlements; no patient billing data"])
    writer.writerow(["Generated", datetime.now().isoformat(timespec="seconds")])
    if fiscal_year:
        writer.writerow(["Fiscal year", fiscal_year])
    writer.writerow([])
    writer.writerow(["Record type", "Reference", "Department / payer", "Category / policy", "Amount", "Status", "Date"])
    for row in db.query(PurchaseRequest).order_by(PurchaseRequest.requested_at.desc()).all():
        writer.writerow(["Purchase", row.request_number, row.department, row.category, _money(row.total_amount), row.status, _iso(row.requested_at)])
    for row in db.query(BusinessTransaction).order_by(BusinessTransaction.transaction_date.desc()).all():
        writer.writerow([row.transaction_type, row.reference_number, row.department, row.category, _money(row.amount), row.status, _iso(row.transaction_date)])
    policies = {row.id: row for row in db.query(InsurancePolicy).all()}
    for row in db.query(InsuranceClaimBatch).order_by(InsuranceClaimBatch.created_at.desc()).all():
        policy = policies.get(row.policy_id)
        writer.writerow(["Claim batch", row.batch_reference, policy.provider_name if policy else "Unknown", policy.policy_name if policy else "", _money(row.claimed_amount), row.status, _iso(row.service_period_end)])
    filename = f"biotrack-business-report-{date.today().isoformat()}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
