import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class DatabaseUploadMigrationTests(unittest.TestCase):
    def test_migration_adds_blob_columns_to_legacy_upload_tables(self):
        project_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="biotrack-upload-migration-") as directory:
            database_path = Path(directory) / "legacy.db"
            connection = sqlite3.connect(database_path)
            connection.executescript(
                """
                CREATE TABLE asset_documents (id INTEGER PRIMARY KEY, file_path TEXT NOT NULL);
                CREATE TABLE request_attachments (id INTEGER PRIMARY KEY, stored_name TEXT NOT NULL);
                """
            )
            connection.close()
            database_url = f"sqlite:///{database_path.as_posix()}"
            environment = os.environ.copy()
            environment["DATABASE_URL"] = database_url
            environment["DATABASE_URL_UNPOOLED"] = database_url
            command = [sys.executable, "-m", "backend.migrations.store_uploads_in_database"]

            first = subprocess.run(command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            second = subprocess.run(command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
            self.assertIn("already applied", second.stdout)

            connection = sqlite3.connect(database_path)
            try:
                for table_name in ("asset_documents", "request_attachments"):
                    columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table_name})")}
                    self.assertIn("file_data", columns)
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()
