import unittest
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.request import Request
from backend.models.ward_boy_task import WardBoyTask
from backend.routes.ward_boy_routes import (
    WardBoyTaskCreate,
    accept_ward_boy_task,
    complete_ward_boy_task,
    request_ward_boy,
    ward_boy_dashboard,
)


class WardBoyWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Request.__table__.create(self.engine)
        WardBoyTask.__table__.create(self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self.request = Request(
            ticket_number="BT-2026-000001",
            created_by="nurse",
            created_by_role="User",
            reported_by="Nurse",
            equipment_name="Defibrillator",
            equipment_identifier="DEF-001",
            department="Emergency",
            location="Bay 4",
            service_team="Biomedical",
            priority="Critical",
            status="Open",
        )
        self.session.add(self.request)
        self.session.commit()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_pickup_can_be_accepted_and_completed_by_a_ward_boy(self):
        nurse = SimpleNamespace(username="nurse", name="Nurse", role="User")
        ward_boy = SimpleNamespace(username="ward-one", name="Ravi", role="WardBoy")

        created = request_ward_boy(WardBoyTaskCreate(request_id=self.request.id, movement_type="Pickup"), self.session, nurse)
        task_id = created["task"]["id"]
        accepted = accept_ward_boy_task(task_id, self.session, ward_boy)
        completed = complete_ward_boy_task(task_id, self.session, ward_boy)

        self.assertEqual(accepted["task"]["assigned_to"], "Ravi")
        self.assertEqual(completed["task"]["status"], "Completed")
        self.assertEqual(ward_boy_dashboard(self.session, ward_boy)["summary"]["completed_today"], 1)

    def test_return_transport_requires_a_completed_repair(self):
        engineer = SimpleNamespace(username="bio", name="Bio Engineer", role="BME")
        payload = WardBoyTaskCreate(request_id=self.request.id, movement_type="Return")

        with self.assertRaises(HTTPException) as error:
            request_ward_boy(payload, self.session, engineer)
        self.assertEqual(error.exception.status_code, 422)

        self.request.status = "Completed"
        self.session.commit()
        result = request_ward_boy(payload, self.session, engineer)
        self.assertEqual(result["task"]["movement_type"], "Return")
        self.assertEqual(result["task"]["source_location"], "Biomedical Engineering Workshop")

    def test_department_user_cannot_request_return_transport(self):
        self.request.status = "Completed"
        self.session.commit()
        nurse = SimpleNamespace(username="nurse", name="Nurse", role="User")

        with self.assertRaises(HTTPException) as error:
            request_ward_boy(WardBoyTaskCreate(request_id=self.request.id, movement_type="Return"), self.session, nurse)
        self.assertEqual(error.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
