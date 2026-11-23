from datetime import date
from decimal import Decimal
import re

from pydantic import BaseModel, Field, field_validator, model_validator


class AccountingModel(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class CompanyInput(AccountingModel):
    company_code: str = Field(min_length=2, max_length=20, pattern=r"^[A-Za-z0-9_-]+$")
    legal_name: str = Field(min_length=2, max_length=200)
    base_currency: str = Field(default="INR", min_length=3, max_length=3)
    country: str = Field(default="India", min_length=2, max_length=80)
    state_code: str = Field(min_length=2, max_length=2, pattern=r"^[0-9]{2}$")
    gstin: str = Field(default="", max_length=15)
    fiscal_year_start: date
    fiscal_year_end: date
    books_start_date: date
    lock_date: date | None = None
    status: str = Field(default="Active", pattern="^(Active|Inactive)$")

    @field_validator("base_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, value: str) -> str:
        value = value.upper()
        if value and not re.fullmatch(r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]", value):
            raise ValueError("GSTIN must use the official 15-character format.")
        return value

    @model_validator(mode="after")
    def validate_dates(self):
        if self.fiscal_year_end <= self.fiscal_year_start:
            raise ValueError("Fiscal year end must be after its start.")
        if self.books_start_date > self.fiscal_year_end:
            raise ValueError("Books start date cannot be after the fiscal year end.")
        if self.lock_date and self.lock_date > self.fiscal_year_end:
            raise ValueError("Lock date cannot be after the fiscal year end.")
        return self


class AccountInput(AccountingModel):
    company_id: int
    parent_id: int | None = None
    account_code: str = Field(min_length=1, max_length=30)
    account_name: str = Field(min_length=2, max_length=180)
    account_type: str = Field(pattern="^(Asset|Liability|Equity|Income|Expense)$")
    normal_balance: str = Field(pattern="^(Debit|Credit)$")
    is_group: bool = False
    allow_direct_posting: bool = True
    status: str = Field(default="Active", pattern="^(Active|Inactive)$")


class CostCenterInput(AccountingModel):
    company_id: int
    cost_center_code: str = Field(min_length=1, max_length=30)
    cost_center_name: str = Field(min_length=2, max_length=160)
    department: str = Field(default="Hospital-wide", min_length=1, max_length=160)
    status: str = Field(default="Active", pattern="^(Active|Inactive)$")


class TaxTemplateInput(AccountingModel):
    company_id: int
    template_code: str = Field(min_length=1, max_length=40)
    template_name: str = Field(min_length=2, max_length=160)
    gst_rate: Decimal = Field(ge=0, le=100)
    cess_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    hsn_sac: str = Field(default="", max_length=20)
    supply_type: str = Field(default="Goods", pattern="^(Goods|Services|Capital Goods)$")
    input_credit_eligible: bool = True
    reverse_charge: bool = False
    valid_from: date
    valid_to: date | None = None
    status: str = Field(default="Active", pattern="^(Active|Inactive)$")

    @model_validator(mode="after")
    def validate_validity(self):
        if self.valid_to and self.valid_to < self.valid_from:
            raise ValueError("Tax template validity cannot end before it starts.")
        return self


class GSTLineInput(AccountingModel):
    description: str = Field(min_length=1, max_length=240)
    hsn_sac: str = Field(default="", max_length=20)
    quantity: Decimal = Field(gt=0, le=1_000_000)
    unit_price: Decimal = Field(ge=0, le=10_000_000_000)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    gst_rate: Decimal = Field(ge=0, le=100)
    cess_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    tax_inclusive: bool = False


class GSTCalculationInput(AccountingModel):
    supplier_state_code: str = Field(min_length=2, max_length=2, pattern=r"^[0-9]{2}$")
    place_of_supply_code: str = Field(min_length=2, max_length=2, pattern=r"^[0-9]{2}$")
    reverse_charge: bool = False
    lines: list[GSTLineInput] = Field(min_length=1, max_length=500)


class JournalLineInput(AccountingModel):
    account_id: int
    cost_center_id: int | None = None
    description: str = Field(default="", max_length=500)
    party_type: str = Field(default="", max_length=30)
    party_reference: str = Field(default="", max_length=80)
    debit: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    credit: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    tax_component: str = Field(default="", pattern="^(|CGST|SGST|IGST|CESS|TDS)$")

    @model_validator(mode="after")
    def exactly_one_side(self):
        if (self.debit > 0) == (self.credit > 0):
            raise ValueError("Each journal line must contain either a debit or a credit, but not both.")
        return self


class JournalEntryInput(AccountingModel):
    company_id: int
    entry_date: date
    entry_type: str = Field(default="Journal", pattern="^(Journal|Purchase|Payment|Receipt|Adjustment|Opening|Reversal)$")
    narration: str = Field(min_length=3, max_length=5000)
    source_type: str | None = Field(default=None, max_length=40)
    source_id: int | None = None
    lines: list[JournalLineInput] = Field(min_length=2, max_length=500)

    @model_validator(mode="after")
    def source_pair(self):
        if bool(self.source_type) != (self.source_id is not None):
            raise ValueError("Source type and source ID must be supplied together.")
        return self


class JournalDecision(AccountingModel):
    decision: str = Field(pattern="^(Submit|Reject)$")
    note: str = Field(default="", max_length=2000)


class BankAccountInput(AccountingModel):
    company_id: int
    ledger_account_id: int
    account_name: str = Field(min_length=2, max_length=160)
    bank_name: str = Field(min_length=2, max_length=160)
    masked_account_number: str = Field(default="", max_length=40)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    opening_balance: Decimal = Field(default=Decimal("0"), ge=-10_000_000_000, le=10_000_000_000)
    status: str = Field(default="Active", pattern="^(Active|Inactive)$")

    @field_validator("currency")
    @classmethod
    def bank_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("masked_account_number")
    @classmethod
    def require_masked_account_number(cls, value: str) -> str:
        if re.search(r"\d{5,}", value):
            raise ValueError("Store only a masked bank account number with at most four visible consecutive digits.")
        return value


class BankTransactionInput(AccountingModel):
    transaction_date: date
    value_date: date | None = None
    external_reference: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=500)
    withdrawal: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    deposit: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)

    @model_validator(mode="after")
    def one_bank_side(self):
        if (self.withdrawal > 0) == (self.deposit > 0):
            raise ValueError("Each bank transaction must be either a withdrawal or a deposit.")
        return self


class BankTransactionImport(AccountingModel):
    bank_account_id: int
    rows: list[BankTransactionInput] = Field(min_length=1, max_length=2000)


class BankReconciliationDecision(AccountingModel):
    action: str = Field(pattern="^(Match|Unmatch|Ignore)$")
    journal_entry_id: int | None = None
    note: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def match_requires_journal(self):
        if self.action == "Match" and not self.journal_entry_id:
            raise ValueError("Select a submitted journal entry to reconcile this transaction.")
        return self


class PeriodLockInput(AccountingModel):
    lock_date: date
    note: str = Field(min_length=3, max_length=2000)


class JournalReversalInput(AccountingModel):
    reversal_date: date
    reason: str = Field(min_length=3, max_length=2000)


class AssetCategoryInput(AccountingModel):
    company_id: int
    category_code: str = Field(min_length=1, max_length=30)
    category_name: str = Field(min_length=2, max_length=160)
    fixed_asset_account_id: int
    accumulated_depreciation_account_id: int
    depreciation_expense_account_id: int
    default_method: str = Field(default="Straight Line", pattern="^(Straight Line|Written Down Value)$")
    default_useful_life_months: int = Field(default=60, ge=1, le=1200)
    default_annual_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class AssetCapitalizationInput(AccountingModel):
    company_id: int
    category_id: int
    biotrack_asset_id: int
    capitalization_date: date
    available_for_use_date: date
    gross_cost: Decimal = Field(gt=0, le=10_000_000_000)
    salvage_value: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    depreciation_method: str = Field(default="Straight Line", pattern="^(Straight Line|Written Down Value)$")
    useful_life_months: int = Field(ge=1, le=1200)
    annual_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    opening_balance_posting: bool = False
    notes: str = Field(default="", max_length=3000)

    @model_validator(mode="after")
    def validate_asset_values(self):
        if self.salvage_value >= self.gross_cost:
            raise ValueError("Salvage value must be lower than gross cost.")
        if self.available_for_use_date < self.capitalization_date:
            raise ValueError("Available-for-use date cannot be before capitalization.")
        if self.depreciation_method == "Written Down Value" and self.annual_rate <= 0:
            raise ValueError("Written Down Value depreciation requires a positive annual rate.")
        return self


class AssetImpairmentInput(AccountingModel):
    event_date: date
    impairment_amount: Decimal = Field(gt=0, le=10_000_000_000)
    reason: str = Field(min_length=3, max_length=3000)


class AssetRevaluationInput(AccountingModel):
    event_date: date
    new_carrying_value: Decimal = Field(gt=0, le=10_000_000_000)
    reason: str = Field(min_length=3, max_length=3000)


class AssetDisposalInput(AccountingModel):
    disposal_date: date
    proceeds: Decimal = Field(default=Decimal("0"), ge=0, le=10_000_000_000)
    reason: str = Field(min_length=3, max_length=3000)


class AssetTransferInput(AccountingModel):
    event_date: date
    from_cost_center_id: int | None = None
    to_cost_center_id: int
    reason: str = Field(min_length=3, max_length=3000)

