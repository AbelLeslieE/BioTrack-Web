"""Make inventory part codes unique per engineering department.

The inventory module originally used one global unique BPK constraint. Department
stores are independent, so Biomedical, Electrical and IT must be able to use the
same vendor part code without sharing a stock record.

Run once from the project directory:
    python -m backend.migrations.scope_inventory_bpk_to_service_team
"""

import shutil
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url

from backend.database import MIGRATION_DATABASE_URL, schema_engine


COMPOSITE_CONSTRAINT = "uq_inventory_service_team_bpk"


def _already_scoped(inspector) -> bool:
    expected = {"service_team", "bpk_number"}
    return any(
        set(constraint.get("column_names") or []) == expected
        for constraint in inspector.get_unique_constraints("inventory")
    )


def _migrate_postgresql() -> None:
    inspector = inspect(schema_engine)
    constraints = inspector.get_unique_constraints("inventory")
    global_constraints = [
        item["name"]
        for item in constraints
        if item.get("name") and item.get("column_names") == ["bpk_number"]
    ]
    with schema_engine.begin() as connection:
        for name in global_constraints:
            connection.execute(text(f'ALTER TABLE inventory DROP CONSTRAINT "{name}"'))
        connection.execute(text(
            f"ALTER TABLE inventory ADD CONSTRAINT {COMPOSITE_CONSTRAINT} "
            "UNIQUE (service_team, bpk_number)"
        ))


def _migrate_sqlite() -> None:
    # SQLite cannot drop an inline UNIQUE constraint. Rebuild only this table,
    # preserving IDs so maintenance-record foreign keys remain valid.
    database_name = make_url(MIGRATION_DATABASE_URL).database
    if not database_name:
        raise RuntimeError("Unable to resolve the SQLite database path.")
    database_path = Path(database_name).resolve()
    backup_path = database_path.with_suffix(".before-inventory-team-unique.db")
    if database_path.exists() and not backup_path.exists():
        shutil.copy2(database_path, backup_path)
        print(f"Backup created: {backup_path}")

    connection = schema_engine.raw_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys = OFF")
        cursor.execute("BEGIN")
        cursor.execute("""
            CREATE TABLE inventory_department_scoped (
                id INTEGER PRIMARY KEY,
                bpk_number VARCHAR NOT NULL,
                item_name VARCHAR NOT NULL,
                category VARCHAR,
                manufacturer VARCHAR,
                supplier VARCHAR,
                unit VARCHAR,
                current_stock INTEGER DEFAULT 0,
                minimum_stock INTEGER DEFAULT 5,
                maximum_stock INTEGER DEFAULT 100,
                location VARCHAR,
                rack VARCHAR,
                batch_number VARCHAR,
                purchase_price FLOAT DEFAULT 0,
                remarks VARCHAR,
                service_team VARCHAR NOT NULL DEFAULT 'Biomedical'
                    CHECK (service_team IN ('Biomedical', 'Electrical', 'IT')),
                created_at DATETIME,
                updated_at DATETIME,
                CONSTRAINT uq_inventory_service_team_bpk
                    UNIQUE (service_team, bpk_number)
            )
        """)
        columns = (
            "id, bpk_number, item_name, category, manufacturer, supplier, unit, "
            "current_stock, minimum_stock, maximum_stock, location, rack, "
            "batch_number, purchase_price, remarks, service_team, created_at, updated_at"
        )
        cursor.execute(
            f"INSERT INTO inventory_department_scoped ({columns}) "
            f"SELECT {columns} FROM inventory"
        )
        cursor.execute("DROP TABLE inventory")
        cursor.execute("ALTER TABLE inventory_department_scoped RENAME TO inventory")
        cursor.execute("CREATE INDEX ix_inventory_id ON inventory (id)")
        cursor.execute("CREATE INDEX ix_inventory_service_team ON inventory (service_team)")
        connection.commit()
        cursor.execute("PRAGMA foreign_keys = ON")
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def migrate() -> bool:
    inspector = inspect(schema_engine)
    if "inventory" not in inspector.get_table_names():
        raise RuntimeError("The inventory table does not exist.")
    if _already_scoped(inspector):
        print("Inventory BPK codes are already scoped by engineering department.")
        return False

    if MIGRATION_DATABASE_URL.startswith("sqlite:"):
        _migrate_sqlite()
    elif MIGRATION_DATABASE_URL.startswith("postgresql"):
        _migrate_postgresql()
    else:
        raise RuntimeError("This migration supports SQLite and PostgreSQL databases.")

    print("Inventory BPK codes are now unique within each engineering department.")
    return True


if __name__ == "__main__":
    migrate()
