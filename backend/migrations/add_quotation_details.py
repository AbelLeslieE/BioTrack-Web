"""Add detailed commercial terms and editable quotation metadata."""

from sqlalchemy import inspect, text

from backend.database import MIGRATION_DATABASE_URL, schema_engine


def migrate() -> bool:
    inspector = inspect(schema_engine)
    if "supplier_quotations" not in inspector.get_table_names():
        raise RuntimeError("Supplier quotation storage must exist before adding quotation details.")

    existing = {column["name"] for column in inspector.get_columns("supplier_quotations")}
    boolean_default = "FALSE" if MIGRATION_DATABASE_URL.startswith("postgresql") else "0"
    additions = {
        "installation_amount": "NUMERIC(18,2) NOT NULL DEFAULT 0",
        "installation_details": "VARCHAR(500) NOT NULL DEFAULT ''",
        "training_amount": "NUMERIC(18,2) NOT NULL DEFAULT 0",
        "training_details": "VARCHAR(1000) NOT NULL DEFAULT ''",
        "tax_rate": "NUMERIC(5,2) NOT NULL DEFAULT 0",
        "amc_annual_amount": "NUMERIC(18,2) NOT NULL DEFAULT 0",
        "amc_years": "INTEGER NOT NULL DEFAULT 0",
        "amc_terms": "TEXT NOT NULL DEFAULT ''",
        "training_included": f"BOOLEAN NOT NULL DEFAULT {boolean_default}",
        "additional_conditions": "TEXT NOT NULL DEFAULT ''",
        "updated_at": "TIMESTAMP",
    }
    missing = {name: ddl for name, ddl in additions.items() if name not in existing}
    if not missing:
        print("Detailed quotation fields are already applied.")
        return False

    with schema_engine.begin() as connection:
        for name, ddl in missing.items():
            connection.execute(text(f'ALTER TABLE supplier_quotations ADD COLUMN "{name}" {ddl}'))
        if "updated_at" in missing:
            connection.execute(text("UPDATE supplier_quotations SET updated_at = created_at WHERE updated_at IS NULL"))

    print(f"Detailed quotation fields are ready ({len(missing)} columns added).")
    return True


if __name__ == "__main__":
    migrate()
