import unittest
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base
from backend.models.accounting import FinanceAccount, FinanceCompany, FinanceJournalEntry, FinanceJournalLine
from backend.models.business import BusinessVendor, PurchaseRequest, SupplierInvoice, SupplierPayment
from backend.models.user import User
from backend.routes.accounting_routes import (
    create_finance_company,
    create_journal_entry,
    decide_journal_entry,
    financial_statements,
    finance_dashboard,
    general_ledger,
    initialize_finance_company,
    preview_gst,
    trial_balance,
)
from backend.schemas.accounting_schema import (
    CompanyInput,
    GSTCalculationInput,
    GSTLineInput,
    JournalDecision,
    JournalEntryInput,
    JournalLineInput,
)
from backend.services.accounting_posting_service import post_approved_supplier_invoice, post_completed_supplier_payment


class NativeAccountingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.business_user = User(username="business", password_hash="x", name="Business Officer", role="Business", department="Business Office", is_active=True)
        self.manager = User(username="manager", password_hash="x", name="Administrator", role="Manager", department="Administration", is_active=True)
        self.db.add_all([self.business_user, self.manager])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _company(self, lock_date=None):
        return create_finance_company(
            CompanyInput(
                company_code="BTH",
                legal_name="BioTrack Hospital",
                state_code="32",
                fiscal_year_start=date(2026, 4, 1),
                fiscal_year_end=date(2027, 3, 31),
                books_start_date=date(2026, 4, 1),
                lock_date=lock_date,
            ),
            None,
            self.db,
            self.manager,
        )

    def test_gst_calculation_splits_intra_state_and_uses_igst_inter_state(self):
        line = GSTLineInput(description="Monitor", hsn_sac="9018", quantity=2, unit_price=Decimal("10000.10"), discount_amount=Decimal("100.00"), gst_rate=18)
        intra = preview_gst(GSTCalculationInput(supplier_state_code="32", place_of_supply_code="32", lines=[line]))
        self.assertEqual(intra["totals"]["taxable_amount"], Decimal("19900.20"))
        self.assertEqual(intra["totals"]["cgst_amount"], Decimal("1791.02"))
        self.assertEqual(intra["totals"]["sgst_amount"], Decimal("1791.02"))
        self.assertEqual(intra["totals"]["igst_amount"], Decimal("0.00"))
        self.assertEqual(intra["totals"]["grand_total"], Decimal("23482.24"))

        inter = preview_gst(GSTCalculationInput(supplier_state_code="32", place_of_supply_code="29", lines=[line]))
        self.assertEqual(inter["totals"]["cgst_amount"], Decimal("0.00"))
        self.assertEqual(inter["totals"]["sgst_amount"], Decimal("0.00"))
        self.assertEqual(inter["totals"]["igst_amount"], Decimal("3582.04"))
        self.assertEqual(inter["totals"]["grand_total"], Decimal("23482.24"))

    def test_tax_inclusive_line_reconciles_exactly(self):
        result = preview_gst(GSTCalculationInput(
            supplier_state_code="32",
            place_of_supply_code="32",
            lines=[GSTLineInput(description="Inclusive service", quantity=1, unit_price=Decimal("118.00"), gst_rate=18, tax_inclusive=True)],
        ))
        self.assertEqual(result["totals"]["taxable_amount"], Decimal("100.00"))
        self.assertEqual(result["totals"]["cgst_amount"], Decimal("9.00"))
        self.assertEqual(result["totals"]["sgst_amount"], Decimal("9.00"))
        self.assertEqual(result["totals"]["grand_total"], Decimal("118.00"))

    def test_balanced_journal_posts_to_trial_balance(self):
        company = self._company()
        setup = initialize_finance_company(company["id"], None, self.db, self.manager)
        self.assertGreaterEqual(setup["accounts_created"], 10)
        accounts = {row.system_key: row for row in self.db.query(FinanceAccount).filter(FinanceAccount.company_id == company["id"]).all()}
        journal = create_journal_entry(
            JournalEntryInput(
                company_id=company["id"],
                entry_date=date(2026, 11, 23),
                narration="Record approved equipment purchase",
                lines=[
                    JournalLineInput(account_id=accounts["PURCHASE_EXPENSE"].id, debit=Decimal("1180.00")),
                    JournalLineInput(account_id=accounts["ACCOUNTS_PAYABLE"].id, credit=Decimal("1180.00"), party_type="Vendor", party_reference="VEN-001"),
                ],
            ),
            None,
            self.db,
            self.business_user,
        )
        self.assertEqual(journal["status"], "Draft")
        submitted = decide_journal_entry(journal["id"], JournalDecision(decision="Submit", note="Verified against supplier invoice"), None, self.db, self.manager)
        self.assertEqual(submitted["status"], "Submitted")
        report = trial_balance(company["id"], self.db)
        self.assertTrue(report["balanced"])
        self.assertEqual(report["total_debit"], Decimal("1180.00"))
        self.assertEqual(report["total_credit"], Decimal("1180.00"))
        self.assertEqual(finance_dashboard(self.db)["summary"]["posted_value"], Decimal("1180.00"))

        statements = financial_statements(company["id"], None, None, self.db)
        self.assertEqual(statements["profit_and_loss"]["total_expenses"], Decimal("1180.00"))
        self.assertEqual(statements["profit_and_loss"]["surplus_or_deficit"], Decimal("-1180.00"))
        self.assertEqual(statements["balance_sheet"]["total_liabilities"], Decimal("1180.00"))
        ledger = general_ledger(company["id"], None, None, None, self.db)
        self.assertEqual(ledger["entry_count"], 2)
        self.assertEqual({item["reference_number"] for item in ledger["entries"]}, {journal["reference_number"]})

    def test_unbalanced_and_locked_period_journals_are_rejected(self):
        company = self._company(lock_date=date(2026, 10, 31))
        initialize_finance_company(company["id"], None, self.db, self.manager)
        accounts = self.db.query(FinanceAccount).filter(FinanceAccount.company_id == company["id"]).limit(2).all()
        with self.assertRaises(HTTPException) as unbalanced:
            create_journal_entry(
                JournalEntryInput(
                    company_id=company["id"],
                    entry_date=date(2026, 11, 23),
                    narration="Unbalanced entry",
                    lines=[
                        JournalLineInput(account_id=accounts[0].id, debit=100),
                        JournalLineInput(account_id=accounts[1].id, credit=99),
                    ],
                ),
                None,
                self.db,
                self.business_user,
            )
        self.assertEqual(unbalanced.exception.status_code, 422)

        with self.assertRaises(HTTPException) as locked:
            create_journal_entry(
                JournalEntryInput(
                    company_id=company["id"],
                    entry_date=date(2026, 10, 31),
                    narration="Locked entry",
                    lines=[
                        JournalLineInput(account_id=accounts[0].id, debit=100),
                        JournalLineInput(account_id=accounts[1].id, credit=100),
                    ],
                ),
                None,
                self.db,
                self.business_user,
            )
        self.assertEqual(locked.exception.status_code, 409)
        self.assertEqual(self.db.query(FinanceJournalEntry).count(), 0)

    def test_supplier_invoice_and_payment_post_idempotent_balanced_journals(self):
        company = self._company()
        initialize_finance_company(company["id"], None, self.db, self.manager)
        vendor = BusinessVendor(vendor_code="VEN-001", vendor_name="Medical Supplier", created_by="business")
        purchase = PurchaseRequest(
            request_number="PUR-001", department="Biomedical", category="Medical Equipment", item_name="Monitor",
            quantity=1, unit="unit", unit_cost=Decimal("1180.00"), total_amount=Decimal("1180.00"),
            justification="Replacement", status="Approved", requested_by_username="business", requested_by_name="Officer",
        )
        self.db.add_all([vendor, purchase])
        self.db.flush()
        invoice = SupplierInvoice(
            purchase_id=purchase.id, vendor_id=vendor.id, invoice_number="INV-001", invoice_date=date(2026, 11, 23),
            due_date=date(2026, 12, 23), subtotal_amount=Decimal("1000.00"), tax_amount=Decimal("180.00"),
            total_amount=Decimal("1180.00"), approved_amount=Decimal("1180.00"), status="Approved",
            created_by="business", approved_by="manager",
        )
        self.db.add(invoice)
        self.db.flush()
        first = post_approved_supplier_invoice(self.db, invoice, purchase, vendor, "manager")
        duplicate = post_approved_supplier_invoice(self.db, invoice, purchase, vendor, "manager")
        self.assertEqual(first.id, duplicate.id)
        self.assertEqual(first.total_debit, Decimal("1180.00"))
        invoice_lines = self.db.query(FinanceJournalLine).filter(FinanceJournalLine.journal_entry_id == first.id).all()
        self.assertEqual(sum((line.debit for line in invoice_lines), Decimal("0")), Decimal("1180.00"))
        self.assertEqual(len(invoice_lines), 3)

        payment = SupplierPayment(
            invoice_id=invoice.id, reference_number="PAYREQ-001", amount=Decimal("500.00"),
            requested_payment_date=date(2026, 11, 23), paid_date=date(2026, 11, 24), status="Paid",
            requested_by="business", approved_by="manager", completed_by="business", bank_reference="UTR-001",
        )
        self.db.add(payment)
        self.db.flush()
        paid = post_completed_supplier_payment(self.db, payment, invoice, vendor, "business")
        self.assertEqual(paid.total_debit, Decimal("500.00"))
        self.assertEqual(self.db.query(FinanceJournalEntry).count(), 2)


if __name__ == "__main__":
    unittest.main()

