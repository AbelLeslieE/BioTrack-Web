"""Separate existing Assets and Inventory into Biomedical and Electrical data sets.

Existing records are preserved and assigned to Biomedical. New records receive their
team from the authenticated engineer who creates or imports them.

Run once from the project directory:
    python -m backend.migrations.separate_engineering_assets_inventory
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
    target_tables = ("assets", "inventory")
    missing = [name for name in target_tables if name not in inspector.get_table_names()]
    if missing:
        raise RuntimeError(f"Expected database tables were not found: {', '.join(missing)}")

    tables_to_update = [
        name
        for name in target_tables
        if "service_team" not in {column["name"] for column in inspector.get_columns(name)}
    ]
    if not tables_to_update:
        print("Asset and Inventory separation is already applied.")
        return False

    backup_path = database_path.with_suffix(".before-team-separation.db")
    if database_path.exists() and not backup_path.exists():
        shutil.copy2(database_path, backup_path)
        print(f"Backup created: {backup_path}")

    with engine.begin() as connection:
        for table_name in tables_to_update:
            connection.execute(
                text(
                    f"ALTER TABLE {table_name} ADD COLUMN service_team "
                    "VARCHAR NOT NULL DEFAULT 'Biomedical'"
                )
            )

    print("Assets and Inventory are now separated by engineering department.")
    return True


if __name__ == "__main__":
    migrate()
