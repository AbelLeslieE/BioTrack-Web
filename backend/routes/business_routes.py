"""Business Office API: budgets, procurement, payments and payer settlements."""

import csv
import io
from datetime import date, datetime, timedelta
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
    BusinessContract,
    BusinessBudget,
    BusinessDocument,
    BusinessTransaction,
    BusinessVendor,
    GoodsReceipt,
    InsuranceClaimBatch,
    InsurancePolicy,
    PurchaseOrder,
    PurchaseRequest,
    SupplierInvoice,
    SupplierPayment,
    SupplierQuotation,
    SupplierTaxReconciliation,
)
from backend.models.accounting import FinanceBankAccount, FinanceBankTransaction
from backend.models.central_store import CentralStoreItem
from backend.models.inventory import Inventory
from backend.models.user import User
from backend.models.vendor_contract import VendorServiceHistory
from backend.schemas.business_schema import (
    BudgetInput,
    BusinessContractInput,
    ClaimBatchInput,
    ClaimBatchUpdate,
    GoodsReceiptInput,
    InvoiceDecision,
    InvoiceInput,
    PaymentCompletion,
    PaymentDecision,
    PaymentRequestInput,
    PolicyInput,
    PurchaseDecision,
    PurchaseInput,
    PurchaseOrderInput,
    PurchaseOrderStatusInput,
    PurchaseStatusUpdate,
    QuotationInput,
    TaxReconciliationInput,
    TransactionInput,
    VendorInput,
)
from backend.services.attachment_service import optimize_attachment
from backend.services.accounting_posting_service import (
    AccountingPostingError,
    post_approved_supplier_invoice,
    post_completed_supplier_payment,
)
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
    subtotal = _money(row.quantity * row.unit_price + row.installation_amount + row.freight_amount + row.training_amount)
    result = {
        "id": row.id,
        "purchase_id": row.purchase_id,
        "vendor_id": row.vendor_id,
        "vendor_name": vendor.vendor_name if vendor else "Unknown vendor",
        "vendor_code": vendor.vendor_code if vendor else "",
        "vendor_contact_person": vendor.contact_person if vendor else "",
        "vendor_email": vendor.email if vendor else "",
        "vendor_phone": vendor.phone if vendor else "",
        "vendor_address": vendor.address if vendor else "",
        "vendor_tax_identifier": vendor.tax_identifier if vendor else "",
        "quote_number": row.quote_number,
        "quote_date": _iso(row.quote_date),
        "valid_until": _iso(row.valid_until),
        "quantity": row.quantity,
        "unit_price": _money(row.unit_price),
        "line_amount": _money(row.quantity * row.unit_price),
        "installation_amount": _money(row.installation_amount),
        "installation_details": row.installation_details,
        "training_amount": _money(row.training_amount),
        "training_details": row.training_details,
        "training_included": row.training_included,
        "subtotal_amount": subtotal,
        "tax_rate": _money(row.tax_rate),
        "tax_amount": _money(row.tax_amount),
        "discount_amount": _money(row.discount_amount),
        "freight_amount": _money(row.freight_amount),
        "total_amount": _money(row.total_amount),
        "delivery_days": row.delivery_days,
        "warranty_months": row.warranty_months,
        "payment_terms": row.payment_terms,
        "amc_annual_amount": _money(row.amc_annual_amount),
        "amc_years": row.amc_years,
        "amc_terms": row.amc_terms,
        "additional_conditions": row.additional_conditions,
        "vendor_payment_terms_days": vendor.payment_terms_days if vendor else 0,
        "notes": row.notes,
        "status": row.status,
        "is_lowest": lowest is not None and _money(row.total_amount) == _money(lowest),
        "selected_at": _iso(row.selected_at),
        "updated_at": _iso(row.updated_at),
    }
    result.update(evaluation or {})
    return result


def _invoice_row(row: SupplierInvoice, vendor: BusinessVendor | None = None, purchase: PurchaseRequest | None = None) -> dict:
    approved_payable = _money(row.net_payable_amount) if _money(row.approved_amount) > 0 else Decimal("0")
    outstanding = max(approved_payable - _money(row.paid_amount), Decimal("0"))
    status = "Overdue" if outstanding > 0 and row.due_date < date.today() and row.status in {"Approved", "Partially Paid"} else row.status
    return {
        "id": row.id,
        "purchase_id": row.purchase_id,
        "request_number": purchase.request_number if purchase else "",
        "vendor_id": row.vendor_id,
        "vendor_name": vendor.vendor_name if vendor else "Unknown vendor",
        "quotation_id": row.quotation_id,
        "purchase_order_id": row.purchase_order_id,
        "goods_receipt_id": row.goods_receipt_id,
        "invoice_number": row.invoice_number,
        "invoice_date": _iso(row.invoice_date),
        "due_date": _iso(row.due_date),
        "subtotal_amount": _money(row.subtotal_amount),
        "tax_amount": _money(row.tax_amount),
        "discount_amount": _money(row.discount_amount),
        "total_amount": _money(row.total_amount),
        "approved_amount": _money(row.approved_amount),
        "paid_amount": _money(row.paid_amount),
        "match_status": row.match_status,
        "match_variance_amount": _money(row.match_variance_amount),
        "tds_section": row.tds_section,
        "tds_rate": _money(row.tds_rate),
        "tds_amount": _money(row.tds_amount),
        "net_payable_amount": _money(row.net_payable_amount),
        "outstanding_amount": _money(outstanding),
        "status": status,
        "stored_status": row.status,
        "notes": row.notes,
        "approval_note": row.approval_note,
        "approved_by": row.approved_by,
    }


def _purchase_order_row(row: PurchaseOrder, vendor: BusinessVendor | None = None, purchase: PurchaseRequest | None = None) -> dict:
    return {
        "id": row.id,
        "order_number": row.order_number,
        "purchase_id": row.purchase_id,
        "request_number": purchase.request_number if purchase else "",
        "item_name": purchase.item_name if purchase else "",
        "vendor_id": row.vendor_id,
        "vendor_name": vendor.vendor_name if vendor else "Unknown vendor",
        "quotation_id": row.quotation_id,
        "order_date": _iso(row.order_date),
        "expected_delivery_date": _iso(row.expected_delivery_date),
        "quantity": row.quantity,
        "unit": row.unit,
        "subtotal_amount": _money(row.subtotal_amount),
        "tax_amount": _money(row.tax_amount),
        "discount_amount": _money(row.discount_amount),
        "total_amount": _money(row.total_amount),
        "payment_terms": row.payment_terms,
        "delivery_address": row.delivery_address,
        "terms_and_conditions": row.terms_and_conditions,
        "status": row.status,
        "created_by": row.created_by,
    }


def _goods_receipt_row(row: GoodsReceipt, order: PurchaseOrder | None = None) -> dict:
    return {
        "id": row.id,
        "receipt_number": row.receipt_number,
        "purchase_order_id": row.purchase_order_id,
        "order_number": order.order_number if order else "",
        "received_date": _iso(row.received_date),
        "delivery_note_number": row.delivery_note_number,
        "quantity_received": row.quantity_received,
        "quantity_accepted": row.quantity_accepted,
        "quantity_rejected": row.quantity_rejected,
        "inspection_status": row.inspection_status,
        "received_by": row.received_by,
        "notes": row.notes,
    }


def _contract_row(row: BusinessContract, vendor: BusinessVendor | None = None) -> dict:
    days_to_expiry = (row.end_date - date.today()).days
    effective_status = "Expired" if row.status == "Active" and days_to_expiry < 0 else row.status
    return {
        "id": row.id,
        "contract_number": row.contract_number,
        "vendor_id": row.vendor_id,
        "vendor_name": vendor.vendor_name if vendor else "Unknown vendor",
        "purchase_order_id": row.purchase_order_id,
        "title": row.title,
        "contract_type": row.contract_type,
        "owner_department": row.owner_department,
        "start_date": _iso(row.start_date),
        "end_date": _iso(row.end_date),
        "days_to_expiry": days_to_expiry,
        "total_value": _money(row.total_value),
        "billing_frequency": row.billing_frequency,
        "next_payment_date": _iso(row.next_payment_date),
        "next_payment_amount": _money(row.next_payment_amount),
        "renewal_notice_days": row.renewal_notice_days,
        "response_sla_hours": row.response_sla_hours,
        "service_obligations": row.service_obligations,
        "payment_schedule": row.payment_schedule,
        "status": effective_status,
        "stored_status": row.status,
    }


def _tax_reconciliation_row(row: SupplierTaxReconciliation, invoice: SupplierInvoice | None = None) -> dict:
    return {
        "id": row.id,
        "invoice_id": row.invoice_id,
        "invoice_number": invoice.invoice_number if invoice else "",
        "return_period": row.return_period,
        "supplier_gstin": row.supplier_gstin,
        "gstr2b_status": row.gstr2b_status,
        "taxable_amount": _money(row.taxable_amount),
        "gst_amount": _money(row.gst_amount),
        "eligible_itc_amount": _money(row.eligible_itc_amount),
        "discrepancy_amount": _money(row.discrepancy_amount),
        "notes": row.notes,
        "reconciled_by": row.reconciled_by,
        "reconciled_at": _iso(row.reconciled_at),
    }


def _match_invoice(
    row: SupplierInvoice,
    order: PurchaseOrder | None,
    receipt: GoodsReceipt | None,
    accepted_quantity: Decimal | None = None,
) -> None:
    if not order:
        row.match_status = "Purchase Order Missing"
        row.match_variance_amount = _money(row.total_amount)
        return
    row.match_variance_amount = _money(row.total_amount - order.total_amount)
    if row.vendor_id != order.vendor_id or row.purchase_id != order.purchase_id:
        row.match_status = "Mismatch"
    elif not receipt:
        row.match_status = "Goods Receipt Missing"
    elif receipt.purchase_order_id != order.id or receipt.inspection_status not in {"Accepted", "Partially Accepted"}:
        row.match_status = "Mismatch"
    elif _money(row.total_amount) > _money(order.total_amount) or Decimal(accepted_quantity if accepted_quantity is not None else receipt.quantity_accepted) < Decimal(order.quantity):
        row.match_status = "Mismatch"
    else:
        row.match_status = "Matched"


def _cashflow_forecast(
    invoices: list[SupplierInvoice],
    contracts: list[BusinessContract],
    claims: list[InsuranceClaimBatch],
    bank_accounts: list[FinanceBankAccount],
    bank_transactions: list[FinanceBankTransaction],
) -> dict:
    today = date.today()
    opening_balance = _money(
        sum((row.opening_balance or 0 for row in bank_accounts if row.status == "Active"), Decimal("0"))
        + sum(((row.deposit or 0) - (row.withdrawal or 0) for row in bank_transactions), Decimal("0"))
    )
    items: list[dict] = []
    for row in invoices:
        if row.status not in {"Approved", "Partially Paid"}:
            continue
        payable = _money(row.net_payable_amount or row.approved_amount)
        outstanding = max(payable - _money(row.paid_amount), Decimal("0"))
        if outstanding:
            items.append({"date": max(row.due_date, today), "type": "Supplier invoice", "reference": row.invoice_number, "direction": "Outflow", "amount": outstanding})
    for row in contracts:
        if row.status == "Active" and row.next_payment_date and row.next_payment_amount > 0:
            items.append({"date": max(row.next_payment_date, today), "type": f"{row.contract_type} payment", "reference": row.contract_number, "direction": "Outflow", "amount": _money(row.next_payment_amount)})
    for row in claims:
        outstanding = max(_money(row.approved_amount) - _money(row.received_amount), Decimal("0"))
        if outstanding and row.status in {"Approved", "Partially Paid"} and row.expected_payment_date:
            items.append({"date": max(row.expected_payment_date, today), "type": "Insurance receipt", "reference": row.batch_reference, "direction": "Inflow", "amount": outstanding})

    buckets = [
        {"label": "Next 30 days", "from_day": 0, "to_day": 30},
        {"label": "Days 31–60", "from_day": 31, "to_day": 60},
        {"label": "Days 61–90", "from_day": 61, "to_day": 90},
    ]
    projected = opening_balance
    for bucket in buckets:
        relevant = [item for item in items if bucket["from_day"] <= (item["date"] - today).days <= bucket["to_day"]]
        inflow = _money(sum((item["amount"] for item in relevant if item["direction"] == "Inflow"), Decimal("0")))
        outflow = _money(sum((item["amount"] for item in relevant if item["direction"] == "Outflow"), Decimal("0")))
        projected = _money(projected + inflow - outflow)
        bucket.update({"inflow": inflow, "outflow": outflow, "net": _money(inflow - outflow), "projected_balance": projected})
    return {
        "opening_balance": opening_balance,
        "buckets": buckets,
        "items": [
            {**item, "date": _iso(item["date"]), "amount": _money(item["amount"])}
            for item in sorted(items, key=lambda item: (item["date"], item["direction"], item["reference"]))
            if (item["date"] - today).days <= 90
        ],
    }


def _management_alerts(
    budget_rows: list[dict],
    purchases: list[PurchaseRequest],
    invoices: list[SupplierInvoice],
    contracts: list[BusinessContract],
    claims: list[InsuranceClaimBatch],
    bank_transactions: list[FinanceBankTransaction],
) -> list[dict]:
    today = date.today()
    alerts: list[dict] = []
    for row in budget_rows:
        allocated = _money(row["allocated_amount"])
        available = _money(row["available_amount"])
        if allocated > 0 and available / allocated <= Decimal("0.10"):
            alerts.append({"kind": "Budget", "severity": "Critical" if available <= 0 else "Warning", "title": f"{row['department']} budget nearly exhausted", "detail": f"{row['category']} has {_money(available)} remaining.", "amount": available, "date": None, "record_id": row["id"]})
    for row in invoices:
        payable = _money(row.net_payable_amount or row.approved_amount)
        outstanding = max(payable - _money(row.paid_amount), Decimal("0"))
        if outstanding > 0 and row.due_date < today and row.status in {"Approved", "Partially Paid"}:
            alerts.append({"kind": "Invoice", "severity": "Critical", "title": f"Invoice {row.invoice_number} is overdue", "detail": f"Payment was due {(today - row.due_date).days} days ago.", "amount": outstanding, "date": _iso(row.due_date), "record_id": row.id})
        if row.match_status in {"Mismatch", "Purchase Order Missing", "Goods Receipt Missing"} and row.status not in {"Paid", "Rejected"}:
            alerts.append({"kind": "Three-way match", "severity": "Warning", "title": f"Invoice {row.invoice_number}: {row.match_status}", "detail": "Review the purchase order, receipt and invoice before payment.", "amount": _money(row.total_amount), "date": _iso(row.due_date), "record_id": row.id})
    for row in contracts:
        remaining = (row.end_date - today).days
        if row.status == "Active" and remaining <= row.renewal_notice_days:
            alerts.append({"kind": "Contract", "severity": "Critical" if remaining < 0 else "Warning", "title": f"{row.contract_number} {'expired' if remaining < 0 else 'is nearing renewal'}", "detail": f"{row.title} · {'expired' if remaining < 0 else str(remaining) + ' days remaining'}.", "amount": _money(row.total_value), "date": _iso(row.end_date), "record_id": row.id})
    for row in bank_transactions:
        if row.status == "Unmatched":
            alerts.append({"kind": "Banking", "severity": "Warning", "title": "Unreconciled bank transaction", "detail": row.description or row.external_reference or "Imported bank entry needs review.", "amount": _money(row.withdrawal or row.deposit), "date": _iso(row.transaction_date), "record_id": row.id})
    for row in claims:
        outstanding = max(_money(row.approved_amount) - _money(row.received_amount), Decimal("0"))
        if outstanding and row.expected_payment_date and row.expected_payment_date < today:
            alerts.append({"kind": "Insurance", "severity": "Critical", "title": f"Claim {row.batch_reference} settlement is delayed", "detail": f"Expected {(today - row.expected_payment_date).days} days ago.", "amount": outstanding, "date": _iso(row.expected_payment_date), "record_id": row.id})
    for row in purchases:
        if _money(row.total_amount) >= Decimal("500000") and row.status in {"Submitted", "Approved", "Ordered"}:
            alerts.append({"kind": "Purchase", "severity": "Info", "title": f"Large purchase {row.request_number}", "detail": f"{row.item_name} requires management visibility.", "amount": _money(row.total_amount), "date": _iso(row.requested_at.date()), "record_id": row.id})
    priority = {"Critical": 0, "Warning": 1, "Info": 2}
    return sorted(alerts, key=lambda item: (priority[item["severity"]], item["date"] or "9999-12-31", item["kind"]))[:100]


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
    purchase_orders = db.query(PurchaseOrder).order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.id.desc()).all()
    goods_receipts = db.query(GoodsReceipt).order_by(GoodsReceipt.received_date.desc(), GoodsReceipt.id.desc()).all()
    contracts = db.query(BusinessContract).order_by(BusinessContract.end_date, BusinessContract.contract_number).all()
    tax_reconciliations = db.query(SupplierTaxReconciliation).order_by(SupplierTaxReconciliation.return_period.desc()).all()
    bank_accounts = db.query(FinanceBankAccount).all()
    bank_transactions = db.query(FinanceBankTransaction).all()
    policy_map = {policy.id: policy for policy in policies}
    vendor_map = {vendor.id: vendor for vendor in vendors}
    purchase_map = {purchase.id: purchase for purchase in purchases}
    invoice_map = {invoice.id: invoice for invoice in invoices}
    purchase_order_map = {row.id: row for row in purchase_orders}
    paid_by_purchase: dict[int, Decimal] = {}
    for payment in payments:
        invoice = invoice_map.get(payment.invoice_id)
        if payment.status == "Paid" and invoice:
            paid_by_purchase[invoice.purchase_id] = _money(paid_by_purchase.get(invoice.purchase_id, Decimal("0")) + payment.amount)
    invoice_outstanding = {
        invoice.id: max((_money(invoice.net_payable_amount) if _money(invoice.approved_amount) > 0 else Decimal("0")) - _money(invoice.paid_amount), Decimal("0"))
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
    cashflow = _cashflow_forecast(invoices, contracts, claims, bank_accounts, bank_transactions)
    alerts = _management_alerts(budget_rows, purchases, invoices, contracts, claims, bank_transactions)
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
            "active_contracts": sum(row.status == "Active" and row.end_date >= date.today() for row in contracts),
            "expiring_contracts": sum(row.status == "Active" and row.end_date <= date.today() + timedelta(days=row.renewal_notice_days) for row in contracts),
            "open_purchase_orders": sum(row.status in {"Issued", "Partially Received"} for row in purchase_orders),
            "unmatched_invoices": sum(row.match_status != "Matched" and row.status not in {"Paid", "Rejected"} for row in invoices),
            "pending_gst_reconciliations": sum(row.gstr2b_status != "Matched" for row in tax_reconciliations),
            "management_alerts": len(alerts),
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
        "purchase_orders": [_purchase_order_row(row, vendor_map.get(row.vendor_id), purchase_map.get(row.purchase_id)) for row in purchase_orders[:250]],
        "goods_receipts": [_goods_receipt_row(row, purchase_order_map.get(row.purchase_order_id)) for row in goods_receipts[:250]],
        "contracts": [_contract_row(row, vendor_map.get(row.vendor_id)) for row in contracts[:250]],
        "tax_reconciliations": [_tax_reconciliation_row(row, invoice_map.get(row.invoice_id)) for row in tax_reconciliations[:250]],
        "cashflow_forecast": cashflow,
        "management_alerts": alerts,
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
    contracts = db.query(BusinessContract).all()
    bank_accounts = db.query(FinanceBankAccount).all()
    bank_transactions = db.query(FinanceBankTransaction).all()
    allocated = sum(row.allocated_amount or 0 for row in budgets)
    paid = sum(row.amount or 0 for row in transactions if row.transaction_type == "Expense" and row.status == "Paid")
    approved_claims = sum(row.approved_amount or 0 for row in claims)
    received_claims = sum(row.received_amount or 0 for row in claims)
    invoice_map = {row.id: row for row in invoices}
    vendor_map = {row.id: row for row in db.query(BusinessVendor).all()}
    budget_rows = [_budget_row(row, purchases, transactions) for row in budgets]
    cashflow = _cashflow_forecast(invoices, contracts, claims, bank_accounts, bank_transactions)
    alerts = _management_alerts(budget_rows, purchases, invoices, contracts, claims, bank_transactions)
    return {
        "allocated_budget": _money(allocated),
        "paid_spend": _money(paid),
        "remaining_budget": _money(allocated - paid),
        "pending_purchase_count": sum(row.status == "Submitted" for row in purchases),
        "pending_purchase_amount": _money(sum(row.total_amount or 0 for row in purchases if row.status == "Submitted")),
        "insurance_outstanding": _money(max(approved_claims - received_claims, 0)),
        "supplier_outstanding": _money(sum((max(_money(row.net_payable_amount or row.approved_amount) - _money(row.paid_amount), Decimal("0")) for row in invoices), Decimal("0"))),
        "pending_payment_approvals": sum(row.status == "Pending Approval" for row in payments),
        "management_alert_count": len(alerts),
        "critical_alert_count": sum(row["severity"] == "Critical" for row in alerts),
        "cashflow_30_day_projection": cashflow["buckets"][0]["projected_balance"],
        "management_alerts": alerts[:8],
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
    row = BusinessVendor(vendor_code=f"PENDING-{uuid4().hex}", **data.model_dump(), created_by=current_user.username)
    db.add(row)
    db.flush()
    row.vendor_code = f"VEN-{row.id:03d}"
    record_security_event(db, "business.vendor.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="business_vendor", target_id=row.vendor_code, commit=False)
    db.commit()
    db.refresh(row)
    return _vendor_row(row)


@router.put("/vendors/{vendor_id}")
def update_vendor(vendor_id: int, data: VendorInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(BusinessVendor, vendor_id)
    if not row:
        raise HTTPException(status_code=404, detail="Vendor not found.")
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
    subtotal = _money(data.quantity * data.unit_price + data.installation_amount + data.freight_amount + data.training_amount)
    taxable = _money(subtotal - data.discount_amount)
    if taxable < 0:
        raise HTTPException(status_code=422, detail="Quotation discount cannot exceed the subtotal.")
    tax = _money(data.tax_amount if data.tax_amount > 0 else taxable * data.tax_rate / Decimal("100"))
    values["tax_amount"] = tax
    total = _money(taxable + tax)
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


@router.put("/quotations/{quotation_id}")
def update_quotation(quotation_id: int, data: QuotationInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(SupplierQuotation, quotation_id)
    if not row:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    purchase = db.get(PurchaseRequest, row.purchase_id)
    if not purchase or purchase.status not in {"Submitted", "Approved"}:
        raise HTTPException(status_code=409, detail="A quotation cannot be edited after the purchase is ordered.")
    vendor = db.get(BusinessVendor, data.vendor_id)
    if not vendor or vendor.status != "Active":
        raise HTTPException(status_code=404, detail="Select an active vendor.")
    duplicate = db.query(SupplierQuotation).filter(SupplierQuotation.vendor_id == data.vendor_id, SupplierQuotation.quote_number == data.quote_number, SupplierQuotation.id != quotation_id).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="That quotation number already exists for this vendor.")
    values = data.model_dump()
    subtotal = _money(data.quantity * data.unit_price + data.installation_amount + data.freight_amount + data.training_amount)
    taxable = _money(subtotal - data.discount_amount)
    if taxable < 0:
        raise HTTPException(status_code=422, detail="Quotation discount cannot exceed the subtotal.")
    tax = _money(data.tax_amount if data.tax_amount > 0 else taxable * data.tax_rate / Decimal("100"))
    total = _money(taxable + tax)
    if total < 0:
        raise HTTPException(status_code=422, detail="Quotation total cannot be negative.")
    values["tax_amount"] = tax
    for key, value in values.items():
        setattr(row, key, value)
    row.total_amount = total
    row.updated_at = datetime.now()
    if row.status == "Selected":
        purchase.vendor_name = vendor.vendor_name
        purchase.quantity = row.quantity
        purchase.unit_cost = row.unit_price
        purchase.total_amount = row.total_amount
    record_security_event(db, "business.quotation.updated", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_quotation", target_id=row.quote_number, details={"purchase": purchase.request_number, "vendor": vendor.vendor_name, "total": total}, commit=False)
    db.commit()
    quotations = db.query(SupplierQuotation).filter(SupplierQuotation.purchase_id == purchase.id).all()
    vendors = {item.id: item for item in db.query(BusinessVendor).filter(BusinessVendor.id.in_([item.vendor_id for item in quotations])).all()}
    lowest = min((_money(item.total_amount) for item in quotations), default=total)
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


@router.post("/purchase-orders")
def create_purchase_order(data: PurchaseOrderInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    purchase = db.get(PurchaseRequest, data.purchase_id)
    quotation = db.get(SupplierQuotation, data.quotation_id)
    if not purchase or purchase.status != "Approved":
        raise HTTPException(status_code=409, detail="A purchase order requires an approved purchase request.")
    if not quotation or quotation.purchase_id != purchase.id or quotation.status != "Selected":
        raise HTTPException(status_code=422, detail="Select an approved quotation for this purchase before creating the order.")
    if db.query(PurchaseOrder).filter(PurchaseOrder.purchase_id == purchase.id).first():
        raise HTTPException(status_code=409, detail="This purchase request already has a purchase order.")
    vendor = db.get(BusinessVendor, quotation.vendor_id)
    subtotal = _money(quotation.quantity * quotation.unit_price + quotation.installation_amount + quotation.freight_amount + quotation.training_amount)
    row = PurchaseOrder(
        order_number=_reference("PO"), purchase_id=purchase.id, vendor_id=vendor.id, quotation_id=quotation.id,
        order_date=data.order_date, expected_delivery_date=data.expected_delivery_date,
        quantity=quotation.quantity, unit=purchase.unit, subtotal_amount=subtotal,
        tax_amount=quotation.tax_amount, discount_amount=quotation.discount_amount,
        total_amount=quotation.total_amount, payment_terms=quotation.payment_terms,
        delivery_address=data.delivery_address, terms_and_conditions=data.terms_and_conditions,
        status="Issued", created_by=current_user.username,
    )
    db.add(row)
    purchase.status = "Ordered"
    purchase.ordered_at = datetime.now()
    purchase.vendor_name = vendor.vendor_name
    record_security_event(db, "business.purchase_order.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="purchase_order", target_id=row.order_number, details={"purchase": purchase.request_number, "vendor": vendor.vendor_name, "total": row.total_amount}, commit=False)
    db.commit()
    db.refresh(row)
    return _purchase_order_row(row, vendor, purchase)


@router.patch("/purchase-orders/{order_id}/status")
def update_purchase_order_status(order_id: int, data: PurchaseOrderStatusInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(PurchaseOrder, order_id)
    if not row:
        raise HTTPException(status_code=404, detail="Purchase order not found.")
    allowed = {
        "Issued": {"Partially Received", "Received", "Cancelled"},
        "Partially Received": {"Received", "Cancelled"},
        "Received": {"Closed"},
    }
    if data.status not in allowed.get(row.status, set()):
        raise HTTPException(status_code=409, detail=f"A {row.status} order cannot move to {data.status}.")
    row.status = data.status
    record_security_event(db, "business.purchase_order.status", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="purchase_order", target_id=row.order_number, details={"status": row.status}, commit=False)
    db.commit()
    return _purchase_order_row(row, db.get(BusinessVendor, row.vendor_id), db.get(PurchaseRequest, row.purchase_id))


@router.post("/goods-receipts")
def create_goods_receipt(data: GoodsReceiptInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = db.get(PurchaseOrder, data.purchase_order_id)
    if not order or order.status not in {"Issued", "Partially Received"}:
        raise HTTPException(status_code=409, detail="Goods can only be received against an open purchase order.")
    already_accepted = sum((item.quantity_accepted for item in db.query(GoodsReceipt).filter(GoodsReceipt.purchase_order_id == order.id).all()), Decimal("0"))
    if Decimal(already_accepted) + data.quantity_accepted > Decimal(order.quantity):
        raise HTTPException(status_code=422, detail="Accepted receipts cannot exceed the purchase-order quantity.")
    row = GoodsReceipt(**data.model_dump(), receipt_number=_reference("GRN"), created_by=current_user.username)
    db.add(row)
    db.flush()
    accepted_total = Decimal(already_accepted) + Decimal(row.quantity_accepted)
    order.status = "Received" if accepted_total >= Decimal(order.quantity) else "Partially Received"
    purchase = db.get(PurchaseRequest, order.purchase_id)
    if order.status == "Received":
        purchase.status = "Received"
        purchase.received_at = datetime.now()
    for invoice in db.query(SupplierInvoice).filter(SupplierInvoice.purchase_order_id == order.id).all():
        if not invoice.goods_receipt_id:
            invoice.goods_receipt_id = row.id
        _match_invoice(invoice, order, db.get(GoodsReceipt, invoice.goods_receipt_id), accepted_total)
    record_security_event(db, "business.goods_receipt.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="goods_receipt", target_id=row.receipt_number, details={"purchase_order": order.order_number, "accepted": row.quantity_accepted}, commit=False)
    db.commit()
    db.refresh(row)
    return _goods_receipt_row(row, order)


@router.post("/contracts")
def create_business_contract(data: BusinessContractInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vendor = db.get(BusinessVendor, data.vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    if data.purchase_order_id and not db.get(PurchaseOrder, data.purchase_order_id):
        raise HTTPException(status_code=404, detail="Linked purchase order not found.")
    if db.query(BusinessContract).filter(BusinessContract.contract_number == data.contract_number).first():
        raise HTTPException(status_code=409, detail="That contract number already exists.")
    row = BusinessContract(**data.model_dump(), created_by=current_user.username)
    db.add(row)
    record_security_event(db, "business.contract.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="business_contract", target_id=row.contract_number, details={"vendor": vendor.vendor_name, "end_date": _iso(row.end_date)}, commit=False)
    db.commit()
    db.refresh(row)
    return _contract_row(row, vendor)


@router.put("/contracts/{contract_id}")
def update_business_contract(contract_id: int, data: BusinessContractInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(BusinessContract, contract_id)
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found.")
    vendor = db.get(BusinessVendor, data.vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    duplicate = db.query(BusinessContract).filter(BusinessContract.contract_number == data.contract_number, BusinessContract.id != row.id).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="That contract number already exists.")
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    record_security_event(db, "business.contract.updated", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="business_contract", target_id=row.contract_number, details={"status": row.status, "end_date": _iso(row.end_date)}, commit=False)
    db.commit()
    return _contract_row(row, vendor)


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
    order = db.get(PurchaseOrder, data.purchase_order_id) if data.purchase_order_id else None
    receipt = db.get(GoodsReceipt, data.goods_receipt_id) if data.goods_receipt_id else None
    if order and (order.purchase_id != purchase.id or order.vendor_id != vendor.id):
        raise HTTPException(status_code=422, detail="The purchase order does not match this purchase and vendor.")
    if receipt and (not order or receipt.purchase_order_id != order.id):
        raise HTTPException(status_code=422, detail="The goods receipt must belong to the selected purchase order.")
    total = _money(data.subtotal_amount + data.tax_amount - data.discount_amount)
    if total < 0:
        raise HTTPException(status_code=422, detail="Invoice total cannot be negative.")
    existing_total = sum((item.total_amount for item in db.query(SupplierInvoice).filter(SupplierInvoice.purchase_id == purchase.id, SupplierInvoice.status.notin_(["Rejected", "Cancelled"])).all()), Decimal("0"))
    if _money(existing_total + total) > _money(purchase.total_amount):
        raise HTTPException(status_code=422, detail="Supplier invoices cannot exceed the approved purchase value.")
    taxable_for_tds = max(_money(data.subtotal_amount - data.discount_amount), Decimal("0"))
    tds_amount = _money(taxable_for_tds * data.tds_rate / Decimal("100"))
    row = SupplierInvoice(
        **data.model_dump(), total_amount=total, tds_amount=tds_amount,
        net_payable_amount=_money(total - tds_amount), created_by=current_user.username,
    )
    accepted_total = None
    if order and receipt:
        accepted_total = sum(
            (item.quantity_accepted for item in db.query(GoodsReceipt).filter(GoodsReceipt.purchase_order_id == order.id).all()),
            Decimal("0"),
        )
    _match_invoice(row, order, receipt, accepted_total)
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
    if data.decision == "Approved" and row.purchase_order_id and row.match_status != "Matched":
        raise HTTPException(status_code=409, detail=f"Invoice approval is blocked until its three-way match is resolved ({row.match_status}).")
    approved = _money(data.approved_amount or row.total_amount) if data.decision == "Approved" else Decimal("0.00")
    if approved > _money(row.total_amount):
        raise HTTPException(status_code=422, detail="Approved amount cannot exceed the invoice total.")
    row.status = data.decision
    row.approved_amount = approved
    approved_ratio = approved / _money(row.total_amount) if _money(row.total_amount) else Decimal("0")
    row.tds_amount = _money(_money(row.tds_amount) * approved_ratio) if data.decision == "Approved" else Decimal("0.00")
    row.net_payable_amount = _money(approved - row.tds_amount) if data.decision == "Approved" else Decimal("0.00")
    row.approved_by = current_user.username
    row.approval_note = data.note
    row.approved_at = datetime.now()
    journal = None
    if data.decision == "Approved":
        try:
            journal = post_approved_supplier_invoice(db, row, db.get(PurchaseRequest, row.purchase_id), db.get(BusinessVendor, row.vendor_id), current_user.username)
        except AccountingPostingError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_security_event(db, f"business.invoice.{data.decision.casefold()}", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_invoice", target_id=row.invoice_number, details={"approved_amount": approved, "journal_reference": journal.reference_number if journal else None}, commit=False)
    db.commit()
    return _invoice_row(row, db.get(BusinessVendor, row.vendor_id), db.get(PurchaseRequest, row.purchase_id))


@router.post("/invoices/{invoice_id}/match")
def refresh_invoice_match(invoice_id: int, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(SupplierInvoice, invoice_id)
    if not row:
        raise HTTPException(status_code=404, detail="Supplier invoice not found.")
    order = db.get(PurchaseOrder, row.purchase_order_id) if row.purchase_order_id else None
    receipt = db.get(GoodsReceipt, row.goods_receipt_id) if row.goods_receipt_id else None
    accepted_total = None
    if order and receipt:
        accepted_total = sum(
            (item.quantity_accepted for item in db.query(GoodsReceipt).filter(GoodsReceipt.purchase_order_id == order.id).all()),
            Decimal("0"),
        )
    _match_invoice(row, order, receipt, accepted_total)
    record_security_event(db, "business.invoice.matched", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_invoice", target_id=row.invoice_number, details={"match_status": row.match_status, "variance": row.match_variance_amount}, commit=False)
    db.commit()
    return _invoice_row(row, db.get(BusinessVendor, row.vendor_id), db.get(PurchaseRequest, row.purchase_id))


@router.put("/invoices/{invoice_id}/tax-reconciliation")
def reconcile_supplier_tax(invoice_id: int, data: TaxReconciliationInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invoice = db.get(SupplierInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Supplier invoice not found.")
    vendor = db.get(BusinessVendor, invoice.vendor_id)
    if data.supplier_gstin and vendor and vendor.tax_identifier and data.supplier_gstin.casefold() != vendor.tax_identifier.casefold():
        raise HTTPException(status_code=422, detail="The reconciliation GSTIN does not match the vendor master.")
    row = db.query(SupplierTaxReconciliation).filter(SupplierTaxReconciliation.invoice_id == invoice.id).first()
    values = data.model_dump()
    values["discrepancy_amount"] = _money(data.gst_amount - data.eligible_itc_amount)
    values["reconciled_by"] = current_user.username
    values["reconciled_at"] = datetime.now()
    if row:
        for key, value in values.items():
            setattr(row, key, value)
    else:
        row = SupplierTaxReconciliation(invoice_id=invoice.id, **values)
        db.add(row)
    record_security_event(db, "business.tax_reconciliation.saved", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_invoice", target_id=invoice.invoice_number, details={"status": row.gstr2b_status, "period": row.return_period}, commit=False)
    db.commit()
    db.refresh(row)
    return _tax_reconciliation_row(row, invoice)


@router.post("/invoices/{invoice_id}/payments")
def request_supplier_payment(invoice_id: int, data: PaymentRequestInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invoice = db.get(SupplierInvoice, invoice_id)
    if not invoice or invoice.status not in {"Approved", "Partially Paid"}:
        raise HTTPException(status_code=409, detail="Payments can only be requested for approved invoices.")
    reserved = sum((item.amount for item in db.query(SupplierPayment).filter(SupplierPayment.invoice_id == invoice.id, SupplierPayment.status.in_(["Pending Approval", "Approved"])).all()), Decimal("0"))
    available = _money(invoice.net_payable_amount or invoice.approved_amount) - _money(invoice.paid_amount) - _money(reserved)
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
    invoice.status = "Paid" if _money(invoice.paid_amount) >= _money(invoice.net_payable_amount or invoice.approved_amount) else "Partially Paid"
    try:
        post_approved_supplier_invoice(db, invoice, purchase, vendor, current_user.username)
        journal = post_completed_supplier_payment(db, row, invoice, vendor, current_user.username)
    except AccountingPostingError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
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
    record_security_event(db, "business.payment.completed", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="supplier_payment", target_id=row.reference_number, details={"invoice": invoice.invoice_number, "amount": row.amount, "bank_reference": data.bank_reference, "journal_reference": journal.reference_number if journal else None}, commit=False)
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
    "budget": BusinessBudget,
    "purchase": PurchaseRequest,
    "transaction": BusinessTransaction,
    "vendor": BusinessVendor,
    "quotation": SupplierQuotation,
    "invoice": SupplierInvoice,
    "payment": SupplierPayment,
    "policy": InsurancePolicy,
    "claim": InsuranceClaimBatch,
    "purchase_order": PurchaseOrder,
    "goods_receipt": GoodsReceipt,
    "contract": BusinessContract,
    "tax_reconciliation": SupplierTaxReconciliation,
}
BUSINESS_DOCUMENT_TYPES = {"Quotation", "Invoice", "Purchase Order", "Delivery Note", "Receipt", "Contract", "Tax Document", "Service Report", "Other"}


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
        outstanding = max(_money(row.net_payable_amount or row.approved_amount) - _money(row.paid_amount), Decimal("0"))
        if outstanding <= 0:
            continue
        vendor = vendors.get(row.vendor_id)
        status = "Overdue" if row.due_date < date.today() else row.status
        writer.writerow([vendor.vendor_code if vendor else "", vendor.vendor_name if vendor else "Unknown", row.invoice_number, _iso(row.invoice_date), _iso(row.due_date), _money(row.net_payable_amount or row.approved_amount), _money(row.paid_amount), outstanding, status])
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
    orders = {row.id: row for row in db.query(PurchaseOrder).all()}
    for row in sorted(orders.values(), key=lambda item: (item.order_date, item.id), reverse=True):
        vendor = vendors.get(row.vendor_id)
        writer.writerow(["Purchase order", row.order_number, vendor.vendor_name if vendor else "Unknown", f"Purchase #{row.purchase_id}", _money(row.total_amount), row.status, _iso(row.order_date)])
    for row in db.query(GoodsReceipt).order_by(GoodsReceipt.received_date.desc(), GoodsReceipt.id.desc()).all():
        order = orders.get(row.purchase_order_id)
        writer.writerow(["Goods receipt", row.receipt_number, order.order_number if order else f"PO #{row.purchase_order_id}", f"Accepted {row.quantity_accepted}; rejected {row.quantity_rejected}", Decimal("0.00"), row.inspection_status, _iso(row.received_date)])
    for row in db.query(SupplierInvoice).order_by(SupplierInvoice.invoice_date.desc()).all():
        vendor = vendors.get(row.vendor_id)
        writer.writerow(["Supplier invoice", row.invoice_number, vendor.vendor_name if vendor else "Unknown", f"{row.match_status}; TDS {_money(row.tds_amount)}; net {_money(row.net_payable_amount)}", _money(row.total_amount), row.status, _iso(row.invoice_date)])
    invoice_numbers = {row.id: row.invoice_number for row in db.query(SupplierInvoice).all()}
    for row in db.query(SupplierTaxReconciliation).order_by(SupplierTaxReconciliation.reconciled_at.desc()).all():
        writer.writerow(["GST reconciliation", invoice_numbers.get(row.invoice_id, f"Invoice #{row.invoice_id}"), row.supplier_gstin, f"{row.return_period}; discrepancy {_money(row.discrepancy_amount)}", _money(row.eligible_itc_amount), row.gstr2b_status, _iso(row.reconciled_at)])
    for row in db.query(BusinessContract).order_by(BusinessContract.end_date.desc()).all():
        vendor = vendors.get(row.vendor_id)
        writer.writerow(["Supplier contract", row.contract_number, vendor.vendor_name if vendor else "Unknown", f"{row.contract_type}; {row.billing_frequency}; SLA {row.response_sla_hours}h", _money(row.total_value), row.status, _iso(row.end_date)])
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
    GoodsReceipt,
    PurchaseOrder,
    GoodsReceiptInput,
    PurchaseOrderInput,
    PurchaseOrderStatusInput,
    TaxReconciliationInput,
