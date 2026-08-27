"""Add idempotent inventory-consumption tracking to maintenance requests.

Run once from the project directory:
    python -m backend.migrations.add_spare_parts_stock_consumption
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
    if "requests" not in inspector.get_table_names():
        raise RuntimeError("The requests table was not found.")
    if "stock_deducted" in {column["name"] for column in inspector.get_columns("requests")}:
        print("Spare-parts stock tracking is already applied.")
        return False

    backup_path = database_path.with_suffix(".before-spare-parts-stock.db")
    if database_path.exists() and not backup_path.exists():
        shutil.copy2(database_path, backup_path)
        print(f"Backup created: {backup_path}")

    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE requests ADD COLUMN stock_deducted BOOLEAN NOT NULL DEFAULT 0")
        )
    print("Spare-parts stock tracking applied successfully.")
    return True


if __name__ == "__main__":
    migrate()
