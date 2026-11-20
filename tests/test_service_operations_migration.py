import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect, text


class ServiceOperationsMigrationTests(unittest.TestCase):
    def test_legacy_database_gains_operations_tables_and_document_metadata(self):
        project_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="biotrack-service-operations-") as directory:
            database_path = Path(directory) / "legacy.db"
            database_url = f"sqlite:///{database_path.as_posix()}"
            engine = create_engine(database_url)
            with engine.begin() as connection:
                connection.execute(text("CREATE TABLE requests (id INTEGER PRIMARY KEY)"))
                connection.execute(text("CREATE TABLE inventory (id INTEGER PRIMARY KEY)"))
                connection.execute(text("""
                    CREATE TABLE asset_documents (
                        id INTEGER PRIMARY KEY,
                        asset_id INTEGER NOT NULL,
                        document_name VARCHAR NOT NULL,
                        document_type VARCHAR,
                        file_path VARCHAR NOT NULL,
                        uploaded_by VARCHAR,
                        uploaded_at DATETIME
                    )
                """))
            engine.dispose()

            environment = os.environ.copy()
            environment["DATABASE_URL"] = database_url
            environment["DATABASE_URL_UNPOOLED"] = database_url
            result = subprocess.run(
                [sys.executable, "-m", "backend.migrations.add_service_operations_features"],
                cwd=project_root,
                env=environment,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

            engine = create_engine(database_url)
            inspector = inspect(engine)
            self.assertTrue({"request_attachments", "vendor_contracts", "vendor_service_history"}.issubset(inspector.get_table_names()))
            columns = {column["name"] for column in inspector.get_columns("asset_documents")}
            self.assertTrue({"content_type", "original_size_bytes", "stored_size_bytes"}.issubset(columns))
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
