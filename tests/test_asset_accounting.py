import unittest
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base
from backend.models.accounting import (
    FinanceAccount, FinanceAssetEvent, FinanceAssetRecord, FinanceCostCenter,
    FinanceDepreciationSchedule, FinanceJournalEntry, FinanceJournalLine,
)
from backend.models.asset import Asset
from backend.models.user import User
from backend.routes.accounting_routes import create_finance_company, initialize_finance_company
from backend.routes.asset_accounting_routes import (
    capitalize_asset, create_asset_category, dispose_asset, impair_asset,
    post_depreciation, revalue_asset, transfer_asset_cost_center,
)
from backend.schemas.accounting_schema import (
    AssetCapitalizationInput, AssetCategoryInput, AssetDisposalInput,
    AssetImpairmentInput, AssetRevaluationInput, AssetTransferInput, CompanyInput,
)


class AssetAccountingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.manager = User(username="manager", password_hash="x", name="Manager", role="Manager", department="Administration", is_active=True)
        self.db.add(self.manager); self.db.commit()
        self.company = create_finance_company(CompanyInput(
            company_code="HOSP", legal_name="Hospital", state_code="32", fiscal_year_start=date(2025, 4, 1),
            fiscal_year_end=date(2027, 3, 31), books_start_date=date(2025, 4, 1),
        ), None, self.db, self.manager)
        initialize_finance_company(self.company["id"], None, self.db, self.manager)

    def tearDown(self):
        self.db.close(); self.engine.dispose()

    def test_capitalization_schedule_and_depreciation_posting(self):
        accounts = {row.system_key: row for row in self.db.query(FinanceAccount).filter(FinanceAccount.company_id == self.company["id"]).all()}
        category = create_asset_category(AssetCategoryInput(
            company_id=self.company["id"], category_code="MED", category_name="Medical Equipment",
            fixed_asset_account_id=accounts["FIXED_ASSETS"].id,
            accumulated_depreciation_account_id=accounts["ACCUMULATED_DEPRECIATION"].id,
            depreciation_expense_account_id=accounts["DEPRECIATION_EXPENSE"].id,
            default_useful_life_months=12,
        ), None, self.db, self.manager)
        asset = Asset(asset_code="AST-001", equipment_name="Patient Monitor", service_team="Biomedical", department="ICU")
        self.db.add(asset); self.db.commit()
        record = capitalize_asset(AssetCapitalizationInput(
            company_id=self.company["id"], category_id=category["id"], biotrack_asset_id=asset.id,
            capitalization_date=date(2025, 4, 1), available_for_use_date=date(2025, 4, 1),
            gross_cost=Decimal("1200.00"), salvage_value=Decimal("0"), depreciation_method="Straight Line",
            useful_life_months=12, opening_balance_posting=True,
        ), None, self.db, self.manager)
        self.assertEqual(record["asset_number"], "FA-00001")
        schedules = self.db.query(FinanceDepreciationSchedule).order_by(FinanceDepreciationSchedule.schedule_number).all()
        self.assertEqual(len(schedules), 12)
        self.assertTrue(all(row.depreciation_amount == Decimal("100.00") for row in schedules))
        result = post_depreciation(schedules[0].id, None, self.db, self.manager)
        self.assertEqual(result["net_book_value"], Decimal("1100.00"))
        self.assertEqual(self.db.query(FinanceJournalEntry).count(), 2)
        with self.assertRaises(HTTPException):
            post_depreciation(schedules[0].id, None, self.db, self.manager)

    def test_asset_cannot_be_capitalized_twice(self):
        accounts = {row.system_key: row for row in self.db.query(FinanceAccount).all()}
        category = create_asset_category(AssetCategoryInput(
            company_id=self.company["id"], category_code="IT", category_name="IT Equipment",
            fixed_asset_account_id=accounts["FIXED_ASSETS"].id, accumulated_depreciation_account_id=accounts["ACCUMULATED_DEPRECIATION"].id,
            depreciation_expense_account_id=accounts["DEPRECIATION_EXPENSE"].id,
        ), None, self.db, self.manager)
        asset = Asset(asset_code="AST-002", equipment_name="Server", service_team="IT")
        self.db.add(asset); self.db.commit()
        payload = AssetCapitalizationInput(
            company_id=self.company["id"], category_id=category["id"], biotrack_asset_id=asset.id,
            capitalization_date=date(2025, 4, 1), available_for_use_date=date(2025, 4, 1), gross_cost=1000,
            useful_life_months=10,
        )
        capitalize_asset(payload, None, self.db, self.manager)
        with self.assertRaises(HTTPException) as duplicate:
            capitalize_asset(payload, None, self.db, self.manager)
        self.assertEqual(duplicate.exception.status_code, 409)

    def test_impairment_revaluation_transfer_and_disposal_are_auditable(self):
        accounts = {row.system_key: row for row in self.db.query(FinanceAccount).all()}
        category = create_asset_category(AssetCategoryInput(
            company_id=self.company["id"], category_code="LAB", category_name="Laboratory Equipment",
            fixed_asset_account_id=accounts["FIXED_ASSETS"].id,
            accumulated_depreciation_account_id=accounts["ACCUMULATED_DEPRECIATION"].id,
            depreciation_expense_account_id=accounts["DEPRECIATION_EXPENSE"].id,
            default_useful_life_months=12,
        ), None, self.db, self.manager)
        asset = Asset(asset_code="AST-003", equipment_name="Chemistry Analyser", service_team="Biomedical", department="Laboratory")
        self.db.add(asset); self.db.commit()
        capitalized = capitalize_asset(AssetCapitalizationInput(
            company_id=self.company["id"], category_id=category["id"], biotrack_asset_id=asset.id,
            capitalization_date=date(2025, 4, 1), available_for_use_date=date(2025, 4, 1),
            gross_cost=Decimal("1200.00"), salvage_value=Decimal("0"), depreciation_method="Straight Line",
            useful_life_months=12, opening_balance_posting=True,
        ), None, self.db, self.manager)

        impairment = impair_asset(capitalized["id"], AssetImpairmentInput(
            event_date=date(2025, 4, 15), impairment_amount=Decimal("200.00"), reason="Approved recoverable value assessment",
        ), None, self.db, self.manager)
        self.assertEqual(impairment["net_book_value"], Decimal("1000.00"))
        first_planned = self.db.query(FinanceDepreciationSchedule).filter_by(finance_asset_id=capitalized["id"], status="Planned").order_by(FinanceDepreciationSchedule.schedule_number).first()
        self.assertEqual(first_planned.depreciation_amount, Decimal("83.33"))

        revaluation = revalue_asset(capitalized["id"], AssetRevaluationInput(
            event_date=date(2025, 4, 16), new_carrying_value=Decimal("1100.00"), reason="Independent valuation approved",
        ), None, self.db, self.manager)
        self.assertEqual(revaluation["net_book_value"], Decimal("1100.00"))
        record = self.db.get(FinanceAssetRecord, capitalized["id"])
        self.assertEqual(record.gross_cost, Decimal("1300.00"))

        current = self.db.query(FinanceCostCenter).filter_by(company_id=self.company["id"], cost_center_code="HOSP").one()
        laboratory = FinanceCostCenter(company_id=self.company["id"], cost_center_code="LAB", cost_center_name="Laboratory", department="Laboratory", created_by=self.manager.username)
        self.db.add(laboratory); self.db.commit()
        transfer = transfer_asset_cost_center(capitalized["id"], AssetTransferInput(
            event_date=date(2025, 4, 17), from_cost_center_id=current.id, to_cost_center_id=laboratory.id,
            reason="Custody transferred to laboratory",
        ), None, self.db, self.manager)
        self.assertEqual(transfer["to_cost_center_id"], laboratory.id)

        disposal = dispose_asset(capitalized["id"], AssetDisposalInput(
            disposal_date=date(2025, 4, 18), proceeds=Decimal("900.00"), reason="Approved equipment sale",
        ), None, self.db, self.manager)
        self.assertEqual(disposal["status"], "Disposed")
        self.assertEqual(disposal["gain_or_loss"], Decimal("-200.00"))
        self.assertEqual(self.db.get(FinanceAssetRecord, capitalized["id"]).net_book_value, Decimal("0.00"))
        self.assertEqual(self.db.query(FinanceDepreciationSchedule).filter_by(finance_asset_id=capitalized["id"], status="Planned").count(), 0)
        self.assertEqual(self.db.query(FinanceAssetEvent).filter_by(finance_asset_id=capitalized["id"]).count(), 4)

        lifecycle_journals = self.db.query(FinanceJournalEntry).filter(FinanceJournalEntry.source_type.in_(["asset_impairment", "asset_revaluation", "asset_disposal"])).all()
        self.assertEqual(len(lifecycle_journals), 3)
        self.assertEqual(len({(row.source_type, row.source_id) for row in lifecycle_journals}), 3)
        for journal in lifecycle_journals:
            lines = self.db.query(FinanceJournalLine).filter_by(journal_entry_id=journal.id).all()
            self.assertEqual(sum((row.debit for row in lines), Decimal("0")), sum((row.credit for row in lines), Decimal("0")))


if __name__ == "__main__":
    unittest.main()
