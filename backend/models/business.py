"""Institutional finance models for the hospital Business Office.

These tables intentionally contain no patient identifiers or patient billing
records.  They track budgets, procurement, hospital-level transactions and
aggregate insurer claim batches only.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, LargeBinary, Numeric, String, Text, UniqueConstraint

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
    allocated_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
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
    quantity = Column(Numeric(18, 3), nullable=False, default=Decimal("1.000"))
    unit = Column(String(40), nullable=False, default="units")
    unit_cost = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    total_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
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
    amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
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
    claimed_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    approved_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    received_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    deductions_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    status = Column(String(30), nullable=False, default="Draft", index=True)
    submitted_at = Column(DateTime)
    expected_payment_date = Column(Date)
    received_at = Column(DateTime)
    query_reason = Column(Text, nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class BusinessVendor(Base):
    __tablename__ = "business_vendors"

    id = Column(Integer, primary_key=True, index=True)
    vendor_code = Column(String(40), nullable=False, unique=True, index=True)
    vendor_name = Column(String(180), nullable=False, index=True)
    supplier_type = Column(String(80), nullable=False, default="General")
    tax_identifier = Column(String(80), nullable=False, default="")
    contact_person = Column(String(120), nullable=False, default="")
    email = Column(String(180), nullable=False, default="")
    phone = Column(String(40), nullable=False, default="")
    address = Column(Text, nullable=False, default="")
    payment_terms_days = Column(Integer, nullable=False, default=30)
    bank_name = Column(String(160), nullable=False, default="")
    bank_account_reference = Column(String(120), nullable=False, default="")
    status = Column(String(20), nullable=False, default="Active", index=True)
    notes = Column(Text, nullable=False, default="")
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class SupplierQuotation(Base):
    __tablename__ = "supplier_quotations"
    __table_args__ = (
        UniqueConstraint("vendor_id", "quote_number", name="uq_supplier_quotation_vendor_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("business_vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    quote_number = Column(String(80), nullable=False, index=True)
    quote_date = Column(Date, nullable=False)
    valid_until = Column(Date)
    quantity = Column(Numeric(18, 3), nullable=False, default=Decimal("1.000"))
    unit_price = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    installation_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    installation_details = Column(String(500), nullable=False, default="")
    training_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    training_details = Column(String(1000), nullable=False, default="")
    tax_rate = Column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    tax_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    discount_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    freight_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    total_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"), index=True)
    delivery_days = Column(Integer, nullable=False, default=0)
    warranty_months = Column(Integer, nullable=False, default=0)
    payment_terms = Column(String(240), nullable=False, default="")
    amc_annual_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    amc_years = Column(Integer, nullable=False, default=0)
    amc_terms = Column(Text, nullable=False, default="")
    training_included = Column(Boolean, nullable=False, default=False)
    additional_conditions = Column(Text, nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    status = Column(String(20), nullable=False, default="Received", index=True)
    created_by = Column(String(80), nullable=False)
    selected_by = Column(String(80))
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
    selected_at = Column(DateTime)


class SupplierInvoice(Base):
    __tablename__ = "supplier_invoices"
    __table_args__ = (
        UniqueConstraint("vendor_id", "invoice_number", name="uq_supplier_invoice_vendor_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchase_requests.id", ondelete="RESTRICT"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("business_vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    quotation_id = Column(Integer, ForeignKey("supplier_quotations.id", ondelete="SET NULL"), index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), index=True)
    goods_receipt_id = Column(Integer, ForeignKey("goods_receipts.id", ondelete="SET NULL"), index=True)
    invoice_number = Column(String(100), nullable=False, index=True)
    invoice_date = Column(Date, nullable=False, index=True)
    due_date = Column(Date, nullable=False, index=True)
    subtotal_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    tax_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    discount_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    total_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    approved_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    paid_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    match_status = Column(String(30), nullable=False, default="Not Checked", index=True)
    match_variance_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    tds_section = Column(String(30), nullable=False, default="")
    tds_rate = Column(Numeric(7, 4), nullable=False, default=Decimal("0.0000"))
    tds_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    net_payable_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    status = Column(String(30), nullable=False, default="Submitted", index=True)
    notes = Column(Text, nullable=False, default="")
    created_by = Column(String(80), nullable=False)
    approved_by = Column(String(80))
    approval_note = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    approved_at = Column(DateTime)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class PurchaseOrder(Base):
    """A formal order raised from one approved request and selected quotation."""

    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), nullable=False, unique=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchase_requests.id", ondelete="RESTRICT"), nullable=False, unique=True, index=True)
    vendor_id = Column(Integer, ForeignKey("business_vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    quotation_id = Column(Integer, ForeignKey("supplier_quotations.id", ondelete="RESTRICT"), nullable=False, index=True)
    order_date = Column(Date, nullable=False, index=True)
    expected_delivery_date = Column(Date, index=True)
    quantity = Column(Numeric(18, 3), nullable=False)
    unit = Column(String(40), nullable=False, default="units")
    subtotal_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    tax_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    discount_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    total_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    payment_terms = Column(String(500), nullable=False, default="")
    delivery_address = Column(Text, nullable=False, default="")
    terms_and_conditions = Column(Text, nullable=False, default="")
    status = Column(String(30), nullable=False, default="Issued", index=True)
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class GoodsReceipt(Base):
    """Inspection-backed receipt of goods or services against a purchase order."""

    __tablename__ = "goods_receipts"

    id = Column(Integer, primary_key=True, index=True)
    receipt_number = Column(String(50), nullable=False, unique=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    received_date = Column(Date, nullable=False, index=True)
    delivery_note_number = Column(String(100), nullable=False, default="")
    quantity_received = Column(Numeric(18, 3), nullable=False)
    quantity_accepted = Column(Numeric(18, 3), nullable=False)
    quantity_rejected = Column(Numeric(18, 3), nullable=False, default=Decimal("0.000"))
    inspection_status = Column(String(30), nullable=False, default="Accepted", index=True)
    received_by = Column(String(120), nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class BusinessContract(Base):
    """Supplier agreement, AMC or CMC with payment and renewal obligations."""

    __tablename__ = "business_contracts"

    id = Column(Integer, primary_key=True, index=True)
    contract_number = Column(String(80), nullable=False, unique=True, index=True)
    vendor_id = Column(Integer, ForeignKey("business_vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), index=True)
    title = Column(String(240), nullable=False)
    contract_type = Column(String(30), nullable=False, default="AMC", index=True)
    owner_department = Column(String(160), nullable=False, default="Hospital-wide", index=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False, index=True)
    total_value = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    billing_frequency = Column(String(30), nullable=False, default="Annual")
    next_payment_date = Column(Date, index=True)
    next_payment_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    renewal_notice_days = Column(Integer, nullable=False, default=60)
    response_sla_hours = Column(Integer, nullable=False, default=24)
    service_obligations = Column(Text, nullable=False, default="")
    payment_schedule = Column(Text, nullable=False, default="")
    status = Column(String(20), nullable=False, default="Active", index=True)
    created_by = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class SupplierTaxReconciliation(Base):
    """GSTR-2B and input-credit review for one supplier invoice."""

    __tablename__ = "supplier_tax_reconciliations"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("supplier_invoices.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    return_period = Column(String(7), nullable=False, index=True)
    supplier_gstin = Column(String(15), nullable=False, default="")
    gstr2b_status = Column(String(30), nullable=False, default="Pending", index=True)
    taxable_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    gst_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    eligible_itc_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    discrepancy_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    notes = Column(Text, nullable=False, default="")
    reconciled_by = Column(String(80), nullable=False)
    reconciled_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class SupplierPayment(Base):
    __tablename__ = "supplier_payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("supplier_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    reference_number = Column(String(50), nullable=False, unique=True, index=True)
    amount = Column(Numeric(18, 2), nullable=False)
    requested_payment_date = Column(Date, nullable=False)
    paid_date = Column(Date)
    payment_method = Column(String(80), nullable=False, default="")
    bank_reference = Column(String(120), nullable=False, default="")
    status = Column(String(30), nullable=False, default="Pending Approval", index=True)
    request_note = Column(Text, nullable=False, default="")
    approval_note = Column(Text, nullable=False, default="")
    requested_by = Column(String(80), nullable=False)
    approved_by = Column(String(80))
    completed_by = Column(String(80))
    requested_at = Column(DateTime, nullable=False, default=datetime.now)
    reviewed_at = Column(DateTime)
    completed_at = Column(DateTime)


class BusinessDocument(Base):
    __tablename__ = "business_documents"

    id = Column(Integer, primary_key=True, index=True)
    record_type = Column(String(30), nullable=False, index=True)
    record_id = Column(Integer, nullable=False, index=True)
    document_type = Column(String(60), nullable=False)
    original_name = Column(String(240), nullable=False)
    content_type = Column(String(100), nullable=False)
    original_size_bytes = Column(Integer, nullable=False, default=0)
    stored_size_bytes = Column(Integer, nullable=False, default=0)
    file_data = Column(LargeBinary, nullable=False)
    uploaded_by = Column(String(80), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=datetime.now)
