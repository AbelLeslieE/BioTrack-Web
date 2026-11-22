import unittest
from datetime import date, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base
from backend.models.business import BusinessTransaction
from backend.models.user import User
from backend.routes.business_routes import (
    business_dashboard,
    create_claim,
    create_policy,
    create_purchase,
    decide_purchase,
    save_budget,
    update_claim,
    update_purchase_status,
)
from backend.schemas.business_schema import (
    BudgetInput,
    ClaimBatchInput,
    ClaimBatchUpdate,
    PolicyInput,
    PurchaseDecision,
    PurchaseInput,
    PurchaseStatusUpdate,
)


class BusinessOfficeTests(unittest.TestCase):
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

    def test_purchase_payment_updates_budget_without_double_counting(self):
        budget = save_budget(BudgetInput(fiscal_year="2026-27", department="Radiology", category="Equipment", allocated_amount=100_000), None, self.db, self.business_user)
        purchase = create_purchase(PurchaseInput(budget_id=budget["id"], department="Radiology", category="Equipment", item_name="Patient monitor", quantity=2, unit="units", unit_cost=15_000, justification="Replace two unsupported monitors"), None, self.db, self.business_user)
        self.assertEqual(purchase["total_amount"], 30_000)

        decide_purchase(purchase["id"], PurchaseDecision(decision="Approved", note="Within approved capital plan"), None, self.db, self.manager)
        summary = business_dashboard("2026-27", self.db)
        self.assertEqual(summary["summary"]["committed_spend"], 30_000)
        self.assertEqual(summary["summary"]["paid_spend"], 0)

        for status in ("Ordered", "Received", "Paid"):
            update_purchase_status(purchase["id"], PurchaseStatusUpdate(status=status, payment_method="NEFT" if status == "Paid" else "", invoice_number="INV-1" if status == "Paid" else ""), None, self.db, self.business_user)

        summary = business_dashboard("2026-27", self.db)
        self.assertEqual(summary["summary"]["committed_spend"], 0)
        self.assertEqual(summary["summary"]["paid_spend"], 30_000)
        self.assertEqual(summary["summary"]["available_budget"], 70_000)
        self.assertEqual(self.db.query(BusinessTransaction).filter(BusinessTransaction.source_type == "purchase").count(), 1)

    def test_aggregate_claim_receipt_posts_income_without_patient_data(self):
        today = date.today()
        policy = create_policy(PolicyInput(provider_name="State Health Agency", policy_name="Public Health Scheme", policy_code="PHS-1", payer_type="Government Scheme", coverage_model="Package Rate", valid_from=today, valid_to=today + timedelta(days=365)), None, self.db, self.business_user)
        claim = create_claim(ClaimBatchInput(batch_reference="BATCH-2026-01", policy_id=policy["id"], service_period_start=today - timedelta(days=30), service_period_end=today, claim_count=18, claimed_amount=250_000, status="Submitted"), None, self.db, self.business_user)
        updated = update_claim(claim["id"], ClaimBatchUpdate(approved_amount=220_000, received_amount=200_000, status="Partially Paid"), None, self.db, self.business_user)

        self.assertEqual(updated["outstanding_amount"], 20_000)
        self.assertEqual(updated["deductions_amount"], 30_000)
        receipt = self.db.query(BusinessTransaction).filter(BusinessTransaction.source_type == "insurance_claim").one()
        self.assertEqual(receipt.amount, 200_000)
        self.assertEqual(receipt.status, "Received")
        self.assertFalse(any("patient" in column.name.casefold() for table in (Base.metadata.tables["insurance_claim_batches"],) for column in table.columns))


if __name__ == "__main__":
    unittest.main()
