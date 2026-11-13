import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.request import Request
from backend.routes.request_routes import (
    MaintenanceRequestCreate,
    create_request,
    get_kpis,
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
        with self.assertRaises(ValidationError):
            valid_request(failure_description="   ")
        with self.assertRaises(ValidationError):
            valid_request(priority="Immediate")

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


if __name__ == "__main__":
    unittest.main()
