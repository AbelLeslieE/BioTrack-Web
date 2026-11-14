import unittest
from datetime import date, datetime
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.asset import Asset
from backend.models.inventory import Inventory
from backend.models.pm_schedule import PMSchedule
from backend.models.request import Request
from backend.models.user import User
from backend.routes.dashboard_routes import notification_feed


class NotificationFeedTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        for table in (User.__table__, Asset.__table__, Inventory.__table__, Request.__table__, PMSchedule.__table__):
            table.create(self.engine)
        self.session = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_manager_feed_contains_actionable_operational_alerts(self):
        asset = Asset(
            asset_code="ASSET-NOTIFY",
            equipment_name="Ventilator",
            department="ICU",
            status="Out of Service",
            service_team="Biomedical",
        )
        self.session.add(asset)
        self.session.flush()
        self.session.add_all([
            Request(
                ticket_number="BT-CRITICAL",
                equipment_name="Ventilator",
                department="ICU",
                status="Open",
                priority="Critical",
                service_team="Biomedical",
                call_received_datetime=datetime.now(),
            ),
            Inventory(
                bpk_number="BPK-NOTIFY",
                item_name="Oxygen sensor",
                current_stock=0,
                minimum_stock=3,
                service_team="Biomedical",
            ),
            PMSchedule(
                asset_id=asset.id,
                department="ICU",
                scheduled_date=date.today(),
                frequency_days=30,
                status="Overdue",
            ),
        ])
        self.session.commit()

        result = notification_feed(self.session, SimpleNamespace(role="Manager", username="admin", department=None))
        kinds = {item["kind"] for item in result["items"]}

        self.assertIn("critical-call", kinds)
        self.assertIn("stock", kinds)
        self.assertIn("maintenance", kinds)
        self.assertIn("asset", kinds)

    def test_department_user_only_receives_owned_requests_and_department_pm(self):
        icu_asset = Asset(asset_code="ICU-ASSET", equipment_name="Monitor", department="ICU")
        ward_asset = Asset(asset_code="WARD-ASSET", equipment_name="Pump", department="Ward")
        self.session.add_all([icu_asset, ward_asset])
        self.session.flush()
        self.session.add_all([
            Request(ticket_number="MINE", created_by="nurse", department="ICU", status="In Progress"),
            Request(ticket_number="OTHER", created_by="other", department="Ward", status="Open"),
            PMSchedule(asset_id=icu_asset.id, department="ICU", scheduled_date=date.today(), frequency_days=30, status="Due"),
            PMSchedule(asset_id=ward_asset.id, department="Ward", scheduled_date=date.today(), frequency_days=30, status="Due"),
        ])
        self.session.commit()

        result = notification_feed(self.session, SimpleNamespace(role="User", username="nurse", department="ICU"))
        text = " ".join(item["title"] + " " + item["message"] for item in result["items"])

        self.assertIn("MINE", text)
        self.assertIn("Monitor", text)
        self.assertNotIn("OTHER", text)
        self.assertNotIn("Pump", text)


if __name__ == "__main__":
    unittest.main()
