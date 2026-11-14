import unittest
from datetime import date, datetime, timedelta
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.asset import Asset
from backend.models.inventory import Inventory
from backend.models.pm_schedule import PMSchedule
from backend.models.request import Request
from backend.models.user import User
from backend.routes.dashboard_routes import dashboard_v2


class ExecutiveDashboardTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        for table in (User.__table__, Asset.__table__, Inventory.__table__, Request.__table__, PMSchedule.__table__):
            table.create(self.engine)
        self.session = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_operations_summary_exposes_actionable_risk_metrics(self):
        now = datetime.now()
        active_asset = Asset(asset_code="ASSET-1", equipment_name="Monitor", status="Active", service_team="Biomedical")
        unavailable_asset = Asset(asset_code="ASSET-2", equipment_name="Ventilator", status="Out of Service", service_team="Biomedical")
        self.session.add_all([active_asset, unavailable_asset])
        self.session.flush()
        self.session.add_all([
            Request(
                ticket_number="BT-ACTIVE",
                status="Awaiting Parts",
                priority="Critical",
                service_team="Biomedical",
                call_received_datetime=now - timedelta(hours=10),
            ),
            Request(
                ticket_number="BT-CLOSED",
                status="Closed",
                service_team="Biomedical",
                fixed_datetime=now,
                final_downtime_hours=4,
            ),
            Inventory(
                bpk_number="BPK-LOW",
                item_name="Fuse",
                current_stock=0,
                minimum_stock=5,
                purchase_price=20,
                service_team="Biomedical",
            ),
            Inventory(
                bpk_number="BPK-OK",
                item_name="Cable",
                current_stock=10,
                minimum_stock=5,
                purchase_price=50,
                service_team="Biomedical",
            ),
            PMSchedule(
                asset_id=active_asset.id,
                scheduled_date=date.today(),
                frequency_days=30,
                status="Overdue",
                department_response="Pending",
            ),
            User(username="engineer", password_hash="hash", role="BME"),
        ])
        self.session.commit()

        result = dashboard_v2(self.session, SimpleNamespace(role="Manager"))
        summary = result["summary"]

        self.assertEqual(summary["awaiting_parts"], 1)
        self.assertEqual(summary["out_of_stock"], 1)
        self.assertEqual(summary["stock_health_percent"], 50)
        self.assertEqual(summary["pm_due"], 1)
        self.assertEqual(summary["pm_overdue"], 1)
        self.assertEqual(summary["pm_pending_confirmation"], 1)
        self.assertEqual(summary["out_of_service_assets"], 1)
        self.assertEqual(summary["asset_availability_percent"], 50)
        self.assertAlmostEqual(summary["active_downtime_hours"], 10, delta=0.1)
        self.assertAlmostEqual(summary["oldest_active_call_hours"], 10, delta=0.1)
        self.assertEqual(summary["avg_downtime"], 4)
        self.assertEqual(summary["inventory_value"], 500)


if __name__ == "__main__":
    unittest.main()
