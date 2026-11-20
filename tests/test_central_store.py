import unittest
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.central_store import CentralStoreItem, SparePartRequest, StoreDeliveryTask
from backend.models.inventory import Inventory
from backend.models.request import Request
from backend.routes.central_store_routes import (
    SpareRequestCreate,
    StoreRequestAction,
    central_store_dashboard,
    confirm_spare_receipt,
    create_spare_request,
    my_spare_requests,
    process_spare_request,
)
from backend.routes.ward_boy_routes import accept_store_delivery_task, complete_store_delivery_task


class CentralStoreWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        for table in (
            Request.__table__,
            Inventory.__table__,
            CentralStoreItem.__table__,
            SparePartRequest.__table__,
            StoreDeliveryTask.__table__,
        ):
            table.create(self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self.engineer = SimpleNamespace(role="BME", username="bio.one", name="Bio Engineer")
        self.store = SimpleNamespace(role="CentralStore", username="store.one", name="Store Officer")
        self.ward_boy = SimpleNamespace(role="WardBoy", username="ward.one", name="Ward Boy")
        self.item = CentralStoreItem(
            item_code="BAT-001",
            item_name="Defibrillator battery",
            category="Biomedical Spare",
            unit="pieces",
            current_stock=8,
            minimum_stock=2,
            maximum_stock=20,
            location="Central Store",
        )
        self.session.add(self.item)
        self.session.commit()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_internal_stock_delivery_needs_ward_boy_and_engineer_completion(self):
        created = create_spare_request(
            SpareRequestCreate(
                request_type="Internal",
                central_store_item_id=self.item.id,
                quantity=2,
                unit="pieces",
                request_reason="General",
                priority="High",
                delivery_location="Biomedical Engineering Workshop",
            ),
            self.session,
            self.engineer,
        )
        request_id = created["request"]["id"]

        approved = process_spare_request(
            request_id,
            StoreRequestAction(action="Approve"),
            self.session,
            self.store,
        )
        self.assertEqual(approved["request"]["status"], "Ready")
        self.assertEqual(self.session.get(CentralStoreItem, self.item.id).current_stock, 6)

        dispatched = process_spare_request(
            request_id,
            StoreRequestAction(action="DispatchWardBoy"),
            self.session,
            self.store,
        )
        delivery_id = dispatched["request"]["delivery_task"]["id"]
        accept_store_delivery_task(delivery_id, self.session, self.ward_boy)
        delivered = complete_store_delivery_task(delivery_id, self.session, self.ward_boy)
        self.assertEqual(delivered["task"]["status"], "Completed")
        self.assertEqual(self.session.get(SparePartRequest, request_id).status, "Awaiting Engineer Confirmation")

        completed = confirm_spare_receipt(request_id, self.session, self.engineer)
        self.assertEqual(completed["request"]["status"], "Completed")
        self.assertIsNotNone(completed["request"]["ward_boy_completed_at"])
        self.assertIsNotNone(completed["request"]["engineer_confirmed_at"])

    def test_external_requirement_enters_procurement_and_master_catalogue(self):
        created = create_spare_request(
            SpareRequestCreate(
                request_type="External",
                item_name="OEM ultrasound trackball",
                item_code="US-TRACK-9",
                specification="Compatible with Acme U9 console",
                quantity=1,
                unit="piece",
                request_reason="External Item",
                priority="Medium",
                delivery_location="Biomedical Engineering Workshop",
            ),
            self.session,
            self.engineer,
        )
        request_id = created["request"]["id"]
        approved = process_spare_request(request_id, StoreRequestAction(action="Approve"), self.session, self.store)
        self.assertEqual(approved["request"]["status"], "Awaiting Procurement")
        ready = process_spare_request(request_id, StoreRequestAction(action="MarkReady"), self.session, self.store)
        self.assertEqual(ready["request"]["status"], "Ready")
        self.assertEqual(self.session.query(CentralStoreItem).filter_by(item_code="US-TRACK-9").one().item_name, "OEM ultrasound trackball")

    def test_dashboard_separates_low_and_out_of_stock_engineering_items(self):
        self.session.add_all([
            Inventory(bpk_number="LOW-1", item_name="Low item", service_team="Electrical", current_stock=2, reserved_stock=0, minimum_stock=3, unit="pieces"),
            Inventory(bpk_number="OUT-1", item_name="Out item", service_team="IT", current_stock=1, reserved_stock=1, minimum_stock=2, unit="pieces"),
        ])
        self.session.commit()
        dashboard = central_store_dashboard(self.session, self.store)
        self.assertEqual([row["item_name"] for row in dashboard["low_stock"]], ["Low item"])
        self.assertEqual([row["item_name"] for row in dashboard["out_of_stock"]], ["Out item"])
        self.assertIn("LOW-1", {item["item_code"] for item in dashboard["catalogue"]})

    def test_engineers_only_receive_their_team_request_queue(self):
        create_spare_request(
            SpareRequestCreate(request_type="Internal", central_store_item_id=self.item.id, quantity=1),
            self.session,
            self.engineer,
        )
        it_engineer = SimpleNamespace(role="IT", username="it.one", name="IT Engineer")
        self.assertEqual(len(my_spare_requests(self.session, self.engineer)), 1)
        self.assertEqual(my_spare_requests(self.session, it_engineer), [])
        self.assertEqual(central_store_dashboard(self.session, self.store)["summary"]["completed_today"], 0)


if __name__ == "__main__":
    unittest.main()
