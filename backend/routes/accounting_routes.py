"""Native BioTrack accounting API with balanced journals and GST previews."""

from datetime import date, datetime, timedelta
from decimal import Decimal
import hashlib
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request as WebRequest
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models.accounting import (
    FinanceAccount,
    FinanceBankAccount,
    FinanceBankTransaction,
    FinanceCompany,
    FinanceCostCenter,
    FinanceJournalEntry,
    FinanceJournalLine,
    FinanceTaxTemplate,
)
from backend.models.user import User
from backend.schemas.accounting_schema import (
    AccountInput,
    BankAccountInput,
    BankReconciliationDecision,
    BankTransactionImport,
    CompanyInput,
    CostCenterInput,
    GSTCalculationInput,
    JournalDecision,
    JournalEntryInput,
    TaxTemplateInput,
)
from backend.services.accounting_service import calculate_gst, money, validate_balanced_lines
from backend.services.security_service import record_security_event


router = APIRouter(
    prefix="/api/finance",
    tags=["native-finance"],
    dependencies=[Depends(require_roles("Business", "Manager"))],
)


DEFAULT_ACCOUNTS = (
    ("1000", "Cash on Hand", "Asset", "Debit", "CASH"),
    ("1010", "Bank Accounts", "Asset", "Debit", "BANK"),
    ("1100", "Accounts Receivable", "Asset", "Debit", "ACCOUNTS_RECEIVABLE"),
    ("1200", "Input GST Credit", "Asset", "Debit", "INPUT_GST"),
    ("1300", "Medical Equipment and Other Assets", "Asset", "Debit", "FIXED_ASSETS"),
    ("2000", "Accounts Payable", "Liability", "Credit", "ACCOUNTS_PAYABLE"),
    ("2100", "Output CGST Payable", "Liability", "Credit", "OUTPUT_CGST"),
    ("2110", "Output SGST Payable", "Liability", "Credit", "OUTPUT_SGST"),
    ("2120", "Output IGST Payable", "Liability", "Credit", "OUTPUT_IGST"),
    ("2200", "Tax Deducted at Source Payable", "Liability", "Credit", "TDS_PAYABLE"),
    ("3000", "Capital and General Fund", "Equity", "Credit", "GENERAL_FUND"),
    ("3100", "Retained Earnings", "Equity", "Credit", "RETAINED_EARNINGS"),
    ("4000", "Insurance and Institutional Income", "Income", "Credit", "INSTITUTIONAL_INCOME"),
    ("4100", "Other Hospital Income", "Income", "Credit", "OTHER_INCOME"),
    ("5000", "Medical Equipment and Supply Expense", "Expense", "Debit", "PURCHASE_EXPENSE"),
    ("5100", "Repairs and Maintenance Expense", "Expense", "Debit", "MAINTENANCE_EXPENSE"),
    ("5200", "Administrative and Operating Expense", "Expense", "Debit", "OPERATING_EXPENSE"),
)


def _iso(value):
    return value.isoformat() if value else None


def _company_row(row: FinanceCompany) -> dict:
    return {
        "id": row.id,
        "company_code": row.company_code,
        "legal_name": row.legal_name,
        "base_currency": row.base_currency,
        "country": row.country,
        "state_code": row.state_code,
        "gstin": row.gstin,
        "fiscal_year_start": _iso(row.fiscal_year_start),
        "fiscal_year_end": _iso(row.fiscal_year_end),
        "books_start_date": _iso(row.books_start_date),
        "lock_date": _iso(row.lock_date),
        "status": row.status,
    }


def _account_row(row: FinanceAccount) -> dict:
    return {
        "id": row.id,
        "company_id": row.company_id,
        "parent_id": row.parent_id,
        "account_code": row.account_code,
        "account_name": row.account_name,
        "account_type": row.account_type,
        "normal_balance": row.normal_balance,
        "system_key": row.system_key,
        "is_group": row.is_group,
        "allow_direct_posting": row.allow_direct_posting,
        "status": row.status,
    }


def _journal_row(row: FinanceJournalEntry, lines: list[FinanceJournalLine] | None = None) -> dict:
    result = {
        "id": row.id,
        "company_id": row.company_id,
        "reference_number": row.reference_number,
        "entry_date": _iso(row.entry_date),
        "entry_type": row.entry_type,
        "narration": row.narration,
        "status": row.status,
        "source_type": row.source_type,
        "source_id": row.source_id,
        "reversal_of_id": row.reversal_of_id,
        "review_note": row.review_note,
        "total_debit": money(row.total_debit),
        "total_credit": money(row.total_credit),
        "created_by": row.created_by,
        "approved_by": row.approved_by,
        "submitted_by": row.submitted_by,
        "created_at": _iso(row.created_at),
        "submitted_at": _iso(row.submitted_at),
    }
    if lines is not None:
        result["lines"] = [
            {
                "id": item.id,
                "line_number": item.line_number,
                "account_id": item.account_id,
                "cost_center_id": item.cost_center_id,
                "description": item.description,
                "party_type": item.party_type,
                "party_reference": item.party_reference,
                "debit": money(item.debit),
                "credit": money(item.credit),
                "tax_component": item.tax_component,
            }
            for item in lines
        ]
    return result


@router.get("/dashboard")
def finance_dashboard(db: Session = Depends(get_db)):
    companies = db.query(FinanceCompany).order_by(FinanceCompany.legal_name).all()
    accounts = db.query(FinanceAccount).order_by(FinanceAccount.company_id, FinanceAccount.account_code).all()
    cost_centers = db.query(FinanceCostCenter).order_by(FinanceCostCenter.cost_center_code).all()
    taxes = db.query(FinanceTaxTemplate).order_by(FinanceTaxTemplate.template_code).all()
    journals = db.query(FinanceJournalEntry).order_by(FinanceJournalEntry.entry_date.desc(), FinanceJournalEntry.id.desc()).limit(100).all()
    bank_accounts = db.query(FinanceBankAccount).order_by(FinanceBankAccount.account_name).all()
    bank_transactions = db.query(FinanceBankTransaction).order_by(FinanceBankTransaction.transaction_date.desc(), FinanceBankTransaction.id.desc()).limit(250).all()
    submitted_debit = db.query(func.coalesce(func.sum(FinanceJournalEntry.total_debit), 0)).filter(FinanceJournalEntry.status == "Submitted").scalar()
    return {
        "summary": {
            "companies": len(companies),
            "accounts": len(accounts),
            "cost_centers": len(cost_centers),
            "tax_templates": len(taxes),
            "draft_journals": sum(row.status == "Draft" for row in journals),
            "submitted_journals": sum(row.status == "Submitted" for row in journals),
            "posted_value": money(submitted_debit),
            "bank_accounts": len(bank_accounts),
            "unreconciled_bank_transactions": sum(row.status == "Unmatched" for row in bank_transactions),
        },
        "companies": [_company_row(row) for row in companies],
        "accounts": [_account_row(row) for row in accounts],
        "cost_centers": [
            {
                "id": row.id,
                "company_id": row.company_id,
                "cost_center_code": row.cost_center_code,
                "cost_center_name": row.cost_center_name,
                "department": row.department,
                "status": row.status,
            }
            for row in cost_centers
        ],
        "tax_templates": [
            {
                "id": row.id,
                "company_id": row.company_id,
                "template_code": row.template_code,
                "template_name": row.template_name,
                "gst_rate": row.gst_rate,
                "cess_rate": row.cess_rate,
                "hsn_sac": row.hsn_sac,
                "supply_type": row.supply_type,
                "input_credit_eligible": row.input_credit_eligible,
                "reverse_charge": row.reverse_charge,
                "valid_from": _iso(row.valid_from),
                "valid_to": _iso(row.valid_to),
                "status": row.status,
            }
            for row in taxes
        ],
        "journals": [_journal_row(row) for row in journals],
        "bank_accounts": [
            {
                "id": row.id, "company_id": row.company_id, "ledger_account_id": row.ledger_account_id,
                "account_name": row.account_name, "bank_name": row.bank_name,
                "masked_account_number": row.masked_account_number, "currency": row.currency,
                "opening_balance": money(row.opening_balance), "status": row.status,
            }
            for row in bank_accounts
        ],
        "bank_transactions": [
            {
                "id": row.id, "bank_account_id": row.bank_account_id, "transaction_date": _iso(row.transaction_date),
                "value_date": _iso(row.value_date), "external_reference": row.external_reference,
                "description": row.description, "withdrawal": money(row.withdrawal), "deposit": money(row.deposit),
                "status": row.status, "matched_journal_entry_id": row.matched_journal_entry_id,
                "reconciliation_note": row.reconciliation_note, "reconciled_by": row.reconciled_by,
            }
            for row in bank_transactions
        ],
    }


@router.post("/companies", dependencies=[Depends(require_roles("Manager"))])
def create_finance_company(data: CompanyInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(FinanceCompany).filter(func.lower(FinanceCompany.company_code) == data.company_code.casefold()).first():
        raise HTTPException(status_code=409, detail="That finance company code already exists.")
    values = data.model_dump()
    values["company_code"] = data.company_code.upper()
    row = FinanceCompany(**values, created_by=current_user.username)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="That finance company already exists.") from exc
    record_security_event(db, "finance.company.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_company", target_id=row.company_code, commit=False)
    db.commit()
    db.refresh(row)
    return _company_row(row)


@router.post("/companies/{company_id}/initialize", dependencies=[Depends(require_roles("Manager"))])
def initialize_finance_company(company_id: int, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    company = db.get(FinanceCompany, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Finance company not found.")
    created = 0
    for code, name, account_type, normal_balance, system_key in DEFAULT_ACCOUNTS:
        if db.query(FinanceAccount).filter(FinanceAccount.company_id == company.id, FinanceAccount.account_code == code).first():
            continue
        db.add(FinanceAccount(company_id=company.id, account_code=code, account_name=name, account_type=account_type, normal_balance=normal_balance, system_key=system_key, created_by=current_user.username))
        created += 1
    if not db.query(FinanceCostCenter).filter(FinanceCostCenter.company_id == company.id, FinanceCostCenter.cost_center_code == "HOSP").first():
        db.add(FinanceCostCenter(company_id=company.id, cost_center_code="HOSP", cost_center_name="Hospital-wide", department="Hospital-wide", created_by=current_user.username))
    record_security_event(db, "finance.company.initialized", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_company", target_id=company.company_code, details={"accounts_created": created}, commit=False)
    db.commit()
    return {"status": "ok", "company": _company_row(company), "accounts_created": created}


@router.post("/accounts", dependencies=[Depends(require_roles("Manager"))])
def create_finance_account(data: AccountInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    company = db.get(FinanceCompany, data.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Finance company not found.")
    if data.parent_id:
        parent = db.get(FinanceAccount, data.parent_id)
        if not parent or parent.company_id != company.id or not parent.is_group:
            raise HTTPException(status_code=422, detail="Parent must be a group account in the same company.")
    row = FinanceAccount(**data.model_dump(), created_by=current_user.username)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="That account code already exists for this company.") from exc
    record_security_event(db, "finance.account.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_account", target_id=row.account_code, commit=False)
    db.commit()
    db.refresh(row)
    return _account_row(row)


@router.post("/cost-centers", dependencies=[Depends(require_roles("Manager"))])
def create_cost_center(data: CostCenterInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not db.get(FinanceCompany, data.company_id):
        raise HTTPException(status_code=404, detail="Finance company not found.")
    row = FinanceCostCenter(**data.model_dump(), created_by=current_user.username)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="That cost centre code already exists for this company.") from exc
    record_security_event(db, "finance.cost_center.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_cost_center", target_id=row.cost_center_code, commit=False)
    db.commit()
    db.refresh(row)
    return {"id": row.id, **data.model_dump()}


@router.post("/tax-templates", dependencies=[Depends(require_roles("Manager"))])
def create_tax_template(data: TaxTemplateInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not db.get(FinanceCompany, data.company_id):
        raise HTTPException(status_code=404, detail="Finance company not found.")
    row = FinanceTaxTemplate(**data.model_dump(), created_by=current_user.username)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="That tax template code already exists for this company.") from exc
    record_security_event(db, "finance.tax_template.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_tax_template", target_id=row.template_code, commit=False)
    db.commit()
    db.refresh(row)
    return {"id": row.id, **data.model_dump()}


@router.post("/bank-accounts", dependencies=[Depends(require_roles("Manager"))])
def create_bank_account(data: BankAccountInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    company = db.get(FinanceCompany, data.company_id)
    ledger = db.get(FinanceAccount, data.ledger_account_id)
    if not company or not ledger or ledger.company_id != company.id or ledger.account_type != "Asset" or ledger.is_group:
        raise HTTPException(status_code=422, detail="Select an active asset ledger account from the same company.")
    row = FinanceBankAccount(**data.model_dump(), created_by=current_user.username)
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="That bank or ledger account is already configured.") from exc
    record_security_event(db, "finance.bank_account.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_bank_account", target_id=row.account_name, commit=False)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "account_name": row.account_name, "bank_name": row.bank_name, "ledger_account_id": row.ledger_account_id, "status": row.status}


@router.post("/bank-transactions/import")
def import_bank_transactions(data: BankTransactionImport, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bank = db.get(FinanceBankAccount, data.bank_account_id)
    if not bank or bank.status != "Active":
        raise HTTPException(status_code=404, detail="Active bank account not found.")
    created = []
    duplicates = 0
    for item in data.rows:
        canonical = "|".join((str(bank.id), item.transaction_date.isoformat(), _iso(item.value_date) or "", item.external_reference, item.description, str(money(item.withdrawal)), str(money(item.deposit))))
        import_key = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        if db.query(FinanceBankTransaction.id).filter(FinanceBankTransaction.import_key == import_key).first():
            duplicates += 1
            continue
        row = FinanceBankTransaction(**item.model_dump(), bank_account_id=bank.id, import_key=import_key, imported_by=current_user.username)
        db.add(row)
        created.append(row)
    record_security_event(db, "finance.bank_statement.imported", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_bank_account", target_id=str(bank.id), details={"created": len(created), "duplicates": duplicates}, commit=False)
    db.commit()
    return {"created": len(created), "duplicates_skipped": duplicates}


def _bank_journal_amount(db: Session, journal_id: int, ledger_account_id: int) -> tuple[Decimal, Decimal]:
    result = db.query(
        func.coalesce(func.sum(FinanceJournalLine.debit), 0),
        func.coalesce(func.sum(FinanceJournalLine.credit), 0),
    ).filter(FinanceJournalLine.journal_entry_id == journal_id, FinanceJournalLine.account_id == ledger_account_id).one()
    return money(result[0]), money(result[1])


@router.get("/bank-transactions/{transaction_id}/suggestions")
def bank_reconciliation_suggestions(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.get(FinanceBankTransaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Bank transaction not found.")
    bank = db.get(FinanceBankAccount, transaction.bank_account_id)
    expected_debit, expected_credit = money(transaction.deposit), money(transaction.withdrawal)
    journals = db.query(FinanceJournalEntry).join(
        FinanceJournalLine, FinanceJournalLine.journal_entry_id == FinanceJournalEntry.id
    ).filter(
        FinanceJournalEntry.company_id == bank.company_id,
        FinanceJournalEntry.status == "Submitted",
        FinanceJournalEntry.entry_date >= transaction.transaction_date - timedelta(days=7),
        FinanceJournalEntry.entry_date <= transaction.transaction_date + timedelta(days=7),
        FinanceJournalLine.account_id == bank.ledger_account_id,
    ).distinct().all()
    suggestions = []
    for journal in journals:
        debit, credit = _bank_journal_amount(db, journal.id, bank.ledger_account_id)
        if debit == expected_debit and credit == expected_credit:
            suggestions.append({**_journal_row(journal), "date_difference_days": abs((journal.entry_date - transaction.transaction_date).days)})
    suggestions.sort(key=lambda item: (item["date_difference_days"], item["entry_date"]))
    return {"transaction_id": transaction.id, "suggestions": suggestions}


@router.patch("/bank-transactions/{transaction_id}/reconcile", dependencies=[Depends(require_roles("Manager"))])
def reconcile_bank_transaction(transaction_id: int, data: BankReconciliationDecision, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    transaction = db.get(FinanceBankTransaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Bank transaction not found.")
    bank = db.get(FinanceBankAccount, transaction.bank_account_id)
    if data.action == "Match":
        journal = db.get(FinanceJournalEntry, data.journal_entry_id)
        if not journal or journal.company_id != bank.company_id or journal.status != "Submitted":
            raise HTTPException(status_code=422, detail="Select a submitted journal from the same company.")
        debit, credit = _bank_journal_amount(db, journal.id, bank.ledger_account_id)
        if debit != money(transaction.deposit) or credit != money(transaction.withdrawal):
            raise HTTPException(status_code=422, detail="The journal bank movement does not equal the statement transaction.")
        other = db.query(FinanceBankTransaction).filter(FinanceBankTransaction.matched_journal_entry_id == journal.id, FinanceBankTransaction.id != transaction.id).first()
        if other:
            raise HTTPException(status_code=409, detail="That journal is already reconciled to another bank transaction.")
        transaction.status = "Matched"
        transaction.matched_journal_entry_id = journal.id
    elif data.action == "Ignore":
        transaction.status = "Ignored"
        transaction.matched_journal_entry_id = None
    else:
        transaction.status = "Unmatched"
        transaction.matched_journal_entry_id = None
    transaction.reconciliation_note = data.note
    transaction.reconciled_by = current_user.username
    transaction.reconciled_at = datetime.now()
    record_security_event(db, f"finance.bank_transaction.{data.action.casefold()}", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_bank_transaction", target_id=str(transaction.id), details={"journal_entry_id": transaction.matched_journal_entry_id}, commit=False)
    db.commit()
    return {"id": transaction.id, "status": transaction.status, "matched_journal_entry_id": transaction.matched_journal_entry_id}


@router.post("/gst/calculate")
def preview_gst(data: GSTCalculationInput):
    try:
        return calculate_gst(data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/journals")
def create_journal_entry(data: JournalEntryInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    company = db.get(FinanceCompany, data.company_id)
    if not company or company.status != "Active":
        raise HTTPException(status_code=422, detail="Select an active finance company.")
    if data.entry_date < company.books_start_date:
        raise HTTPException(status_code=422, detail="Entry date is before the company's books start date.")
    if company.lock_date and data.entry_date <= company.lock_date:
        raise HTTPException(status_code=409, detail="That accounting period is locked.")
    if data.source_type and db.query(FinanceJournalEntry).filter(FinanceJournalEntry.source_type == data.source_type, FinanceJournalEntry.source_id == data.source_id).first():
        raise HTTPException(status_code=409, detail="This source record already has a journal entry.")
    try:
        total_debit, total_credit = validate_balanced_lines(data.lines)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    account_ids = {line.account_id for line in data.lines}
    accounts = {row.id: row for row in db.query(FinanceAccount).filter(FinanceAccount.id.in_(account_ids)).all()}
    if len(accounts) != len(account_ids):
        raise HTTPException(status_code=422, detail="One or more journal accounts do not exist.")
    for account in accounts.values():
        if account.company_id != company.id or account.status != "Active" or account.is_group or not account.allow_direct_posting:
            raise HTTPException(status_code=422, detail=f"Account {account.account_code} cannot receive postings.")
    cost_center_ids = {line.cost_center_id for line in data.lines if line.cost_center_id}
    cost_centers = {row.id: row for row in db.query(FinanceCostCenter).filter(FinanceCostCenter.id.in_(cost_center_ids)).all()} if cost_center_ids else {}
    if len(cost_centers) != len(cost_center_ids) or any(row.company_id != company.id or row.status != "Active" for row in cost_centers.values()):
        raise HTTPException(status_code=422, detail="One or more cost centres are invalid for this company.")

    row = FinanceJournalEntry(
        company_id=company.id,
        reference_number=f"JV-{data.entry_date.year}-{uuid4().hex[:8].upper()}",
        entry_date=data.entry_date,
        entry_type=data.entry_type,
        narration=data.narration,
        source_type=data.source_type,
        source_id=data.source_id,
        total_debit=total_debit,
        total_credit=total_credit,
        created_by=current_user.username,
    )
    db.add(row)
    db.flush()
    lines: list[FinanceJournalLine] = []
    for index, line in enumerate(data.lines, start=1):
        item = FinanceJournalLine(
            journal_entry_id=row.id,
            line_number=index,
            account_id=line.account_id,
            cost_center_id=line.cost_center_id,
            description=line.description,
            party_type=line.party_type,
            party_reference=line.party_reference,
            debit=money(line.debit),
            credit=money(line.credit),
            tax_component=line.tax_component,
        )
        db.add(item)
        lines.append(item)
    record_security_event(db, "finance.journal.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_journal", target_id=row.reference_number, details={"debit": total_debit, "credit": total_credit}, commit=False)
    db.commit()
    db.refresh(row)
    return _journal_row(row, lines)


@router.patch("/journals/{journal_id}/decision", dependencies=[Depends(require_roles("Manager"))])
def decide_journal_entry(journal_id: int, data: JournalDecision, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(FinanceJournalEntry, journal_id)
    if not row:
        raise HTTPException(status_code=404, detail="Journal entry not found.")
    if row.status != "Draft":
        raise HTTPException(status_code=409, detail="Only draft journal entries can be reviewed.")
    lines = db.query(FinanceJournalLine).filter(FinanceJournalLine.journal_entry_id == row.id).order_by(FinanceJournalLine.line_number).all()
    try:
        total_debit, total_credit = validate_balanced_lines(lines)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    row.review_note = data.note
    row.approved_by = current_user.username
    if data.decision == "Submit":
        row.status = "Submitted"
        row.submitted_by = current_user.username
        row.submitted_at = datetime.now()
        row.total_debit = total_debit
        row.total_credit = total_credit
    else:
        row.status = "Rejected"
    record_security_event(db, f"finance.journal.{data.decision.casefold()}", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_journal", target_id=row.reference_number, details={"note": data.note}, commit=False)
    db.commit()
    db.refresh(row)
    return _journal_row(row, lines)


@router.get("/trial-balance/{company_id}")
def trial_balance(company_id: int, db: Session = Depends(get_db)):
    company = db.get(FinanceCompany, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Finance company not found.")
    accounts = db.query(FinanceAccount).filter(FinanceAccount.company_id == company.id).order_by(FinanceAccount.account_code).all()
    aggregates = db.query(
        FinanceJournalLine.account_id,
        func.coalesce(func.sum(FinanceJournalLine.debit), 0),
        func.coalesce(func.sum(FinanceJournalLine.credit), 0),
    ).join(FinanceJournalEntry, FinanceJournalEntry.id == FinanceJournalLine.journal_entry_id).filter(
        FinanceJournalEntry.company_id == company.id,
        FinanceJournalEntry.status == "Submitted",
    ).group_by(FinanceJournalLine.account_id).all()
    totals = {account_id: (money(debit), money(credit)) for account_id, debit, credit in aggregates}
    rows = []
    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")
    for account in accounts:
        debit, credit = totals.get(account.id, (Decimal("0.00"), Decimal("0.00")))
        total_debit += debit
        total_credit += credit
        rows.append({**_account_row(account), "debit": debit, "credit": credit, "net_balance": money(debit - credit)})
    return {
        "company": _company_row(company),
        "rows": rows,
        "total_debit": money(total_debit),
        "total_credit": money(total_credit),
        "balanced": money(total_debit) == money(total_credit),
    }


def _account_balances(db: Session, company_id: int, date_from: date | None = None, date_to: date | None = None):
    query = db.query(
        FinanceJournalLine.account_id,
        func.coalesce(func.sum(FinanceJournalLine.debit), 0),
        func.coalesce(func.sum(FinanceJournalLine.credit), 0),
    ).join(FinanceJournalEntry, FinanceJournalEntry.id == FinanceJournalLine.journal_entry_id).filter(
        FinanceJournalEntry.company_id == company_id,
        FinanceJournalEntry.status == "Submitted",
    )
    if date_from:
        query = query.filter(FinanceJournalEntry.entry_date >= date_from)
    if date_to:
        query = query.filter(FinanceJournalEntry.entry_date <= date_to)
    return {account_id: (money(debit), money(credit)) for account_id, debit, credit in query.group_by(FinanceJournalLine.account_id).all()}


@router.get("/financial-statements/{company_id}")
def financial_statements(
    company_id: int,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    company = db.get(FinanceCompany, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Finance company not found.")
    period_start = date_from or company.fiscal_year_start
    period_end = date_to or company.fiscal_year_end
    if period_end < period_start:
        raise HTTPException(status_code=422, detail="Statement end date cannot be before its start date.")
    accounts = db.query(FinanceAccount).filter(FinanceAccount.company_id == company.id).order_by(FinanceAccount.account_code).all()
    period_balances = _account_balances(db, company.id, period_start, period_end)
    closing_balances = _account_balances(db, company.id, None, period_end)

    profit_loss = {"income": [], "expenses": []}
    balance_sheet = {"assets": [], "liabilities": [], "equity": []}
    total_income = Decimal("0.00")
    total_expenses = Decimal("0.00")
    total_assets = Decimal("0.00")
    total_liabilities = Decimal("0.00")
    total_equity = Decimal("0.00")
    cumulative_income = Decimal("0.00")
    cumulative_expenses = Decimal("0.00")

    for account in accounts:
        period_debit, period_credit = period_balances.get(account.id, (Decimal("0.00"), Decimal("0.00")))
        closing_debit, closing_credit = closing_balances.get(account.id, (Decimal("0.00"), Decimal("0.00")))
        period_amount = money(period_debit - period_credit) if account.normal_balance == "Debit" else money(period_credit - period_debit)
        closing_amount = money(closing_debit - closing_credit) if account.normal_balance == "Debit" else money(closing_credit - closing_debit)
        item = {"account_id": account.id, "account_code": account.account_code, "account_name": account.account_name, "amount": period_amount}
        closing_item = {**item, "amount": closing_amount}
        if account.account_type == "Income" and period_amount:
            profit_loss["income"].append(item)
            total_income += period_amount
        elif account.account_type == "Expense" and period_amount:
            profit_loss["expenses"].append(item)
            total_expenses += period_amount
        if account.account_type == "Income":
            cumulative_income += closing_amount
        elif account.account_type == "Expense":
            cumulative_expenses += closing_amount
        elif account.account_type == "Asset" and closing_amount:
            balance_sheet["assets"].append(closing_item)
            total_assets += closing_amount
        elif account.account_type == "Liability" and closing_amount:
            balance_sheet["liabilities"].append(closing_item)
            total_liabilities += closing_amount
        elif account.account_type == "Equity" and closing_amount:
            balance_sheet["equity"].append(closing_item)
            total_equity += closing_amount

    surplus = money(total_income - total_expenses)
    cumulative_earnings = money(cumulative_income - cumulative_expenses)
    equity_with_surplus = money(total_equity + cumulative_earnings)
    return {
        "company": _company_row(company),
        "period": {"from": _iso(period_start), "to": _iso(period_end)},
        "profit_and_loss": {
            **profit_loss,
            "total_income": money(total_income),
            "total_expenses": money(total_expenses),
            "surplus_or_deficit": surplus,
        },
        "balance_sheet": {
            **balance_sheet,
            "current_period_surplus": surplus,
            "cumulative_earnings": cumulative_earnings,
            "total_assets": money(total_assets),
            "total_liabilities": money(total_liabilities),
            "total_equity_before_surplus": money(total_equity),
            "total_equity_and_surplus": equity_with_surplus,
            "liabilities_and_equity": money(total_liabilities + equity_with_surplus),
            "balanced": money(total_assets) == money(total_liabilities + equity_with_surplus),
        },
        "basis": "Submitted journals only; assets and liabilities are cumulative through the statement end date.",
    }


@router.get("/general-ledger/{company_id}")
def general_ledger(
    company_id: int,
    account_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    company = db.get(FinanceCompany, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Finance company not found.")
    accounts = {row.id: row for row in db.query(FinanceAccount).filter(FinanceAccount.company_id == company.id).all()}
    if account_id and account_id not in accounts:
        raise HTTPException(status_code=404, detail="Ledger account not found for this company.")
    query = db.query(FinanceJournalLine, FinanceJournalEntry).join(
        FinanceJournalEntry, FinanceJournalEntry.id == FinanceJournalLine.journal_entry_id
    ).filter(FinanceJournalEntry.company_id == company.id, FinanceJournalEntry.status == "Submitted")
    if account_id:
        query = query.filter(FinanceJournalLine.account_id == account_id)
    if date_from:
        query = query.filter(FinanceJournalEntry.entry_date >= date_from)
    if date_to:
        query = query.filter(FinanceJournalEntry.entry_date <= date_to)
    rows = query.order_by(FinanceJournalLine.account_id, FinanceJournalEntry.entry_date, FinanceJournalEntry.id, FinanceJournalLine.line_number).all()
    running: dict[int, Decimal] = {}
    if date_from:
        opening = _account_balances(db, company.id, None, date_from - timedelta(days=1))
        for target_id, (debit, credit) in opening.items():
            if target_id in accounts and (not account_id or target_id == account_id):
                target = accounts[target_id]
                running[target_id] = money(debit - credit) if target.normal_balance == "Debit" else money(credit - debit)
    entries = []
    for line, journal in rows:
        account = accounts[line.account_id]
        movement = money(line.debit - line.credit) if account.normal_balance == "Debit" else money(line.credit - line.debit)
        running[account.id] = money(running.get(account.id, Decimal("0.00")) + movement)
        entries.append({
            "journal_id": journal.id,
            "reference_number": journal.reference_number,
            "entry_date": _iso(journal.entry_date),
            "entry_type": journal.entry_type,
            "narration": journal.narration,
            "account_id": account.id,
            "account_code": account.account_code,
            "account_name": account.account_name,
            "debit": money(line.debit),
            "credit": money(line.credit),
            "running_balance": running[account.id],
        })
    return {"company": _company_row(company), "entries": entries, "entry_count": len(entries), "opening_balances_included": bool(date_from)}

