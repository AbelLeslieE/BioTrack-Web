"""Native, non-patient accounting records for the BioTrack Business Office.

The models intentionally keep the immutable journal separate from operational
procurement records.  Submitted journal lines are the source of truth for
financial statements; operational rows remain the source for workflow state.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint

from backend.models.base import Base


class FinanceCompany(Base):
    __tablename__ = "finance_companies"

    id = Column(Integer, primary_key=True, index=True)
    company_code = Column(String(20), nullable=False, unique=True, index=True)
    legal_name = Column(String(200), nullable=False)
    base_currency = Column(String(3), nullable=False, default="INR")
    country = Column(String(80), nullable=False, default="India")
    state_code = Column(String(2), nullable=False)
    gstin = Column(String(15), nullable=False, default="")
    fiscal_year_start = Column(Date, nullable=False)
    fiscal_year_end = Column(Date, nullable=False)
    books_start_date = Column(Date, nullable=False)
    lock_date = Column(Date)
    status = Column(String(20), nullable=False, default="Active", index=True)
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class FinanceAccount(Base):
    __tablename__ = "finance_accounts"
    __table_args__ = (
        UniqueConstraint("company_id", "account_code", name="uq_finance_account_code"),
        UniqueConstraint("company_id", "system_key", name="uq_finance_account_system_key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("finance_companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("finance_accounts.id", ondelete="RESTRICT"), index=True)
    account_code = Column(String(30), nullable=False, index=True)
    account_name = Column(String(180), nullable=False)
    account_type = Column(String(20), nullable=False, index=True)
    normal_balance = Column(String(6), nullable=False)
    system_key = Column(String(40))
    is_group = Column(Boolean, nullable=False, default=False)
    allow_direct_posting = Column(Boolean, nullable=False, default=True)
    status = Column(String(20), nullable=False, default="Active", index=True)
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class FinanceCostCenter(Base):
    __tablename__ = "finance_cost_centers"
    __table_args__ = (
        UniqueConstraint("company_id", "cost_center_code", name="uq_finance_cost_center_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("finance_companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    cost_center_code = Column(String(30), nullable=False)
    cost_center_name = Column(String(160), nullable=False)
    department = Column(String(160), nullable=False, default="Hospital-wide", index=True)
    status = Column(String(20), nullable=False, default="Active", index=True)
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class FinanceTaxTemplate(Base):
    __tablename__ = "finance_tax_templates"
    __table_args__ = (
        UniqueConstraint("company_id", "template_code", name="uq_finance_tax_template_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("finance_companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    template_code = Column(String(40), nullable=False)
    template_name = Column(String(160), nullable=False)
    gst_rate = Column(Numeric(7, 4), nullable=False, default=Decimal("0.0000"))
    cess_rate = Column(Numeric(7, 4), nullable=False, default=Decimal("0.0000"))
    hsn_sac = Column(String(20), nullable=False, default="")
    supply_type = Column(String(20), nullable=False, default="Goods")
    input_credit_eligible = Column(Boolean, nullable=False, default=True)
    reverse_charge = Column(Boolean, nullable=False, default=False)
    valid_from = Column(Date, nullable=False)
    valid_to = Column(Date)
    status = Column(String(20), nullable=False, default="Active", index=True)
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class FinanceJournalEntry(Base):
    __tablename__ = "finance_journal_entries"
    __table_args__ = (
        UniqueConstraint("source_type", "source_id", name="uq_finance_journal_source"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("finance_companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    reference_number = Column(String(50), nullable=False, unique=True, index=True)
    entry_date = Column(Date, nullable=False, default=date.today, index=True)
    entry_type = Column(String(30), nullable=False, default="Journal", index=True)
    narration = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="Draft", index=True)
    source_type = Column(String(40))
    source_id = Column(Integer)
    reversal_of_id = Column(Integer, ForeignKey("finance_journal_entries.id", ondelete="RESTRICT"), index=True)
    review_note = Column(Text, nullable=False, default="")
    total_debit = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    total_credit = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    created_by = Column(String(80), nullable=False)
    approved_by = Column(String(80))
    submitted_by = Column(String(80))
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    submitted_at = Column(DateTime)


class FinanceJournalLine(Base):
    __tablename__ = "finance_journal_lines"

    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("finance_journal_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    line_number = Column(Integer, nullable=False)
    account_id = Column(Integer, ForeignKey("finance_accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    cost_center_id = Column(Integer, ForeignKey("finance_cost_centers.id", ondelete="RESTRICT"), index=True)
    description = Column(String(500), nullable=False, default="")
    party_type = Column(String(30), nullable=False, default="")
    party_reference = Column(String(80), nullable=False, default="")
    debit = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    credit = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    tax_component = Column(String(20), nullable=False, default="")


class FinanceBankAccount(Base):
    __tablename__ = "finance_bank_accounts"
    __table_args__ = (UniqueConstraint("company_id", "account_name", name="uq_finance_bank_account_name"),)

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("finance_companies.id", ondelete="RESTRICT"), nullable=False, index=True)
    ledger_account_id = Column(Integer, ForeignKey("finance_accounts.id", ondelete="RESTRICT"), nullable=False, unique=True, index=True)
    account_name = Column(String(160), nullable=False)
    bank_name = Column(String(160), nullable=False)
    masked_account_number = Column(String(40), nullable=False, default="")
    currency = Column(String(3), nullable=False, default="INR")
    opening_balance = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    status = Column(String(20), nullable=False, default="Active", index=True)
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class FinanceBankTransaction(Base):
    __tablename__ = "finance_bank_transactions"

    id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey("finance_bank_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date, nullable=False, index=True)
    value_date = Column(Date)
    external_reference = Column(String(120), nullable=False, default="", index=True)
    description = Column(String(500), nullable=False, default="")
    withdrawal = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    deposit = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    import_key = Column(String(64), nullable=False, unique=True, index=True)
    status = Column(String(20), nullable=False, default="Unmatched", index=True)
    matched_journal_entry_id = Column(Integer, ForeignKey("finance_journal_entries.id", ondelete="RESTRICT"), index=True)
    reconciliation_note = Column(Text, nullable=False, default="")
    imported_by = Column(String(80), nullable=False)
    reconciled_by = Column(String(80))
    imported_at = Column(DateTime, nullable=False, default=datetime.now)
    reconciled_at = Column(DateTime)

