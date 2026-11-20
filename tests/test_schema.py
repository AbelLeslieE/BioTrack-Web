import sqlite3
import unittest
from pathlib import Path


class SchemaTests(unittest.TestCase):
    def test_schema_builds_every_application_table(self):
        schema_path = Path(__file__).resolve().parents[1] / "database" / "schema.sql"
        connection = sqlite3.connect(":memory:")
        try:
            connection.executescript(schema_path.read_text(encoding="utf-8"))
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                )
            }
        finally:
            connection.close()

        self.assertTrue(
            {
                "users",
                "assets",
                "asset_documents",
                "asset_history",
                "asset_spares",
                "devices",
                "inventory",
                "requests",
                "ward_boy_tasks",
                "pm_schedules",
                "pm_history",
                "departments",
                "manufacturers",
                "suppliers",
                "logs",
                "request_attachments",
                "vendor_contracts",
                "vendor_service_history",
                "central_store_items",
                "spare_part_requests",
                "store_delivery_tasks",
            }.issubset(tables)
        )

        connection = sqlite3.connect(":memory:")
        try:
            connection.executescript(schema_path.read_text(encoding="utf-8"))
            columns = {row[1] for row in connection.execute("PRAGMA table_info(asset_documents)")}
        finally:
            connection.close()
        self.assertTrue({"content_type", "original_size_bytes", "stored_size_bytes"}.issubset(columns))


if __name__ == "__main__":
    unittest.main()
