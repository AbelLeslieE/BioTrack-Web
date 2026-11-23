"""Idempotent links from Business Office approvals into the native ledger."""

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from backend.models.accounting import FinanceAccount, FinanceCompany, FinanceJournalEntry, FinanceJournalLine
from backend.services.accounting_service import money


class AccountingPostingError(ValueError):
    """Raised when configured books cannot accept an operational posting."""


def _configured_company(db: Session) -> FinanceCompany | None:
    companies = db.query(FinanceCompany).filter(FinanceCompany.status == "Active").order_by(FinanceCompany.id).limit(2).all()
    if not companies:
        return None
    if len(companies) > 1:
        raise AccountingPostingError("More than one active finance company exists; select company mapping before automatic posting.")
    return companies[0]


def _accounts(db: Session, company_id: int, keys: set[str]) -> dict[str, FinanceAccount]:
    rows = db.query(FinanceAccount).filter(
        FinanceAccount.company_id == company_id,
        FinanceAccount.system_key.in_(keys),
        FinanceAccount.status == "Active",
    ).all()
    result = {row.system_key: row for row in rows}
    missing = sorted(keys - set(result))
    if missing:
        raise AccountingPostingError(f"Initialize the finance chart of accounts before posting ({', '.join(missing)} missing).")
    return result


def _post(
    db: Session,
    *,
    company: FinanceCompany,
    entry_date,
    entry_type: str,
    narration: str,
    source_type: str,
    source_id: int,
    actor: str,
    approved_by: str | None,
    lines: list[dict],
) -> FinanceJournalEntry:
    existing = db.query(FinanceJournalEntry).filter(
        FinanceJournalEntry.source_type == source_type,
        FinanceJournalEntry.source_id == source_id,
    ).first()
    if existing:
        return existing
    if entry_date < company.books_start_date:
        raise AccountingPostingError("The transaction date is before the configured books start date.")
    if company.lock_date and entry_date <= company.lock_date:
        raise AccountingPostingError("The accounting period for this transaction is locked.")
    total_debit = money(sum((money(item.get("debit")) for item in lines), Decimal("0")))
    total_credit = money(sum((money(item.get("credit")) for item in lines), Decimal("0")))
    if total_debit <= 0 or total_debit != total_credit:
        raise AccountingPostingError("Automatic accounting posting is not balanced.")
    now = datetime.now()
    journal = FinanceJournalEntry(
        company_id=company.id,
        reference_number=f"AUTO-{entry_date.year}-{uuid4().hex[:8].upper()}",
        entry_date=entry_date,
        entry_type=entry_type,
        narration=narration,
        status="Submitted",
        source_type=source_type,
        source_id=source_id,
        total_debit=total_debit,
        total_credit=total_credit,
        created_by=actor,
        approved_by=approved_by,
        submitted_by=actor,
        submitted_at=now,
    )
    db.add(journal)
    db.flush()
    for number, item in enumerate(lines, start=1):
        db.add(FinanceJournalLine(
            journal_entry_id=journal.id,
            line_number=number,
            account_id=item["account_id"],
            description=item.get("description", narration),
            party_type=item.get("party_type", ""),
            party_reference=item.get("party_reference", ""),
            debit=money(item.get("debit")),
            credit=money(item.get("credit")),
            tax_component=item.get("tax_component", ""),
        ))
    return journal


def post_approved_supplier_invoice(db: Session, invoice, purchase, vendor, actor: str) -> FinanceJournalEntry | None:
    company = _configured_company(db)
    if not company:
        return None
    expense_key = "FIXED_ASSETS" if any(word in (purchase.category or "").casefold() for word in ("asset", "equipment", "capital")) else "PURCHASE_EXPENSE"
    required = {expense_key, "INPUT_GST", "ACCOUNTS_PAYABLE"}
    accounts = _accounts(db, company.id, required)
    approved = money(invoice.approved_amount)
    ratio = approved / money(invoice.total_amount) if money(invoice.total_amount) else Decimal("0")
    tax = min(money(money(invoice.tax_amount) * ratio), approved)
    net = money(approved - tax)
    lines = []
    if net:
        lines.append({"account_id": accounts[expense_key].id, "debit": net, "description": purchase.item_name})
    if tax:
        lines.append({"account_id": accounts["INPUT_GST"].id, "debit": tax, "description": f"Input GST on {invoice.invoice_number}"})
    lines.append({
        "account_id": accounts["ACCOUNTS_PAYABLE"].id,
        "credit": approved,
        "description": f"Payable to {vendor.vendor_name}",
        "party_type": "Vendor",
        "party_reference": vendor.vendor_code,
    })
    return _post(
        db,
        company=company,
        entry_date=invoice.invoice_date,
        entry_type="Purchase",
        narration=f"Approved supplier invoice {invoice.invoice_number} from {vendor.vendor_name}",
        source_type="supplier_invoice",
        source_id=invoice.id,
        actor=actor,
        approved_by=invoice.approved_by,
        lines=lines,
    )


def post_completed_supplier_payment(db: Session, payment, invoice, vendor, actor: str) -> FinanceJournalEntry | None:
    company = _configured_company(db)
    if not company:
        return None
    accounts = _accounts(db, company.id, {"ACCOUNTS_PAYABLE", "BANK"})
    amount = money(payment.amount)
    return _post(
        db,
        company=company,
        entry_date=payment.paid_date,
        entry_type="Payment",
        narration=f"Supplier payment {payment.reference_number} for invoice {invoice.invoice_number}",
        source_type="supplier_payment",
        source_id=payment.id,
        actor=actor,
        approved_by=payment.approved_by,
        lines=[
            {"account_id": accounts["ACCOUNTS_PAYABLE"].id, "debit": amount, "party_type": "Vendor", "party_reference": vendor.vendor_code},
            {"account_id": accounts["BANK"].id, "credit": amount, "description": payment.bank_reference},
        ],
    )
