"""Institutional finance models for the hospital Business Office.

These tables intentionally contain no patient identifiers or patient billing
records.  They track budgets, procurement, hospital-level transactions and
aggregate insurer claim batches only.
"""

from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint

from backend.models.base import Base


class BusinessBudget(Base):
    __tablename__ = "business_budgets"
    __table_args__ = (
        UniqueConstraint("fiscal_year", "department", "category", name="uq_business_budget_scope"),
    )

    id = Column(Integer, primary_key=True, index=True)
    fiscal_year = Column(String(20), nullable=False, index=True)
    department = Column(String(160), nullable=False, default="Hospital-wide", index=True)
    category = Column(String(120), nullable=False, index=True)
    allocated_amount = Column(Float, nullable=False, default=0)
    notes = Column(Text, nullable=False, default="")
    status = Column(String(20), nullable=False, default="Active", index=True)
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(40), nullable=False, unique=True, index=True)
    budget_id = Column(Integer, ForeignKey("business_budgets.id", ondelete="SET NULL"), index=True)
    department = Column(String(160), nullable=False, index=True)
    category = Column(String(120), nullable=False, index=True)
    item_name = Column(String(240), nullable=False)
    specification = Column(Text, nullable=False, default="")
    vendor_name = Column(String(180), nullable=False, default="")
    quantity = Column(Float, nullable=False, default=1)
    unit = Column(String(40), nullable=False, default="units")
    unit_cost = Column(Float, nullable=False, default=0)
    total_amount = Column(Float, nullable=False, default=0)
    justification = Column(Text, nullable=False)
    priority = Column(String(20), nullable=False, default="Normal", index=True)
    status = Column(String(30), nullable=False, default="Submitted", index=True)
    requested_by_username = Column(String(80), nullable=False, index=True)
    requested_by_name = Column(String(120), nullable=False)
    approved_by_username = Column(String(80))
    approved_by_name = Column(String(120))
    approval_note = Column(Text, nullable=False, default="")
    requested_at = Column(DateTime, nullable=False, default=datetime.now, index=True)
    reviewed_at = Column(DateTime)
    ordered_at = Column(DateTime)
    received_at = Column(DateTime)
    paid_at = Column(DateTime)


class BusinessTransaction(Base):
    __tablename__ = "business_transactions"
    __table_args__ = (
        UniqueConstraint("source_type", "source_id", name="uq_business_transaction_source"),
    )

    id = Column(Integer, primary_key=True, index=True)
    reference_number = Column(String(40), nullable=False, unique=True, index=True)
    budget_id = Column(Integer, ForeignKey("business_budgets.id", ondelete="SET NULL"), index=True)
    transaction_type = Column(String(40), nullable=False, index=True)
    category = Column(String(120), nullable=False, index=True)
    department = Column(String(160), nullable=False, default="Hospital-wide", index=True)
    counterparty = Column(String(180), nullable=False, default="")
    description = Column(Text, nullable=False)
    amount = Column(Float, nullable=False, default=0)
    transaction_date = Column(Date, nullable=False, default=date.today, index=True)
    status = Column(String(20), nullable=False, default="Pending", index=True)
    payment_method = Column(String(80), nullable=False, default="")
    invoice_number = Column(String(100), nullable=False, default="")
    source_type = Column(String(40))
    source_id = Column(Integer)
    created_by = Column(String(80), nullable=False)
    approved_by = Column(String(80))
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class InsurancePolicy(Base):
    """A hospital payer agreement or scheme, never an individual policy."""

    __tablename__ = "insurance_policies"

    id = Column(Integer, primary_key=True, index=True)
    provider_name = Column(String(180), nullable=False, index=True)
    policy_name = Column(String(200), nullable=False)
    policy_code = Column(String(80), nullable=False, unique=True, index=True)
    payer_type = Column(String(40), nullable=False, index=True)
    coverage_model = Column(String(40), nullable=False, default="Cashless")
    valid_from = Column(Date, nullable=False)
    valid_to = Column(Date, nullable=False, index=True)
    claim_submission_days = Column(Integer, nullable=False, default=30)
    payment_due_days = Column(Integer, nullable=False, default=30)
    status = Column(String(20), nullable=False, default="Active", index=True)
    contact_person = Column(String(120), nullable=False, default="")
    contact_email = Column(String(180), nullable=False, default="")
    contact_phone = Column(String(40), nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class InsuranceClaimBatch(Base):
    """Aggregate claims submitted to a payer; contains no patient data."""

    __tablename__ = "insurance_claim_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_reference = Column(String(60), nullable=False, unique=True, index=True)
    policy_id = Column(Integer, ForeignKey("insurance_policies.id", ondelete="RESTRICT"), nullable=False, index=True)
    service_period_start = Column(Date, nullable=False)
    service_period_end = Column(Date, nullable=False)
    claim_count = Column(Integer, nullable=False, default=0)
    claimed_amount = Column(Float, nullable=False, default=0)
    approved_amount = Column(Float, nullable=False, default=0)
    received_amount = Column(Float, nullable=False, default=0)
    deductions_amount = Column(Float, nullable=False, default=0)
    status = Column(String(30), nullable=False, default="Draft", index=True)
    submitted_at = Column(DateTime)
    expected_payment_date = Column(Date)
    received_at = Column(DateTime)
    query_reason = Column(Text, nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
