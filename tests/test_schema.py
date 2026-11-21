import sqlite3
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect

from backend.models import Base


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

        self.assertEqual(tables, set(Base.metadata.tables))

        orm_engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(orm_engine)
        orm_inspector = inspect(orm_engine)
        try:
            connection = sqlite3.connect(":memory:")
            connection.executescript(schema_path.read_text(encoding="utf-8"))
            for table in sorted(tables):
                schema_columns = {
                    row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')
                }
                orm_columns = {
                    column["name"] for column in orm_inspector.get_columns(table)
                }
                self.assertEqual(schema_columns, orm_columns, table)
        finally:
            connection.close()

        connection = sqlite3.connect(":memory:")
        try:
            connection.executescript(schema_path.read_text(encoding="utf-8"))
            columns = {row[1] for row in connection.execute("PRAGMA table_info(asset_documents)")}
        finally:
            connection.close()
        self.assertTrue({"content_type", "original_size_bytes", "stored_size_bytes"}.issubset(columns))


if __name__ == "__main__":
    unittest.main()
