import unittest
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base
from backend.models.accounting import FinanceAccount, FinanceDepreciationSchedule, FinanceJournalEntry
from backend.models.asset import Asset
from backend.models.user import User
from backend.routes.accounting_routes import create_finance_company, initialize_finance_company
from backend.routes.asset_accounting_routes import capitalize_asset, create_asset_category, post_depreciation
from backend.schemas.accounting_schema import AssetCapitalizationInput, AssetCategoryInput, CompanyInput


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


if __name__ == "__main__":
    unittest.main()
