import csv
import io
import json
import unittest
from datetime import date
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.asset import Asset
from backend.models.inventory import Inventory
from backend.models.pm_schedule import PMSchedule
from backend.models.request import Request
from backend.models.user import User
from backend.routes.settings_routes import download_backup, export_maintenance_data


class SettingsDownloadTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        for table in (User.__table__, Asset.__table__, Inventory.__table__, Request.__table__, PMSchedule.__table__):
            table.create(self.engine)
        self.session = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_manager_backup_downloads_real_data_without_password_hashes(self):
        asset = Asset(asset_code="BACKUP-1", equipment_name="Monitor", department="ICU")
        self.session.add_all([
            asset,
            User(username="manager", password_hash="secret-hash", role="Manager", email="manager@example.com"),
            Request(ticket_number="BT-BACKUP", equipment_name="Monitor", department="ICU"),
        ])
        self.session.commit()

        user = SimpleNamespace(role="Manager", username="manager", department=None)
        response = download_backup(self.session, user)
        payload = json.loads(response.body)

        self.assertIn("attachment", response.headers["content-disposition"])
        self.assertEqual(payload["data"]["requests"][0]["ticket_number"], "BT-BACKUP")
        self.assertNotIn("password_hash", payload["data"]["users"][0])

    def test_department_export_only_contains_the_users_requests(self):
        self.session.add_all([
            Request(ticket_number="MINE", created_by="nurse", department="ICU", status="Open"),
            Request(ticket_number="OTHER", created_by="another", department="Ward", status="Open"),
        ])
        self.session.commit()

        user = SimpleNamespace(role="User", username="nurse", department="ICU")
        response = export_maintenance_data(self.session, user)
        rows = list(csv.reader(io.StringIO(response.body.decode())))
        exported = " ".join(",".join(row) for row in rows)

        self.assertIn("MINE", exported)
        self.assertNotIn("OTHER", exported)


if __name__ == "__main__":
    unittest.main()
