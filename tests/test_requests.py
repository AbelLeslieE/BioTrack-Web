import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.request import Request
from backend.models.ward_boy_task import WardBoyTask
from backend.routes.engineer_routes import get_ticket
from backend.routes.request_routes import (
    DowntimeOverride,
    MaintenanceRequestCreate,
    create_request,
    get_kpis,
    override_request_downtime,
)


def valid_request(**overrides):
    data = {
        "department": "Radiology",
        "location": "Room 12",
        "equipment_identifier": "EQ-100",
        "equipment_name": "Patient monitor",
        "make_model": "Acme M1",
        "priority": "Medium",
        "problem_category": "Breakdown",
        "service_team": "Biomedical",
        "failure_description": "Display is blank.",
    }
    data.update(overrides)
    return MaintenanceRequestCreate(**data)


class MaintenanceRequestTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Request.__table__.create(self.engine)
        WardBoyTask.__table__.create(self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self.user = SimpleNamespace(
            username="ward-user",
            name="Ward User",
            role="User",
            department="ICU",
        )

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_ticket_numbers_survive_deletions_without_collision(self):
        first = create_request(valid_request(), self.session, self.user)
        second = create_request(valid_request(equipment_identifier="EQ-101"), self.session, self.user)

        self.session.query(Request).filter(Request.ticket_number == first["ticket_number"]).delete()
        self.session.commit()
        third = create_request(valid_request(equipment_identifier="EQ-102"), self.session, self.user)

        self.assertEqual(len({first["ticket_number"], second["ticket_number"], third["ticket_number"]}), 3)
        self.assertEqual(
            self.session.query(Request).filter(Request.ticket_number == third["ticket_number"]).one().department,
            "ICU",
        )

    def test_request_fields_are_validated(self):
        self.assertEqual(valid_request(failure_description="   ").failure_description, "")
        with self.assertRaises(ValidationError):
            valid_request(priority="Immediate")

    def test_request_can_create_a_ward_boy_pickup_job(self):
        result = create_request(
            valid_request(request_ward_boy_pickup=True),
            self.session,
            self.user,
        )

        task = self.session.query(WardBoyTask).one()
        self.assertTrue(result["ward_boy_pickup_requested"])
        self.assertEqual(task.movement_type, "Pickup")
        self.assertEqual(task.status, "Pending")
        self.assertIn("ICU", task.source_location)
        self.assertEqual(task.destination_location, "Biomedical Engineering Workshop")

    def test_closed_today_excludes_older_closed_requests(self):
        now = datetime.now()
        self.session.add_all(
            [
                Request(ticket_number="BT-TODAY", status="Closed", fixed_datetime=now),
                Request(ticket_number="BT-OLD", status="Closed", fixed_datetime=now - timedelta(days=2)),
            ]
        )
        self.session.commit()

        self.assertEqual(get_kpis(self.session)["closed_today"], 1)

    def test_manager_can_replace_downtime_without_changing_calculated_value(self):
        received = datetime.now() - timedelta(hours=5)
        fixed = datetime.now()
        maintenance_request = Request(
            ticket_number="BT-OVERRIDE",
            status="Completed",
            call_received_datetime=received,
            fixed_datetime=fixed,
            calculated_downtime_hours=5,
            final_downtime_hours=5,
        )
        self.session.add(maintenance_request)
        self.session.commit()

        result = override_request_downtime(
            "BT-OVERRIDE",
            DowntimeOverride(hours=2.5),
            self.session,
            SimpleNamespace(role="Manager"),
        )
        self.session.refresh(maintenance_request)

        self.assertTrue(result["success"])
        self.assertEqual(maintenance_request.manual_downtime_hours, 2.5)
        self.assertEqual(maintenance_request.final_downtime_hours, 2.5)
        self.assertEqual(maintenance_request.calculated_downtime_hours, 5)
        self.assertEqual(maintenance_request.call_received_datetime, received)
        self.assertEqual(maintenance_request.fixed_datetime, fixed)

    def test_downtime_override_rejects_negative_values(self):
        with self.assertRaises(ValidationError):
            DowntimeOverride(hours=-0.01)

    def test_ticket_details_include_current_downtime(self):
        maintenance_request = Request(
            ticket_number="BT-DETAIL",
            status="Completed",
            final_downtime_hours=3.25,
        )
        self.session.add(maintenance_request)
        self.session.commit()

        result = get_ticket(
            maintenance_request.id,
            self.session,
            SimpleNamespace(role="Manager"),
        )

        self.assertEqual(result["downtime"], 3.25)


if __name__ == "__main__":
    unittest.main()
