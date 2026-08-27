"""Add department confirmation fields to preventive-maintenance schedules.

Run once from the project directory:
    python -m backend.migrations.add_pm_department_responses
"""

import shutil
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

from backend.database import DATABASE_URL


def migrate() -> bool:
    if not DATABASE_URL.startswith("sqlite:///"):
        raise RuntimeError("This migration currently supports SQLite databases only.")

    database_path = Path(DATABASE_URL[len("sqlite:///") :]).resolve()
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    if "pm_schedules" not in inspector.get_table_names():
        raise RuntimeError("The pm_schedules table was not found.")

    columns = {column["name"] for column in inspector.get_columns("pm_schedules")}
    pending_columns = {
        "department_response": "TEXT NOT NULL DEFAULT 'Pending'",
        "department_response_note": "TEXT",
        "department_response_at": "DATETIME",
    }
    missing = {name: definition for name, definition in pending_columns.items() if name not in columns}
    if not missing:
        print("PM department-response tracking is already applied.")
        return False

    backup_path = database_path.with_suffix(".before-pm-responses.db")
    if database_path.exists() and not backup_path.exists():
        shutil.copy2(database_path, backup_path)
        print(f"Backup created: {backup_path}")

    with engine.begin() as connection:
        for name, definition in missing.items():
            connection.execute(text(f"ALTER TABLE pm_schedules ADD COLUMN {name} {definition}"))

    print("PM department-response tracking applied successfully.")
    return True


if __name__ == "__main__":
    migrate()
