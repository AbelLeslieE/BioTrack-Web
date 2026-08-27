"""Add Electrical Engineer support without applying schema changes at app startup.

Run once from the project directory:
    python -m backend.migrations.add_electrical_engineer_support
"""

import shutil
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from backend.database import DATABASE_URL


def _sqlite_database_path() -> Path:
    if not DATABASE_URL.startswith("sqlite:///"):
        raise RuntimeError("This migration currently supports SQLite databases only.")
    return Path(DATABASE_URL[len("sqlite:///") :]).resolve()


def migrate() -> bool:
    database_path = _sqlite_database_path()
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names() or "requests" not in inspector.get_table_names():
        raise RuntimeError("Expected users and requests tables were not found.")

    needs_team_column = "service_team" not in {column["name"] for column in inspector.get_columns("requests")}
    with engine.connect() as connection:
        users_sql = connection.execute(
            text("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
        ).scalar() or ""
    needs_role_update = "Electrical" not in users_sql or "IT" not in users_sql
    if not needs_team_column and not needs_role_update:
        print("Electrical Engineer migration is already applied.")
        return False

    backup_path = database_path.with_suffix(".before-electrical-migration.db")
    if database_path.exists() and not backup_path.exists():
        shutil.copy2(database_path, backup_path)
        print(f"Backup created: {backup_path}")

    with engine.begin() as connection:
        if needs_team_column:
            connection.execute(
                text(
                    "ALTER TABLE requests ADD COLUMN service_team "
                    "VARCHAR NOT NULL DEFAULT 'Biomedical'"
                )
            )

        if needs_role_update:
            connection.execute(text("ALTER TABLE users RENAME TO users_before_electrical"))
            connection.execute(
                text(
                    """
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY,
                        username VARCHAR NOT NULL UNIQUE,
                        password_hash VARCHAR NOT NULL,
                        department VARCHAR,
                        name VARCHAR,
                        email VARCHAR,
                        phone VARCHAR,
                        role VARCHAR NOT NULL CHECK(role IN ('BME', 'Electrical', 'IT', 'User', 'Manager')),
                        created_at DATETIME
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    INSERT INTO users (id, username, password_hash, department, name, email, phone, role, created_at)
                    SELECT id, username, password_hash, department, name, email, phone,
                           CASE WHEN role IN ('BME', 'Electrical', 'IT', 'User', 'Manager') THEN role ELSE 'User' END,
                           created_at
                    FROM users_before_electrical
                    """
                )
            )
            connection.execute(text("DROP TABLE users_before_electrical"))

    print("Electrical Engineer and IT Department migration applied successfully.")
    return True


if __name__ == "__main__":
    migrate()
