import unittest
from datetime import date, timedelta
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.asset import Asset
from backend.models.pm_history import PMHistory
from backend.models.pm_schedule import PMSchedule
from backend.models.request import Request
from backend.routes.qr_routes import (
    complete_qr_preventive_maintenance,
    get_qr_asset_profile,
)


class QRRoleProfileTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Asset.__table__.create(self.engine)
        Request.__table__.create(self.engine)
        PMSchedule.__table__.create(self.engine)
        PMHistory.__table__.create(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        self.asset = Asset(
            asset_code="BT-IT-001",
            equipment_no="IT-0001",
            equipment_name="Nurse Station Workstation",
            classification="Computer",
            equipment_type="Desktop",
            manufacturer="Dell",
            model="OptiPlex 7010",
            serial_number="SER-QR-001",
            service_team="IT",
            supplier="Hospital IT Supplier",
            purchase_value=82500,
            purchase_date=date(2025, 1, 10),
            warranty="3 years",
            department="ICU",
            location="ICU Nurse Station",
            status="Active",
            pm_frequency=90,
            image_path="/static/uploads/workstation.png",
        )
        self.db.add(self.asset)
        self.db.flush()
        self.schedule = PMSchedule(
            asset_id=self.asset.id,
            department="ICU",
            location="ICU Nurse Station",
            scheduled_date=date.today() + timedelta(days=7),
            frequency_days=90,
            status="Upcoming",
        )
        self.db.add(self.schedule)
        self.db.flush()
        self.db.add(
            PMHistory(
                asset_id=self.asset.id,
                pm_schedule_id=self.schedule.id,
                engineer_name="IT Engineer",
                scheduled_date=date.today() - timedelta(days=90),
                completed_date=date.today() - timedelta(days=85),
                remarks="Quarterly checks completed.",
            )
        )
        self.db.add(
            Request(
                ticket_number="BT-2026-000001",
                equipment_identifier="IT-0001",
                equipment_name=self.asset.equipment_name,
                service_team="IT",
                status="Completed",
                work_done="Power supply replaced.",
            )
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def user(self, role, department=None, user_id=1):
        return SimpleNamespace(
            id=user_id,
            role=role,
            department=department,
            name=f"{role} Test",
            username=f"{role.lower()}-test",
        )

    def test_manager_receives_full_asset_and_lifecycle_details(self):
        result = get_qr_asset_profile(self.asset.id, self.db, self.user("Manager"))

        self.assertEqual(result["view"], "admin")
        self.assertEqual(result["asset"]["warranty"], "3 years")
        self.assertEqual(result["asset"]["purchase_value"], 82500)
        self.assertEqual(result["maintenance"]["completed_repairs"], 1)
        self.assertEqual(len(result["maintenance"]["pm_history"]), 1)

    def test_department_user_receives_only_safe_identity_and_ticket_defaults(self):
        result = get_qr_asset_profile(
            self.asset.id,
            self.db,
            self.user("User", department="ICU"),
        )

        self.assertEqual(result["view"], "department")
        self.assertEqual(result["asset"]["serial_number"], "SER-QR-001")
        self.assertEqual(result["ticket_defaults"]["equipment_identifier"], "IT-0001")
        self.assertTrue(result["actions"]["can_start_maintenance_call"])
        self.assertNotIn("warranty", result["asset"])
        self.assertNotIn("purchase_value", result["asset"])
        self.assertNotIn("repairs", result["maintenance"])

    def test_department_user_cannot_open_another_departments_asset(self):
        with self.assertRaises(HTTPException) as error:
            get_qr_asset_profile(
                self.asset.id,
                self.db,
                self.user("User", department="Radiology"),
            )
        self.assertEqual(error.exception.status_code, 404)

    def test_engineer_receives_service_history_only_for_their_team(self):
        result = get_qr_asset_profile(self.asset.id, self.db, self.user("IT"))

        self.assertEqual(result["view"], "engineer")
        self.assertEqual(result["asset"]["purchase_date"], date(2025, 1, 10))
        self.assertEqual(result["maintenance"]["repairs"][0]["work_done"], "Power supply replaced.")
        self.assertTrue(result["actions"]["can_complete_pm"])

        with self.assertRaises(HTTPException) as error:
            get_qr_asset_profile(self.asset.id, self.db, self.user("BME"))
        self.assertEqual(error.exception.status_code, 404)

    def test_engineer_confirmation_records_pm_and_rolls_schedule_forward(self):
        before_count = self.db.query(PMHistory).count()
        result = complete_qr_preventive_maintenance(
            self.asset.id,
            self.db,
            self.user("IT", user_id=44),
        )

        self.db.refresh(self.schedule)
        newest = self.db.query(PMHistory).order_by(PMHistory.id.desc()).first()
        self.assertTrue(result["success"])
        self.assertEqual(result["last_pm_date"], date.today())
        self.assertEqual(self.schedule.scheduled_date, date.today() + timedelta(days=90))
        self.assertEqual(self.schedule.status, "Upcoming")
        self.assertEqual(self.db.query(PMHistory).count(), before_count + 1)
        self.assertEqual(newest.engineer_id, 44)
        self.assertEqual(newest.completed_date, date.today())


if __name__ == "__main__":
    unittest.main()
