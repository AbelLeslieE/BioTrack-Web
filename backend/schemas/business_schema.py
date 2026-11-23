from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


class TrimmedModel(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class BudgetInput(TrimmedModel):
    fiscal_year: str = Field(min_length=4, max_length=20)
    department: str = Field(default="Hospital-wide", min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=120)
    allocated_amount: Decimal = Field(ge=0)
    notes: str = Field(default="", max_length=3000)
    status: str = Field(default="Active", pattern="^(Active|Closed)$")


class PurchaseInput(TrimmedModel):
    budget_id: int | None = None
    department: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=120)
    item_name: str = Field(min_length=2, max_length=240)
    specification: str = Field(default="", max_length=5000)
    vendor_name: str = Field(default="", max_length=180)
    quantity: Decimal = Field(gt=0, le=1_000_000)
    unit: str = Field(default="units", min_length=1, max_length=40)
    unit_cost: Decimal = Field(ge=0, le=1_000_000_000)
    justification: str = Field(min_length=5, max_length=5000)
    priority: str = Field(default="Normal", pattern="^(Low|Normal|High|Urgent)$")


class PurchaseDecision(TrimmedModel):
    decision: str = Field(pattern="^(Approved|Rejected)$")
    note: str = Field(default="", max_length=3000)


class PurchaseStatusUpdate(TrimmedModel):
    status: str = Field(pattern="^(Ordered|Received|Paid|Cancelled)$")
    note: str = Field(default="", max_length=3000)
    payment_method: str = Field(default="", max_length=80)
    invoice_number: str = Field(default="", max_length=100)


class TransactionInput(TrimmedModel):
    budget_id: int | None = None
    transaction_type: str = Field(pattern="^(Expense|Insurance Receipt|Other Income)$")
    category: str = Field(min_length=1, max_length=120)
    department: str = Field(default="Hospital-wide", min_length=1, max_length=160)
    counterparty: str = Field(default="", max_length=180)
    description: str = Field(min_length=3, max_length=5000)
    amount: Decimal = Field(gt=0, le=10_000_000_000)
    transaction_date: date
    status: str = Field(default="Paid", pattern="^(Pending|Approved|Paid|Received|Cancelled)$")
    payment_method: str = Field(default="", max_length=80)
    invoice_number: str = Field(default="", max_length=100)


class PolicyInput(TrimmedModel):
    provider_name: str = Field(min_length=2, max_length=180)
    policy_name: str = Field(min_length=2, max_length=200)
    policy_code: str = Field(min_length=2, max_length=80)
    payer_type: str = Field(pattern="^(Government Scheme|Private Insurer|TPA|Corporate|Other)$")
    coverage_model: str = Field(default="Cashless", pattern="^(Cashless|Reimbursement|Package Rate|Mixed)$")
    valid_from: date
    valid_to: date
    claim_submission_days: int = Field(default=30, ge=0, le=365)
    payment_due_days: int = Field(default=30, ge=0, le=365)
    status: str = Field(default="Active", pattern="^(Active|Expired|Suspended)$")
    contact_person: str = Field(default="", max_length=120)
    contact_email: str = Field(default="", max_length=180)
    contact_phone: str = Field(default="", max_length=40)
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def valid_period(self):
        if self.valid_to < self.valid_from:
            raise ValueError("Policy end date cannot be before its start date.")
        return self


class ClaimBatchInput(TrimmedModel):
    batch_reference: str = Field(min_length=2, max_length=60)
    policy_id: int
    service_period_start: date
    service_period_end: date
    claim_count: int = Field(ge=0, le=1_000_000)
    claimed_amount: Decimal = Field(ge=0, le=10_000_000_000)
    approved_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    received_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    status: str = Field(default="Draft", pattern="^(Draft|Submitted|Queried|Approved|Partially Paid|Paid|Rejected)$")
    expected_payment_date: date | None = None
    query_reason: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def valid_amounts_and_period(self):
        if self.service_period_end < self.service_period_start:
            raise ValueError("Service period end cannot be before its start.")
        if self.approved_amount > self.claimed_amount:
            raise ValueError("Approved amount cannot exceed the claimed amount.")
        if self.received_amount > self.approved_amount:
            raise ValueError("Received amount cannot exceed the approved amount.")
        return self


class ClaimBatchUpdate(TrimmedModel):
    approved_amount: Decimal = Field(ge=0, le=10_000_000_000)
    received_amount: Decimal = Field(ge=0, le=10_000_000_000)
    status: str = Field(pattern="^(Draft|Submitted|Queried|Approved|Partially Paid|Paid|Rejected)$")
    expected_payment_date: date | None = None
    query_reason: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=5000)


class VendorInput(TrimmedModel):
    vendor_name: str = Field(min_length=2, max_length=180)
    supplier_type: str = Field(default="General", max_length=80)
    tax_identifier: str = Field(default="", max_length=80)
    contact_person: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=180)
    phone: str = Field(default="", max_length=40)
    address: str = Field(default="", max_length=3000)
    payment_terms_days: int = Field(default=30, ge=0, le=365)
    bank_name: str = Field(default="", max_length=160)
    bank_account_reference: str = Field(default="", max_length=120)
    status: str = Field(default="Active", pattern="^(Active|Blocked|Inactive)$")
    notes: str = Field(default="", max_length=3000)


class QuotationInput(TrimmedModel):
    vendor_id: int
    quote_number: str = Field(min_length=1, max_length=80)
    quote_date: date
    valid_until: date | None = None
    quantity: Decimal = Field(gt=0, le=1_000_000)
    unit_price: Decimal = Field(ge=0, le=1_000_000_000)
    installation_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    installation_details: str = Field(default="", max_length=500)
    training_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    training_details: str = Field(default="", max_length=1000)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    freight_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    delivery_days: int = Field(default=0, ge=0, le=3650)
    warranty_months: int = Field(default=0, ge=0, le=240)
    payment_terms: str = Field(default="", max_length=240)
    amc_annual_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    amc_years: int = Field(default=0, ge=0, le=50)
    amc_terms: str = Field(default="", max_length=3000)
    training_included: bool = False
    additional_conditions: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=3000)

    @model_validator(mode="after")
    def valid_dates(self):
        if self.valid_until and self.valid_until < self.quote_date:
            raise ValueError("Quotation validity cannot end before the quotation date.")
        return self


class InvoiceInput(TrimmedModel):
    purchase_id: int
    vendor_id: int
    quotation_id: int | None = None
    invoice_number: str = Field(min_length=1, max_length=100)
    invoice_date: date
    due_date: date
    subtotal_amount: Decimal = Field(ge=0, le=10_000_000_000)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    notes: str = Field(default="", max_length=3000)

    @model_validator(mode="after")
    def valid_due_date(self):
        if self.due_date < self.invoice_date:
            raise ValueError("Invoice due date cannot be before the invoice date.")
        return self


class InvoiceDecision(TrimmedModel):
    decision: str = Field(pattern="^(Approved|Disputed|Rejected)$")
    approved_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    note: str = Field(default="", max_length=3000)


class PaymentRequestInput(TrimmedModel):
    amount: Decimal = Field(gt=0, le=10_000_000_000)
    requested_payment_date: date
    request_note: str = Field(default="", max_length=3000)


class PaymentDecision(TrimmedModel):
    decision: str = Field(pattern="^(Approved|Rejected)$")
    note: str = Field(default="", max_length=3000)


class PaymentCompletion(TrimmedModel):
    paid_date: date
    payment_method: str = Field(min_length=1, max_length=80)
    bank_reference: str = Field(min_length=1, max_length=120)
