import unittest
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.inventory import Inventory
from backend.routes.inventory_routes import (
    create_inventory_item,
    delete_inventory_item,
    update_inventory_item,
)


class InventoryActionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Inventory.__table__.create(self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self.manager = SimpleNamespace(role="Manager")

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_create_edit_and_delete_inventory_item(self):
        created = create_inventory_item(
            {
                "bpk_number": "BPK-ACTION-1",
                "item_name": "Test battery",
                "current_stock": 4,
                "minimum_stock": 2,
                "maximum_stock": 10,
                "service_team": "IT",
            },
            self.session,
            self.manager,
        )

        item_id = created["id"]
        updated = update_inventory_item(
            item_id,
            {
                "bpk_number": "BPK-ACTION-1",
                "item_name": "Updated battery",
                "category": "IT Spare",
                "manufacturer": "Test OEM",
                "supplier": "Test Supplier",
                "unit": "piece",
                "current_stock": 8,
                "minimum_stock": 3,
                "maximum_stock": 20,
                "location": "Main Store",
                "rack": "R-1",
                "batch_number": "LOT-10",
                "purchase_price": 125,
                "remarks": "Updated from inventory editor",
                "service_team": "IT",
            },
            self.session,
            self.manager,
        )

        self.assertTrue(updated["success"])
        saved = self.session.get(Inventory, item_id)
        self.assertEqual(saved.item_name, "Updated battery")
        self.assertEqual(saved.current_stock, 8)
        self.assertEqual(saved.batch_number, "LOT-10")
        self.assertEqual(saved.service_team, "IT")

        deleted = delete_inventory_item(item_id, self.session, self.manager)
        self.assertTrue(deleted["success"])
        self.assertIsNone(self.session.get(Inventory, item_id))

    def test_duplicate_bpk_returns_clear_conflict(self):
        payload = {
            "bpk_number": "BPK-DUPLICATE",
            "item_name": "First item",
            "service_team": "Biomedical",
        }
        create_inventory_item(payload, self.session, self.manager)

        with self.assertRaises(HTTPException) as raised:
            create_inventory_item(
                {**payload, "item_name": "Second item"},
                self.session,
                self.manager,
            )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("already exists", raised.exception.detail)


if __name__ == "__main__":
    unittest.main()
