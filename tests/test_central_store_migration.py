import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect, text


class CentralStoreMigrationTests(unittest.TestCase):
    def test_legacy_sqlite_database_gains_role_tables_and_catalogue(self):
        project_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix="biotrack-central-store-") as directory:
            database_path = Path(directory) / "legacy.db"
            database_url = f"sqlite:///{database_path.as_posix()}"
            engine = create_engine(database_url)
            with engine.begin() as connection:
                connection.execute(text("""
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY, username VARCHAR NOT NULL UNIQUE,
                        password_hash VARCHAR NOT NULL, department VARCHAR, name VARCHAR,
                        email VARCHAR, phone VARCHAR,
                        role VARCHAR NOT NULL CHECK(role IN ('BME','Electrical','IT','User','Manager','WardBoy')),
                        created_at DATETIME
                    )
                """))
                connection.execute(text("""
                    CREATE TABLE inventory (
                        id INTEGER PRIMARY KEY, bpk_number VARCHAR NOT NULL, item_name VARCHAR NOT NULL,
                        category VARCHAR, manufacturer VARCHAR, supplier VARCHAR, unit VARCHAR,
                        current_stock INTEGER DEFAULT 0, reserved_stock INTEGER DEFAULT 0,
                        minimum_stock INTEGER DEFAULT 5, maximum_stock INTEGER DEFAULT 100,
                        location VARCHAR, rack VARCHAR, batch_number VARCHAR, purchase_price FLOAT DEFAULT 0,
                        remarks VARCHAR, service_team VARCHAR NOT NULL DEFAULT 'Biomedical',
                        created_at DATETIME, updated_at DATETIME
                    )
                """))
                connection.execute(text("CREATE TABLE requests (id INTEGER PRIMARY KEY)"))
                connection.execute(text("""
                    INSERT INTO inventory (bpk_number, item_name, unit, service_team)
                    VALUES ('LEGACY-1', 'Legacy battery', 'pieces', 'Biomedical')
                """))
            engine.dispose()

            environment = os.environ.copy()
            environment["DATABASE_URL"] = database_url
            environment["DATABASE_URL_UNPOOLED"] = database_url
            result = subprocess.run(
                [sys.executable, "-m", "backend.migrations.add_central_store_workflow"],
                cwd=project_root,
                env=environment,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

            engine = create_engine(database_url)
            inspector = inspect(engine)
            self.assertTrue({"central_store_items", "spare_part_requests", "store_delivery_tasks"}.issubset(inspector.get_table_names()))
            with engine.connect() as connection:
                users_sql = connection.execute(text("SELECT sql FROM sqlite_master WHERE name='users'")).scalar()
                catalogue_count = connection.execute(text("SELECT COUNT(*) FROM central_store_items")).scalar()
            self.assertIn("CentralStore", users_sql)
            self.assertEqual(catalogue_count, 1)
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
