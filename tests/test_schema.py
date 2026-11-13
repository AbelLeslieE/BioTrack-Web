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
                "pm_schedules",
                "pm_history",
                "departments",
                "manufacturers",
                "suppliers",
                "logs",
            }.issubset(tables)
        )


if __name__ == "__main__":
    unittest.main()
