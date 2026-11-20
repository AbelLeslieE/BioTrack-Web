import unittest
from datetime import date, timedelta
from io import BytesIO
from types import SimpleNamespace

from PIL import Image
import fitz
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.inventory import Inventory
from backend.models.request import Request
from backend.models.user import User
from backend.models.vendor_contract import VendorContract, VendorServiceHistory
from backend.routes.engineer_routes import (
    AssignmentUpdate,
    SparePartUse,
    TicketUpdate,
    assign_ticket,
    update_ticket,
)
from backend.routes.vendor_routes import list_contracts
from backend.services.attachment_service import TARGET_ATTACHMENT_BYTES, optimize_attachment


class ServiceOperationsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        User.__table__.create(self.engine)
        Request.__table__.create(self.engine)
        Inventory.__table__.create(self.engine)
        VendorContract.__table__.create(self.engine)
        VendorServiceHistory.__table__.create(self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self.manager = SimpleNamespace(role="Manager", username="admin", name="Admin")

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_parts_are_reserved_then_consumed_with_cost(self):
        item = Inventory(
            bpk_number="BIO-PART-1",
            item_name="Pump battery",
            service_team="Biomedical",
            current_stock=5,
            reserved_stock=0,
            purchase_price=125,
        )
        ticket = Request(ticket_number="BT-RESERVE", service_team="Biomedical", status="In Progress")
        self.session.add_all([item, ticket])
        self.session.commit()

        update_ticket(
            ticket.id,
            TicketUpdate(status="In Progress", spare_parts=[SparePartUse(inventory_id=item.id, quantity=2)]),
            self.session,
            self.manager,
        )
        self.session.refresh(item)
        self.session.refresh(ticket)
        self.assertEqual(item.current_stock, 5)
        self.assertEqual(item.reserved_stock, 2)
        self.assertTrue(ticket.parts_reserved)
        self.assertEqual(ticket.parts_cost, 250)

        update_ticket(
            ticket.id,
            TicketUpdate(status="In Progress", complete_work=True, spare_parts=[SparePartUse(inventory_id=item.id, quantity=2)]),
            self.session,
            self.manager,
        )
        self.session.refresh(item)
        self.session.refresh(ticket)
        self.assertEqual(item.current_stock, 3)
        self.assertEqual(item.reserved_stock, 0)
        self.assertTrue(ticket.stock_deducted)
        self.assertFalse(ticket.parts_reserved)

    def test_assignment_moves_open_call_to_assigned(self):
        technician = User(
            username="bme.tech",
            name="BME Technician",
            role="BME",
            department="Biomedical",
            email="bme@example.com",
            phone="1",
            password_hash="test",
        )
        ticket = Request(ticket_number="BT-ASSIGN", service_team="Biomedical", status="Open")
        self.session.add_all([technician, ticket])
        self.session.commit()

        result = assign_ticket(
            ticket.id,
            AssignmentUpdate(username=technician.username),
            self.session,
            self.manager,
        )
        self.assertEqual(result["status"], "Assigned")
        self.assertEqual(result["assigned_to_name"], "BME Technician")

    def test_vendor_contracts_are_scoped_to_engineering_team(self):
        self.session.add_all([
            VendorContract(vendor_name="Bio Vendor", service_team="Biomedical", contract_type="AMC", start_date=date.today(), end_date=date.today() + timedelta(days=120)),
            VendorContract(vendor_name="IT Vendor", service_team="IT", contract_type="CMC", start_date=date.today(), end_date=date.today() + timedelta(days=20)),
        ])
        self.session.commit()

        visible = list_contracts(self.session, SimpleNamespace(role="IT"))
        self.assertEqual([item["vendor_name"] for item in visible], ["IT Vendor"])
        self.assertEqual(visible[0]["renewal_state"], "Renewal due")

    def test_images_are_compressed_to_kilobyte_target(self):
        source = BytesIO()
        Image.effect_noise((2600, 2600), 90).convert("RGB").save(source, "PNG")
        optimized, content_type, extension = optimize_attachment("evidence.png", "image/png", source.getvalue())
        self.assertLessEqual(len(optimized), TARGET_ATTACHMENT_BYTES)
        self.assertEqual(content_type, "image/jpeg")
        self.assertEqual(extension, ".jpg")

    def test_pdfs_are_optimized_to_kilobyte_target(self):
        document = fitz.open()
        page = document.new_page()
        page.insert_text((72, 72), "BioTrack service evidence")
        optimized, content_type, extension = optimize_attachment(
            "service-report.pdf",
            "application/pdf",
            document.tobytes(),
        )
        document.close()
        self.assertLessEqual(len(optimized), TARGET_ATTACHMENT_BYTES)
        self.assertEqual(content_type, "application/pdf")
        self.assertEqual(extension, ".pdf")


if __name__ == "__main__":
    unittest.main()
