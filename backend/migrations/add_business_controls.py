"""Add procurement controls, supplier contracts, GST reconciliation and TDS."""

from sqlalchemy import inspect, text

from backend.database import schema_engine
from backend.models import Base  # noqa: F401


CONTROL_TABLES = (
    "purchase_orders",
    "goods_receipts",
    "business_contracts",
    "supplier_tax_reconciliations",
)

INVOICE_COLUMNS = {
    "purchase_order_id": "INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL",
    "goods_receipt_id": "INTEGER REFERENCES goods_receipts(id) ON DELETE SET NULL",
    "match_status": "VARCHAR(30) NOT NULL DEFAULT 'Not Checked'",
    "match_variance_amount": "NUMERIC(18,2) NOT NULL DEFAULT 0",
    "tds_section": "VARCHAR(30) NOT NULL DEFAULT ''",
    "tds_rate": "NUMERIC(7,4) NOT NULL DEFAULT 0",
    "tds_amount": "NUMERIC(18,2) NOT NULL DEFAULT 0",
    "net_payable_amount": "NUMERIC(18,2) NOT NULL DEFAULT 0",
}


def migrate() -> bool:
    inspector = inspect(schema_engine)
    existing_tables = set(inspector.get_table_names())
    created = 0
    for name in CONTROL_TABLES:
        if name not in existing_tables:
            Base.metadata.tables[name].create(bind=schema_engine, checkfirst=False)
            existing_tables.add(name)
            created += 1

    if "supplier_invoices" not in existing_tables:
        raise RuntimeError("Supplier invoice storage must exist before adding business controls.")
    existing_columns = {column["name"] for column in inspect(schema_engine).get_columns("supplier_invoices")}
    missing = {name: ddl for name, ddl in INVOICE_COLUMNS.items() if name not in existing_columns}
    with schema_engine.begin() as connection:
        for name, ddl in missing.items():
            connection.execute(text(f'ALTER TABLE supplier_invoices ADD COLUMN "{name}" {ddl}'))
        if "net_payable_amount" in missing:
            connection.execute(text(
                "UPDATE supplier_invoices SET net_payable_amount = "
                "CASE WHEN approved_amount > 0 THEN approved_amount ELSE total_amount END"
            ))

    changed = bool(created or missing)
    if not changed:
        print("Business controls and tax reconciliation are already applied.")
        return False
    print(f"Business controls are ready ({created} tables, {len(missing)} invoice columns added).")
    return True


if __name__ == "__main__":
    migrate()
