"""Business Office API: budgets, procurement, payments and payer settlements."""

import csv
import io
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request as WebRequest, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from backend.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models.asset import Asset
from backend.models.business import (
    BusinessBudget,
    BusinessDocument,
    BusinessTransaction,
    BusinessVendor,
    InsuranceClaimBatch,
    InsurancePolicy,
    PurchaseRequest,
    SupplierInvoice,
    SupplierPayment,
    SupplierQuotation,
)
from backend.models.central_store import CentralStoreItem
from backend.models.inventory import Inventory
from backend.models.user import User
from backend.models.vendor_contract import VendorServiceHistory
from backend.schemas.business_schema import (
    BudgetInput,
    ClaimBatchInput,
    ClaimBatchUpdate,
    InvoiceDecision,
    InvoiceInput,
    PaymentCompletion,
    PaymentDecision,
    PaymentRequestInput,
    PolicyInput,
    PurchaseDecision,
    PurchaseInput,
    PurchaseStatusUpdate,
    QuotationInput,
    TransactionInput,
    VendorInput,
)
from backend.services.attachment_service import optimize_attachment
from backend.services.security_service import record_security_event


router = APIRouter(
    prefix="/api/business",
    tags=["business-office"],
    dependencies=[Depends(require_roles("Business", "Manager"))],
)


MONEY = Decimal("0.01")
QUOTE_SCORE = Decimal("0.01")
QUOTATION_EVALUATION_WEIGHTS = {
    "price": Decimal("40"),
    "warranty": Decimal("30"),
    "delivery": Decimal("20"),
    "payment_terms": Decimal("10"),
}


def _money(value) -> Decimal:
    """Normalize currency without introducing binary floating-point errors."""
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _iso(value):
    return value.isoformat() if value else None


def _reference(prefix: str) -> str:
    return f"{prefix}-{date.today().year}-{uuid4().hex[:8].upper()}"


def _budget_row(row: BusinessBudget, purchases: list[PurchaseRequest], transactions: list[BusinessTransaction], paid_by_purchase: dict[int, Decimal] | None = None) -> dict:
    related = [item for item in purchases if item.budget_id == row.id]
    paid_by_purchase = paid_by_purchase or {}
    committed = sum(
        max(_money(item.total_amount) - paid_by_purchase.get(item.id, Decimal("0")), Decimal("0"))
        for item in related if item.status in {"Approved", "Ordered", "Received"}
    )
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


def _vendor_row(row: BusinessVendor, outstanding: Decimal = Decimal("0")) -> dict:
    return {
        "id": row.id,
        "vendor_code": row.vendor_code,
        "vendor_name": row.vendor_name,
        "supplier_type": row.supplier_type,
        "tax_identifier": row.tax_identifier,
        "contact_person": row.contact_person,
        "email": row.email,
        "phone": row.phone,
        "address": row.address,
        "payment_terms_days": row.payment_terms_days,
        "bank_name": row.bank_name,
        "bank_account_reference": row.bank_account_reference,
        "status": row.status,
        "notes": row.notes,
        "outstanding_amount": _money(outstanding),
    }


def _quotation_evaluations(
    quotations: list[SupplierQuotation],
    vendors: dict[int, BusinessVendor],
) -> dict[int, dict]:
    """Rank comparable quotations using a transparent best-value score."""
    evaluations: dict[int, dict] = {}
    grouped: dict[int, list[SupplierQuotation]] = {}
    for quotation in quotations:
        grouped.setdefault(quotation.purchase_id, []).append(quotation)

    for purchase_quotations in grouped.values():
        minimum_total = min((_money(row.total_amount) for row in purchase_quotations), default=Decimal("0"))
        maximum_warranty = max((row.warranty_months or 0 for row in purchase_quotations), default=0)
        minimum_delivery = min((max(row.delivery_days or 0, 0) for row in purchase_quotations), default=0)
        maximum_terms = max((max(vendors.get(row.vendor_id).payment_terms_days if vendors.get(row.vendor_id) else 0, 0) for row in purchase_quotations), default=0)

        scored: list[tuple[SupplierQuotation, Decimal, dict[str, Decimal]]] = []
        for row in purchase_quotations:
            total = _money(row.total_amount)
            warranty = max(row.warranty_months or 0, 0)
            delivery = max(row.delivery_days or 0, 0)
            terms = max(vendors.get(row.vendor_id).payment_terms_days if vendors.get(row.vendor_id) else 0, 0)
            price_score = Decimal("100") if total == 0 and minimum_total == 0 else (Decimal("0") if total == 0 else minimum_total / total * 100)
            warranty_score = Decimal("100") if maximum_warranty == 0 else Decimal(warranty) / Decimal(maximum_warranty) * 100
            delivery_score = Decimal(minimum_delivery + 1) / Decimal(delivery + 1) * 100
            terms_score = Decimal("100") if maximum_terms == 0 else Decimal(terms) / Decimal(maximum_terms) * 100
            criteria = {
                "price": price_score.quantize(QUOTE_SCORE, rounding=ROUND_HALF_UP),
                "warranty": warranty_score.quantize(QUOTE_SCORE, rounding=ROUND_HALF_UP),
                "delivery": delivery_score.quantize(QUOTE_SCORE, rounding=ROUND_HALF_UP),
                "payment_terms": terms_score.quantize(QUOTE_SCORE, rounding=ROUND_HALF_UP),
            }
            score = sum((criteria[key] * weight for key, weight in QUOTATION_EVALUATION_WEIGHTS.items()), Decimal("0")) / Decimal("100")
            scored.append((row, score.quantize(QUOTE_SCORE, rounding=ROUND_HALF_UP), criteria))

        scored.sort(key=lambda item: (-item[1], _money(item[0].total_amount), -(item[0].warranty_months or 0), item[0].delivery_days or 0, item[0].id))
        best_score = scored[0][1] if scored else Decimal("0")
        runner_up_score = scored[1][1] if len(scored) > 1 else None
        for rank, (row, score, criteria) in enumerate(scored, start=1):
            vendor = vendors.get(row.vendor_id)
            terms = max(vendor.payment_terms_days if vendor else 0, 0)
            reasons: list[str] = []
            if _money(row.total_amount) == minimum_total:
                reasons.append("Lowest total price")
            if (row.warranty_months or 0) == maximum_warranty:
                reasons.append("Longest warranty")
            if max(row.delivery_days or 0, 0) == minimum_delivery:
                reasons.append("Fastest delivery")
            if terms == maximum_terms:
                reasons.append("Best payment credit period")

            dominates_count = 0
            for other in purchase_quotations:
                if other.id == row.id:
                    continue
                other_vendor = vendors.get(other.vendor_id)
                other_terms = max(other_vendor.payment_terms_days if other_vendor else 0, 0)
                no_worse = (
                    _money(row.total_amount) <= _money(other.total_amount)
                    and (row.warranty_months or 0) >= (other.warranty_months or 0)
                    and max(row.delivery_days or 0, 0) <= max(other.delivery_days or 0, 0)
                    and terms >= other_terms
                )
                strictly_better = (
                    _money(row.total_amount) < _money(other.total_amount)
                    or (row.warranty_months or 0) > (other.warranty_months or 0)
                    or max(row.delivery_days or 0, 0) < max(other.delivery_days or 0, 0)
                    or terms > other_terms
                )
                dominates_count += int(no_worse and strictly_better)

            if rank == 1 and runner_up_score is not None:
                advantage = Decimal("0") if runner_up_score == 0 else (best_score - runner_up_score) / runner_up_score * 100
            elif rank > 1:
                advantage = Decimal("0") if score == 0 else (best_score - score) / score * 100
            else:
                advantage = Decimal("0")
            evaluations[row.id] = {
                "evaluation_score": score,
                "evaluation_rank": rank,
                "is_recommended": rank == 1,
                "advantage_percent": advantage.quantize(QUOTE_SCORE, rounding=ROUND_HALF_UP),
                "criteria_scores": criteria,
                "evaluation_reasons": reasons,
                "dominates_count": dominates_count,
                "evaluation_weights": QUOTATION_EVALUATION_WEIGHTS,
            }
    return evaluations


def _quotation_row(row: SupplierQuotation, vendor: BusinessVendor | None = None, lowest: Decimal | None = None, evaluation: dict | None = None) -> dict:
    result = {
        "id": row.id,
        "purchase_id": row.purchase_id,
        "vendor_id": row.vendor_id,
        "vendor_name": vendor.vendor_name if vendor else "Unknown vendor",
        "quote_number": row.quote_number,
        "quote_date": _iso(row.quote_date),
        "valid_until": _iso(row.valid_until),
        "quantity": row.quantity,
        "unit_price": _money(row.unit_price),
        "tax_amount": _money(row.tax_amount),
        "discount_amount": _money(row.discount_amount),
        "freight_amount": _money(row.freight_amount),
        "total_amount": _money(row.total_amount),
        "delivery_days": row.delivery_days,
        "warranty_months": row.warranty_months,
        "payment_terms": row.payment_terms,
        "vendor_payment_terms_days": vendor.payment_terms_days if vendor else 0,
        "notes": row.notes,
        "status": row.status,
        "is_lowest": lowest is not None and _money(row.total_amount) == _money(lowest),
        "selected_at": _iso(row.selected_at),
    }
    result.update(evaluation or {})
    return result


def _invoice_row(row: SupplierInvoice, vendor: BusinessVendor | None = None, purchase: PurchaseRequest | None = None) -> dict:
    outstanding = max(_money(row.approved_amount) - _money(row.paid_amount), Decimal("0"))
    status = "Overdue" if outstanding > 0 and row.due_date < date.today() and row.status in {"Approved", "Partially Paid"} else row.status
    return {
        "id": row.id,
        "purchase_id": row.purchase_id,
        "request_number": purchase.request_number if purchase else "",
        "vendor_id": row.vendor_id,
        "vendor_name": vendor.vendor_name if vendor else "Unknown vendor",
        "quotation_id": row.quotation_id,
        "invoice_number": row.invoice_number,
        "invoice_date": _iso(row.invoice_date),
        "due_date": _iso(row.due_date),
        "subtotal_amount": _money(row.subtotal_amount),
        "tax_amount": _money(row.tax_amount),
        "discount_amount": _money(row.discount_amount),
        "total_amount": _money(row.total_amount),
        "approved_amount": _money(row.approved_amount),
        "paid_amount": _money(row.paid_amount),
        "outstanding_amount": _money(outstanding),
        "status": status,
        "stored_status": row.status,
        "notes": row.notes,
        "approval_note": row.approval_note,
        "approved_by": row.approved_by,
    }


def _payment_row(row: SupplierPayment, invoice: SupplierInvoice | None = None, vendor: BusinessVendor | None = None) -> dict:
    return {
        "id": row.id,
        "invoice_id": row.invoice_id,
        "invoice_number": invoice.invoice_number if invoice else "",
        "vendor_name": vendor.vendor_name if vendor else "Unknown vendor",
        "reference_number": row.reference_number,
        "amount": _money(row.amount),
        "requested_payment_date": _iso(row.requested_payment_date),
        "paid_date": _iso(row.paid_date),
        "payment_method": row.payment_method,
        "bank_reference": row.bank_reference,
        "status": row.status,
        "request_note": row.request_note,
        "approval_note": row.approval_note,
        "requested_by": row.requested_by,
        "approved_by": row.approved_by,
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
    vendors = db.query(BusinessVendor).order_by(BusinessVendor.vendor_name).all()
    quotations = db.query(SupplierQuotation).order_by(SupplierQuotation.created_at.desc()).all()
    invoices = db.query(SupplierInvoice).order_by(SupplierInvoice.invoice_date.desc(), SupplierInvoice.id.desc()).all()
    payments = db.query(SupplierPayment).order_by(SupplierPayment.requested_at.desc()).all()
    policy_map = {policy.id: policy for policy in policies}
    vendor_map = {vendor.id: vendor for vendor in vendors}
    purchase_map = {purchase.id: purchase for purchase in purchases}
    invoice_map = {invoice.id: invoice for invoice in invoices}
    paid_by_purchase: dict[int, Decimal] = {}
    for payment in payments:
        invoice = invoice_map.get(payment.invoice_id)
        if payment.status == "Paid" and invoice:
            paid_by_purchase[invoice.purchase_id] = _money(paid_by_purchase.get(invoice.purchase_id, Decimal("0")) + payment.amount)
    invoice_outstanding = {
        invoice.id: max(_money(invoice.approved_amount) - _money(invoice.paid_amount), Decimal("0"))
        for invoice in invoices
    }
    vendor_outstanding = {
        vendor.id: sum((invoice_outstanding[invoice.id] for invoice in invoices if invoice.vendor_id == vendor.id), Decimal("0"))
        for vendor in vendors
    }
    quote_lowest: dict[int, Decimal] = {}
    for quotation in quotations:
        current = quote_lowest.get(quotation.purchase_id)
        if current is None or _money(quotation.total_amount) < current:
            quote_lowest[quotation.purchase_id] = _money(quotation.total_amount)
    quote_evaluations = _quotation_evaluations(quotations, vendor_map)

    budget_rows = [_budget_row(row, purchases, transactions, paid_by_purchase) for row in budgets]
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
            "supplier_outstanding": _money(sum(invoice_outstanding.values(), Decimal("0"))),
            "overdue_supplier_amount": _money(sum((amount for invoice_id, amount in invoice_outstanding.items() if amount > 0 and invoice_map[invoice_id].due_date < date.today()), Decimal("0"))),
            "pending_payment_approvals": sum(row.status == "Pending Approval" for row in payments),
            "active_vendors": sum(row.status == "Active" for row in vendors),
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
        "vendors": [_vendor_row(row, vendor_outstanding.get(row.id, Decimal("0"))) for row in vendors],
        "quotations": [_quotation_row(row, vendor_map.get(row.vendor_id), quote_lowest.get(row.purchase_id), quote_evaluations.get(row.id)) for row in quotations[:250]],
        "invoices": [_invoice_row(row, vendor_map.get(row.vendor_id), purchase_map.get(row.purchase_id)) for row in invoices[:250]],
        "payments": [_payment_row(row, invoice_map.get(row.invoice_id), vendor_map.get(invoice_map[row.invoice_id].vendor_id) if row.invoice_id in invoice_map else None) for row in payments[:250]],
        "document_counts": {
            f"{record_type}:{record_id}": count
            for record_type, record_id, count in db.query(
                BusinessDocument.record_type,
                BusinessDocument.record_id,
                func.count(BusinessDocument.id),
            ).group_by(BusinessDocument.record_type, BusinessDocument.record_id).all()
        },
        "spend_by_category": [{"category": key, "amount": value} for key, value in sorted(spend_by_category.items(), key=lambda item: item[1], reverse=True)],
        "privacy_boundary": "Institutional and aggregate finance only. Patient billing and patient identifiers are not stored here.",
    }


@router.get("/admin-summary", dependencies=[Depends(require_roles("Manager"))])
def admin_summary(db: Session = Depends(get_db)):
    purchases = db.query(PurchaseRequest).all()
    transactions = db.query(BusinessTransaction).all()
    claims = db.query(InsuranceClaimBatch).all()
    invoices = db.query(SupplierInvoice).all()
    payments = db.query(SupplierPayment).all()
    budgets = db.query(BusinessBudget).filter(BusinessBudget.status == "Active").all()
    allocated = sum(row.allocated_amount or 0 for row in budgets)
    paid = sum(row.amount or 0 for row in transactions if row.transaction_type == "Expense" and row.status == "Paid")
    approved_claims = sum(row.approved_amount or 0 for row in claims)
    received_claims = sum(row.received_amount or 0 for row in claims)
    invoice_map = {row.id: row for row in invoices}
    vendor_map = {row.id: row for row in db.query(BusinessVendor).all()}
    return {
        "allocated_budget": _money(allocated),
        "paid_spend": _money(paid),
        "remaining_budget": _money(allocated - paid),
        "pending_purchase_count": sum(row.status == "Submitted" for row in purchases),
        "pending_purchase_amount": _money(sum(row.total_amount or 0 for row in purchases if row.status == "Submitted")),
        "insurance_outstanding": _money(max(approved_claims - received_claims, 0)),
        "supplier_outstanding": _money(sum((max(_money(row.approved_amount) - _money(row.paid_amount), Decimal("0")) for row in invoices), Decimal("0"))),
        "pending_payment_approvals": sum(row.status == "Pending Approval" for row in payments),
        "recent_pending": [_purchase_row(row) for row in sorted((item for item in purchases if item.status == "Submitted"), key=lambda item: item.requested_at, reverse=True)[:5]],
        "recent_pending_payments": [
            _payment_row(row, invoice_map.get(row.invoice_id), vendor_map.get(invoice_map[row.invoice_id].vendor_id) if row.invoice_id in invoice_map else None)
            for row in sorted((item for item in payments if item.status == "Pending Approval"), key=lambda item: item.requested_at, reverse=True)[:5]
        ],
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
    if data.status == "Paid" and db.query(SupplierInvoice).filter(SupplierInvoice.purchase_id == row.id).first():
        raise HTTPException(status_code=409, detail="This purchase has supplier invoices. Complete its approved invoice payments instead.")
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


@router.post("/vendors")
def create_vendor(data: VendorInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    duplicate = db.query(BusinessVendor).filter(BusinessVendor.vendor_code == data.vendor_code).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="That vendor code already exists.")
    row = BusinessVendor(**data.model_dump(), created_by=current_user.username)
    db.add(row)
    record_security_event(db, "business.vendor.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="business_vendor", target_id=row.vendor_code, commit=False)
    db.commit()
    db.refresh(row)
    return _vendor_row(row)


@router.put("/vendors/{vendor_id}")
def update_vendor(vendor_id: int, data: VendorInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(BusinessVendor, vendor_id)
    if not row:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    duplicate = db.query(BusinessVendor).filter(BusinessVendor.vendor_code == data.vendor_code, BusinessVendor.id != vendor_id).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="That vendor code already exists.")
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    record_security_event(db, "business.vendor.updated", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="business_vendor", target_id=row.vendor_code, details={"status": row.status}, commit=False)
    db.commit()
    return _vendor_row(row)


@router.post("/purchases/{purchase_id}/quotations")
def create_quotation(purchase_id: int, data: QuotationInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    purchase = db.get(PurchaseRequest, purchase_id)
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase request not found.")
    if purchase.status not in {"Submitted", "Approved"}:
        raise HTTPException(status_code=409, detail="Quotations can only be collected before a purchase is ordered.")
    vendor = db.get(BusinessVendor, data.vendor_id)
    if not vendor or vendor.status != "Active":
        raise HTTPException(status_code=404, detail="Select an active vendor.")
    if db.query(SupplierQuotation).filter(SupplierQuotation.vendor_id == data.vendor_id, SupplierQuotation.quote_number == data.quote_number).first():
        raise HTTPException(status_code=409, detail="That quotation number already exists for this vendor.")
    values = data.model_dump()
    total = _money(data.quantity * data.unit_price + data.tax_amount + data.freight_amount - data.discount_amount)
    if total < 0:
        raise HTTPException(status_code=422, detail="Quotation total cannot be negative.")
    row = SupplierQuotation(**values, purchase_id=purchase.id, total_amount=total, created_by=current_user.username)
    db.add(row)
    record_security_event(db, "business.quotation.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_quotation", target_id=data.quote_number, details={"purchase": purchase.request_number, "vendor": vendor.vendor_name, "total": total}, commit=False)
    db.commit()
    db.refresh(row)
    quotations = db.query(SupplierQuotation).filter(SupplierQuotation.purchase_id == purchase.id).all()
    lowest = min((_money(item.total_amount) for item in quotations), default=total)
    vendors = {item.id: item for item in db.query(BusinessVendor).filter(BusinessVendor.id.in_([item.vendor_id for item in quotations])).all()}
    return _quotation_row(row, vendor, lowest, _quotation_evaluations(quotations, vendors).get(row.id))


@router.patch("/quotations/{quotation_id}/select", dependencies=[Depends(require_roles("Manager"))])
def select_quotation(quotation_id: int, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(SupplierQuotation, quotation_id)
    if not row:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    purchase = db.get(PurchaseRequest, row.purchase_id)
    vendor = db.get(BusinessVendor, row.vendor_id)
    if not purchase or purchase.status not in {"Submitted", "Approved"}:
        raise HTTPException(status_code=409, detail="A quotation cannot be selected after the purchase is ordered.")
    for quotation in db.query(SupplierQuotation).filter(SupplierQuotation.purchase_id == purchase.id).all():
        quotation.status = "Selected" if quotation.id == row.id else "Not Selected"
        quotation.selected_by = current_user.username if quotation.id == row.id else None
        quotation.selected_at = datetime.now() if quotation.id == row.id else None
    purchase.vendor_name = vendor.vendor_name
    purchase.quantity = row.quantity
    purchase.unit_cost = row.unit_price
    purchase.total_amount = row.total_amount
    record_security_event(db, "business.quotation.selected", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_quotation", target_id=row.quote_number, details={"purchase": purchase.request_number, "vendor": vendor.vendor_name, "total": row.total_amount}, commit=False)
    db.commit()
    quotations = db.query(SupplierQuotation).filter(SupplierQuotation.purchase_id == purchase.id).all()
    vendors = {item.id: item for item in db.query(BusinessVendor).filter(BusinessVendor.id.in_([item.vendor_id for item in quotations])).all()}
    lowest = min((_money(item.total_amount) for item in quotations), default=_money(row.total_amount))
    return _quotation_row(row, vendor, lowest, _quotation_evaluations(quotations, vendors).get(row.id))


@router.post("/invoices")
def create_supplier_invoice(data: InvoiceInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    purchase = db.get(PurchaseRequest, data.purchase_id)
    vendor = db.get(BusinessVendor, data.vendor_id)
    if not purchase or purchase.status not in {"Approved", "Ordered", "Received"}:
        raise HTTPException(status_code=409, detail="The invoice must reference an approved, ordered or received purchase.")
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    quotation = db.get(SupplierQuotation, data.quotation_id) if data.quotation_id else None
    if quotation and (quotation.purchase_id != purchase.id or quotation.vendor_id != vendor.id):
        raise HTTPException(status_code=422, detail="The selected quotation does not match this purchase and vendor.")
    if db.query(SupplierInvoice).filter(SupplierInvoice.vendor_id == vendor.id, SupplierInvoice.invoice_number == data.invoice_number).first():
        raise HTTPException(status_code=409, detail="That supplier invoice is already recorded for this vendor.")
    total = _money(data.subtotal_amount + data.tax_amount - data.discount_amount)
    if total < 0:
        raise HTTPException(status_code=422, detail="Invoice total cannot be negative.")
    existing_total = sum((item.total_amount for item in db.query(SupplierInvoice).filter(SupplierInvoice.purchase_id == purchase.id, SupplierInvoice.status.notin_(["Rejected", "Cancelled"])).all()), Decimal("0"))
    if _money(existing_total + total) > _money(purchase.total_amount):
        raise HTTPException(status_code=422, detail="Supplier invoices cannot exceed the approved purchase value.")
    row = SupplierInvoice(**data.model_dump(), total_amount=total, created_by=current_user.username)
    db.add(row)
    record_security_event(db, "business.invoice.submitted", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_invoice", target_id=data.invoice_number, details={"purchase": purchase.request_number, "vendor": vendor.vendor_name, "total": total}, commit=False)
    db.commit()
    db.refresh(row)
    return _invoice_row(row, vendor, purchase)


@router.patch("/invoices/{invoice_id}/decision", dependencies=[Depends(require_roles("Manager"))])
def decide_supplier_invoice(invoice_id: int, data: InvoiceDecision, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(SupplierInvoice, invoice_id)
    if not row:
        raise HTTPException(status_code=404, detail="Supplier invoice not found.")
    if row.status != "Submitted":
        raise HTTPException(status_code=409, detail="Only submitted invoices can be reviewed.")
    approved = _money(data.approved_amount or row.total_amount) if data.decision == "Approved" else Decimal("0.00")
    if approved > _money(row.total_amount):
        raise HTTPException(status_code=422, detail="Approved amount cannot exceed the invoice total.")
    row.status = data.decision
    row.approved_amount = approved
    row.approved_by = current_user.username
    row.approval_note = data.note
    row.approved_at = datetime.now()
    record_security_event(db, f"business.invoice.{data.decision.casefold()}", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_invoice", target_id=row.invoice_number, details={"approved_amount": approved}, commit=False)
    db.commit()
    return _invoice_row(row, db.get(BusinessVendor, row.vendor_id), db.get(PurchaseRequest, row.purchase_id))


@router.post("/invoices/{invoice_id}/payments")
def request_supplier_payment(invoice_id: int, data: PaymentRequestInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invoice = db.get(SupplierInvoice, invoice_id)
    if not invoice or invoice.status not in {"Approved", "Partially Paid"}:
        raise HTTPException(status_code=409, detail="Payments can only be requested for approved invoices.")
    reserved = sum((item.amount for item in db.query(SupplierPayment).filter(SupplierPayment.invoice_id == invoice.id, SupplierPayment.status.in_(["Pending Approval", "Approved"])).all()), Decimal("0"))
    available = _money(invoice.approved_amount) - _money(invoice.paid_amount) - _money(reserved)
    if _money(data.amount) > available:
        raise HTTPException(status_code=422, detail=f"Payment exceeds the unreserved invoice balance of {available}.")
    row = SupplierPayment(**data.model_dump(), invoice_id=invoice.id, reference_number=_reference("PAYREQ"), requested_by=current_user.username)
    db.add(row)
    record_security_event(db, "business.payment.requested", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_payment", target_id=row.reference_number, details={"invoice": invoice.invoice_number, "amount": row.amount}, commit=False)
    db.commit()
    db.refresh(row)
    return _payment_row(row, invoice, db.get(BusinessVendor, invoice.vendor_id))


@router.patch("/payments/{payment_id}/decision", dependencies=[Depends(require_roles("Manager"))])
def decide_supplier_payment(payment_id: int, data: PaymentDecision, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(SupplierPayment, payment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Supplier payment request not found.")
    if row.status != "Pending Approval":
        raise HTTPException(status_code=409, detail="Only pending payment requests can be reviewed.")
    row.status = data.decision
    row.approval_note = data.note
    row.approved_by = current_user.username
    row.reviewed_at = datetime.now()
    record_security_event(db, f"business.payment.{data.decision.casefold()}", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_payment", target_id=row.reference_number, details={"amount": row.amount}, commit=False)
    db.commit()
    invoice = db.get(SupplierInvoice, row.invoice_id)
    return _payment_row(row, invoice, db.get(BusinessVendor, invoice.vendor_id))


@router.patch("/payments/{payment_id}/complete")
def complete_supplier_payment(payment_id: int, data: PaymentCompletion, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(SupplierPayment, payment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Supplier payment request not found.")
    if row.status != "Approved":
        raise HTTPException(status_code=409, detail="The payment must be approved before it is completed.")
    invoice = db.get(SupplierInvoice, row.invoice_id)
    vendor = db.get(BusinessVendor, invoice.vendor_id)
    purchase = db.get(PurchaseRequest, invoice.purchase_id)
    row.status = "Paid"
    row.paid_date = data.paid_date
    row.payment_method = data.payment_method
    row.bank_reference = data.bank_reference
    row.completed_by = current_user.username
    row.completed_at = datetime.now()
    invoice.paid_amount = _money(invoice.paid_amount) + _money(row.amount)
    invoice.status = "Paid" if _money(invoice.paid_amount) >= _money(invoice.approved_amount) else "Partially Paid"
    transaction = BusinessTransaction(
        reference_number=_reference("PAY"), transaction_type="Expense", category=purchase.category,
        department=purchase.department, counterparty=vendor.vendor_name,
        description=f"Supplier payment {row.reference_number} for invoice {invoice.invoice_number}",
        amount=row.amount, transaction_date=data.paid_date, status="Paid", payment_method=data.payment_method,
        invoice_number=invoice.invoice_number, budget_id=purchase.budget_id,
        source_type="supplier_payment", source_id=row.id, created_by=current_user.username,
        approved_by=row.approved_by,
    )
    db.add(transaction)
    related = db.query(SupplierInvoice).filter(SupplierInvoice.purchase_id == purchase.id).all()
    if related and all(item.status == "Paid" for item in related) and _money(sum((item.approved_amount for item in related), Decimal("0"))) >= _money(purchase.total_amount):
        purchase.status = "Paid"
        purchase.paid_at = datetime.now()
    record_security_event(db, "business.payment.completed", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_payment", target_id=row.reference_number, details={"invoice": invoice.invoice_number, "amount": row.amount, "bank_reference": data.bank_reference}, commit=False)
    db.commit()
    return _payment_row(row, invoice, vendor)


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


BUSINESS_DOCUMENT_RECORDS = {
    "purchase": PurchaseRequest,
    "vendor": BusinessVendor,
    "quotation": SupplierQuotation,
    "invoice": SupplierInvoice,
    "payment": SupplierPayment,
}
BUSINESS_DOCUMENT_TYPES = {"Quotation", "Invoice", "Purchase Order", "Delivery Note", "Receipt", "Contract", "Tax Document", "Other"}


def _business_record(db: Session, record_type: str, record_id: int):
    model = BUSINESS_DOCUMENT_RECORDS.get(record_type)
    if not model:
        raise HTTPException(status_code=422, detail="Unsupported business document record type.")
    row = db.get(model, record_id)
    if not row:
        raise HTTPException(status_code=404, detail="The linked business record was not found.")
    return row


def _document_row(row: BusinessDocument) -> dict:
    return {
        "id": row.id,
        "record_type": row.record_type,
        "record_id": row.record_id,
        "document_type": row.document_type,
        "original_name": row.original_name,
        "content_type": row.content_type,
        "original_size_bytes": row.original_size_bytes,
        "stored_size_bytes": row.stored_size_bytes,
        "uploaded_by": row.uploaded_by,
        "uploaded_at": _iso(row.uploaded_at),
        "download_url": f"/api/business/document-files/{row.id}/download",
    }


@router.get("/documents/{record_type}/{record_id}")
def list_business_documents(record_type: str, record_id: int, db: Session = Depends(get_db)):
    _business_record(db, record_type, record_id)
    rows = db.query(BusinessDocument).filter(BusinessDocument.record_type == record_type, BusinessDocument.record_id == record_id).order_by(BusinessDocument.uploaded_at.desc()).all()
    return [_document_row(row) for row in rows]


@router.post("/documents/{record_type}/{record_id}")
async def upload_business_document(
    record_type: str,
    record_id: int,
    request: WebRequest,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _business_record(db, record_type, record_id)
    if document_type not in BUSINESS_DOCUMENT_TYPES:
        raise HTTPException(status_code=422, detail="Select a supported business document type.")
    count = db.query(BusinessDocument).filter(BusinessDocument.record_type == record_type, BusinessDocument.record_id == record_id).count()
    if count >= 30:
        raise HTTPException(status_code=409, detail="This business record has reached its 30-document limit.")
    original_name = Path(file.filename or "business-document").name[:240]
    raw = await file.read()
    optimized, content_type, _extension = await run_in_threadpool(optimize_attachment, original_name, file.content_type or "", raw)
    row = BusinessDocument(
        record_type=record_type, record_id=record_id, document_type=document_type,
        original_name=original_name, content_type=content_type,
        original_size_bytes=len(raw), stored_size_bytes=len(optimized), file_data=optimized,
        uploaded_by=current_user.username,
    )
    db.add(row)
    record_security_event(db, "business.document.uploaded", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type=f"business_{record_type}", target_id=record_id, details={"document_type": document_type, "name": original_name}, commit=False)
    db.commit()
    db.refresh(row)
    return _document_row(row)


@router.get("/document-files/{document_id}/download")
def download_business_document(document_id: int, db: Session = Depends(get_db)):
    row = db.get(BusinessDocument, document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Business document not found.")
    return Response(
        content=row.file_data,
        media_type=row.content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(row.original_name, safe='')}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/documents/{document_id}")
def delete_business_document(document_id: int, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(BusinessDocument, document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Business document not found.")
    record_security_event(db, "business.document.deleted", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type=f"business_{row.record_type}", target_id=row.record_id, details={"document_type": row.document_type, "name": row.original_name}, commit=False)
    db.delete(row)
    db.commit()
    return {"success": True}


@router.get("/vendor-outstanding.csv")
def export_vendor_outstanding(db: Session = Depends(get_db)):
    vendors = {row.id: row for row in db.query(BusinessVendor).all()}
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["BioTrack supplier outstanding report"])
    writer.writerow(["Generated", datetime.now().isoformat(timespec="seconds")])
    writer.writerow([])
    writer.writerow(["Vendor code", "Vendor", "Invoice", "Invoice date", "Due date", "Approved", "Paid", "Outstanding", "Status"])
    for row in db.query(SupplierInvoice).order_by(SupplierInvoice.due_date, SupplierInvoice.invoice_number).all():
        outstanding = max(_money(row.approved_amount) - _money(row.paid_amount), Decimal("0"))
        if outstanding <= 0:
            continue
        vendor = vendors.get(row.vendor_id)
        status = "Overdue" if row.due_date < date.today() else row.status
        writer.writerow([vendor.vendor_code if vendor else "", vendor.vendor_name if vendor else "Unknown", row.invoice_number, _iso(row.invoice_date), _iso(row.due_date), _money(row.approved_amount), _money(row.paid_amount), outstanding, status])
    filename = f"biotrack-vendor-outstanding-{date.today().isoformat()}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


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
    vendors = {row.id: row for row in db.query(BusinessVendor).all()}
    for row in db.query(SupplierQuotation).order_by(SupplierQuotation.quote_date.desc()).all():
        vendor = vendors.get(row.vendor_id)
        writer.writerow(["Quotation", row.quote_number, vendor.vendor_name if vendor else "Unknown", f"Purchase #{row.purchase_id}", _money(row.total_amount), row.status, _iso(row.quote_date)])
    for row in db.query(SupplierInvoice).order_by(SupplierInvoice.invoice_date.desc()).all():
        vendor = vendors.get(row.vendor_id)
        writer.writerow(["Supplier invoice", row.invoice_number, vendor.vendor_name if vendor else "Unknown", f"Outstanding {_money(row.approved_amount - row.paid_amount)}", _money(row.total_amount), row.status, _iso(row.invoice_date)])
    for row in db.query(SupplierPayment).order_by(SupplierPayment.requested_at.desc()).all():
        writer.writerow(["Supplier payment", row.reference_number, f"Invoice #{row.invoice_id}", row.payment_method, _money(row.amount), row.status, _iso(row.paid_date or row.requested_payment_date)])
    for row in db.query(BusinessTransaction).order_by(BusinessTransaction.transaction_date.desc()).all():
        writer.writerow([row.transaction_type, row.reference_number, row.department, row.category, _money(row.amount), row.status, _iso(row.transaction_date)])
    policies = {row.id: row for row in db.query(InsurancePolicy).all()}
    for row in db.query(InsuranceClaimBatch).order_by(InsuranceClaimBatch.created_at.desc()).all():
        policy = policies.get(row.policy_id)
        writer.writerow(["Claim batch", row.batch_reference, policy.provider_name if policy else "Unknown", policy.policy_name if policy else "", _money(row.claimed_amount), row.status, _iso(row.service_period_end)])
    filename = f"biotrack-business-report-{date.today().isoformat()}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
