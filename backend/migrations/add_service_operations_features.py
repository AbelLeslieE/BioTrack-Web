"""Add technician assignment, reservations, contracts, and evidence storage.

Run once from the project directory:
    python -m backend.migrations.add_service_operations_features
"""

import shutil
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url

from backend.database import MIGRATION_DATABASE_URL, schema_engine
from backend.models import Base  # noqa: F401 - imports every registered table


def _backup_sqlite() -> None:
    if not MIGRATION_DATABASE_URL.startswith("sqlite:"):
        return
    database_name = make_url(MIGRATION_DATABASE_URL).database
    if not database_name:
        return
    database_path = Path(database_name).resolve()
    backup_path = database_path.with_suffix(".before-service-operations.db")
    if database_path.exists() and not backup_path.exists():
        shutil.copy2(database_path, backup_path)
        print(f"Backup created: {backup_path}")


def migrate() -> bool:
    inspector = inspect(schema_engine)
    if "requests" not in inspector.get_table_names() or "inventory" not in inspector.get_table_names():
        raise RuntimeError("The requests and inventory tables must exist before this migration.")

    request_columns = {column["name"] for column in inspector.get_columns("requests")}
    inventory_columns = {column["name"] for column in inspector.get_columns("inventory")}
    existing_tables = set(inspector.get_table_names())
    asset_document_columns = (
        {column["name"] for column in inspector.get_columns("asset_documents")}
        if "asset_documents" in existing_tables
        else set()
    )
    boolean_default = "FALSE" if MIGRATION_DATABASE_URL.startswith("postgresql") else "0"
    request_additions = {
        "assigned_to_username": "VARCHAR",
        "assigned_to_name": "VARCHAR",
        "parts_reserved": f"BOOLEAN NOT NULL DEFAULT {boolean_default}",
        "parts_cost": "FLOAT NOT NULL DEFAULT 0",
    }
    inventory_additions = {
        "reserved_stock": "INTEGER NOT NULL DEFAULT 0",
    }
    asset_document_additions = {
        "content_type": "VARCHAR NOT NULL DEFAULT 'application/pdf'",
        "original_size_bytes": "INTEGER NOT NULL DEFAULT 0",
        "stored_size_bytes": "INTEGER NOT NULL DEFAULT 0",
    }
    missing_requests = {name: ddl for name, ddl in request_additions.items() if name not in request_columns}
    missing_inventory = {name: ddl for name, ddl in inventory_additions.items() if name not in inventory_columns}
    missing_asset_documents = {
        name: ddl for name, ddl in asset_document_additions.items()
        if asset_document_columns and name not in asset_document_columns
    }
    new_tables = {"request_attachments", "vendor_contracts", "vendor_service_history"} - existing_tables

    if not missing_requests and not missing_inventory and not missing_asset_documents and not new_tables:
        print("Service operations features are already applied.")
        return False

    _backup_sqlite()
    with schema_engine.begin() as connection:
        for name, ddl in missing_requests.items():
            connection.execute(text(f"ALTER TABLE requests ADD COLUMN {name} {ddl}"))
        for name, ddl in missing_inventory.items():
            connection.execute(text(f"ALTER TABLE inventory ADD COLUMN {name} {ddl}"))
        for name, ddl in missing_asset_documents.items():
            connection.execute(text(f"ALTER TABLE asset_documents ADD COLUMN {name} {ddl}"))

    for table_name in ("request_attachments", "vendor_contracts", "vendor_service_history"):
        Base.metadata.tables[table_name].create(bind=schema_engine, checkfirst=True)

    print("Technician assignment, reservations, contracts, and evidence storage are ready.")
    return True


if __name__ == "__main__":
    migrate()
