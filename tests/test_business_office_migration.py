import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect, text


class BusinessOfficeMigrationTests(unittest.TestCase):
    def test_existing_sqlite_database_gains_business_role_and_tables(self):
        project_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="biotrack-business-") as directory:
            database_path = Path(directory) / "existing.db"
            database_url = f"sqlite:///{database_path.as_posix()}"
            engine = create_engine(database_url)
            with engine.begin() as connection:
                connection.execute(text("""
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY, username VARCHAR NOT NULL UNIQUE,
                        password_hash VARCHAR NOT NULL, department VARCHAR, name VARCHAR,
                        email VARCHAR, phone VARCHAR,
                        role VARCHAR NOT NULL CHECK(role IN ('BME','Electrical','IT','User','Manager','WardBoy','CentralStore')),
                        created_at DATETIME, is_active BOOLEAN NOT NULL DEFAULT 1,
                        failed_login_attempts INTEGER NOT NULL DEFAULT 0, locked_until DATETIME,
                        last_login_at DATETIME, password_changed_at DATETIME,
                        mfa_enabled BOOLEAN NOT NULL DEFAULT 0, mfa_secret TEXT, mfa_pending_secret TEXT
                    )
                """))
                connection.execute(text("INSERT INTO users (id, username, password_hash, role) VALUES (1, 'admin', 'x', 'Manager')"))
            engine.dispose()

            environment = os.environ.copy()
            environment["DATABASE_URL"] = database_url
            environment["DATABASE_URL_UNPOOLED"] = database_url
            result = subprocess.run([sys.executable, "-m", "backend.migrations.add_business_office"], cwd=project_root, env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

            engine = create_engine(database_url)
            inspector = inspect(engine)
            self.assertTrue({"business_budgets", "purchase_requests", "business_transactions", "insurance_policies", "insurance_claim_batches"}.issubset(inspector.get_table_names()))
            with engine.begin() as connection:
                users_sql = connection.execute(text("SELECT sql FROM sqlite_master WHERE name='users'")).scalar()
                connection.execute(text("INSERT INTO users (id, username, password_hash, role) VALUES (2, 'finance', 'x', 'Business')"))
                count = connection.execute(text("SELECT COUNT(*) FROM users")).scalar()
            self.assertIn("Business", users_sql)
            self.assertEqual(count, 2)
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
