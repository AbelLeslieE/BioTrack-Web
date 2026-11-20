"""Add the Central Store catalogue, engineer requests, and spare delivery workflow.

Run once from the project directory:
    python -m backend.migrations.add_central_store_workflow
"""

import shutil
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url

from backend.database import MIGRATION_DATABASE_URL, schema_engine
from backend.models import Base  # noqa: F401 - registers every model


CENTRAL_TABLES = ("central_store_items", "spare_part_requests", "store_delivery_tasks")


def _backup_sqlite() -> None:
    if not MIGRATION_DATABASE_URL.startswith("sqlite:"):
        return
    database_name = make_url(MIGRATION_DATABASE_URL).database
    if not database_name:
        return
    database_path = Path(database_name).resolve()
    backup_path = database_path.with_suffix(".before-central-store.db")
    if database_path.exists() and not backup_path.exists():
        shutil.copy2(database_path, backup_path)
        print(f"Backup created: {backup_path}")


def _sqlite_add_central_store_role() -> bool:
    if not MIGRATION_DATABASE_URL.startswith("sqlite:"):
        return False
    with schema_engine.connect() as connection:
        users_sql = connection.execute(
            text("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
        ).scalar() or ""
    if "CentralStore" in users_sql:
        return False

    with schema_engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        transaction = connection.begin()
        try:
            connection.execute(text("ALTER TABLE users RENAME TO users_before_central_store"))
            connection.execute(text("""
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    username VARCHAR NOT NULL UNIQUE,
                    password_hash VARCHAR NOT NULL,
                    department VARCHAR,
                    name VARCHAR,
                    email VARCHAR,
                    phone VARCHAR,
                    role VARCHAR NOT NULL CHECK(role IN (
                        'BME', 'Electrical', 'IT', 'User', 'Manager', 'WardBoy', 'CentralStore'
                    )),
                    created_at DATETIME
                )
            """))
            connection.execute(text("""
                INSERT INTO users (id, username, password_hash, department, name, email, phone, role, created_at)
                SELECT id, username, password_hash, department, name, email, phone,
                       CASE WHEN role IN ('BME', 'Electrical', 'IT', 'User', 'Manager', 'WardBoy', 'CentralStore')
                            THEN role ELSE 'User' END,
                       created_at
                FROM users_before_central_store
            """))
            connection.execute(text("DROP TABLE users_before_central_store"))
            transaction.commit()
        except Exception:
            transaction.rollback()
            raise
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()
    return True


def _seed_catalogue() -> int:
    inventory_table = Base.metadata.tables["inventory"]
    catalogue_table = Base.metadata.tables["central_store_items"]
    with schema_engine.begin() as connection:
        existing = {
            str(row[0]).strip().casefold()
            for row in connection.execute(catalogue_table.select().with_only_columns(catalogue_table.c.item_code))
            if row[0] and str(row[0]).strip()
        }
        added = 0
        for row in connection.execute(inventory_table.select().order_by(inventory_table.c.id)).mappings():
            code = str(row.get("bpk_number") or f"INV-{row['id']}").strip()
            if code.casefold() in existing:
                continue
            connection.execute(catalogue_table.insert().values(
                item_code=code,
                item_name=row.get("item_name") or code,
                category=row.get("category") or "",
                manufacturer=row.get("manufacturer") or "",
                supplier=row.get("supplier") or "",
                unit=row.get("unit") or "pieces",
                current_stock=0,
                minimum_stock=row.get("minimum_stock") or 5,
                maximum_stock=row.get("maximum_stock") or 100,
                location="Central Store",
                rack="",
                purchase_price=row.get("purchase_price") or 0,
                active=True,
            ))
            existing.add(code.casefold())
            added += 1
    return added


def migrate() -> bool:
    inspector = inspect(schema_engine)
    tables = set(inspector.get_table_names())
    if "users" not in tables or "inventory" not in tables or "requests" not in tables:
        raise RuntimeError("The users, inventory, and requests tables must exist before this migration.")

    _backup_sqlite()
    new_tables = set(CENTRAL_TABLES) - tables
    for table_name in CENTRAL_TABLES:
        Base.metadata.tables[table_name].create(bind=schema_engine, checkfirst=True)

    role_updated = _sqlite_add_central_store_role()
    seeded = _seed_catalogue()
    if not new_tables and not role_updated and not seeded:
        print("Central Store workflow is already applied.")
        return False

    print(
        "Central Store workflow is ready "
        f"({len(new_tables)} tables created, {seeded} catalogue names imported)."
    )
    return True


if __name__ == "__main__":
    migrate()
