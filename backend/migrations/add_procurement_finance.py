"""Add vendor procurement, supplier payables and exact currency storage."""

from sqlalchemy import Float, Numeric, inspect, text

from backend.database import MIGRATION_DATABASE_URL, schema_engine
from backend.models import Base  # noqa: F401


PROCUREMENT_TABLES = (
    "business_vendors",
    "supplier_quotations",
    "supplier_invoices",
    "supplier_payments",
    "business_documents",
)

MONEY_COLUMNS = {
    "business_budgets": ("allocated_amount",),
    "purchase_requests": ("unit_cost", "total_amount"),
    "business_transactions": ("amount",),
    "insurance_claim_batches": ("claimed_amount", "approved_amount", "received_amount", "deductions_amount"),
}


def _is_exact_numeric(column_type, scale: int) -> bool:
    """Return true only for the exact NUMERIC shape used by the ledger."""
    return (
        isinstance(column_type, Numeric)
        and not isinstance(column_type, Float)
        and getattr(column_type, "precision", None) == 18
        and getattr(column_type, "scale", None) == scale
    )


def migrate() -> bool:
    inspector = inspect(schema_engine)
    tables = set(inspector.get_table_names())
    if "purchase_requests" not in tables or "business_transactions" not in tables:
        raise RuntimeError("Business Office tables must exist before the procurement finance migration.")

    new_tables = set(PROCUREMENT_TABLES) - tables
    for table_name in PROCUREMENT_TABLES:
        if table_name in new_tables:
            Base.metadata.tables[table_name].create(bind=schema_engine, checkfirst=False)

    decimal_changes: list[tuple[str, str, str]] = []
    if MIGRATION_DATABASE_URL.startswith("postgresql"):
        inspector = inspect(schema_engine)
        for table_name, column_names in MONEY_COLUMNS.items():
            types = {column["name"]: column["type"] for column in inspector.get_columns(table_name)}
            for column_name in column_names:
                if not _is_exact_numeric(types.get(column_name), 2):
                    decimal_changes.append((table_name, column_name, "NUMERIC(18,2)"))
        purchase_types = {column["name"]: column["type"] for column in inspector.get_columns("purchase_requests")}
        if not _is_exact_numeric(purchase_types.get("quantity"), 3):
            decimal_changes.append(("purchase_requests", "quantity", "NUMERIC(18,3)"))

        with schema_engine.begin() as connection:
            for table_name, column_name, target_type in decimal_changes:
                connection.execute(text(
                    f'ALTER TABLE "{table_name}" ALTER COLUMN "{column_name}" '
                    f'TYPE {target_type} USING ROUND("{column_name}"::numeric, {3 if target_type.endswith("3)") else 2})'
                ))

    if not new_tables and not decimal_changes:
        print("Procurement finance and exact currency storage are already applied.")
        return False
    print(f"Procurement finance is ready ({len(new_tables)} tables created, {len(decimal_changes)} currency columns converted).")
    return True


if __name__ == "__main__":
    migrate()
