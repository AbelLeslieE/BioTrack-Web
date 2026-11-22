import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from backend.migrations.run_all import MIGRATIONS
from backend.models import Base


class ReleaseMigrationTests(unittest.TestCase):
    def test_runner_bootstraps_an_empty_database_and_is_idempotent(self):
        project_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="biotrack-release-") as directory:
            database_path = Path(directory) / "new-release.db"
            database_url = f"sqlite:///{database_path.as_posix()}"
            environment = os.environ.copy()
            environment["DATABASE_URL"] = database_url
            environment["DATABASE_URL_UNPOOLED"] = database_url
            command = [sys.executable, "-m", "backend.migrations.run_all"]

            first = subprocess.run(command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            second = subprocess.run(command, cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(second.returncode, 0, second.stdout + second.stderr)

            engine = create_engine(database_url)
            inspector = inspect(engine)
            self.assertEqual(set(inspector.get_table_names()), set(Base.metadata.tables))
            self.assertIn("file_data", {column["name"] for column in inspector.get_columns("asset_documents")})
            self.assertIn("file_data", {column["name"] for column in inspector.get_columns("request_attachments")})
            with engine.begin() as connection:
                connection.execute(text("INSERT INTO users (username, password_hash, role) VALUES ('release-finance', 'x', 'Business')"))
                self.assertEqual(connection.execute(text("SELECT role FROM users WHERE username='release-finance'")).scalar(), "Business")
            for migration in MIGRATIONS:
                self.assertIn(f"{migration}: already current", second.stdout)
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
