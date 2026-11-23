"""Add native bank statement import and reconciliation tables."""

from sqlalchemy import inspect

from backend.database import schema_engine
from backend.models import Base  # noqa: F401


TABLES = ("finance_bank_accounts", "finance_bank_transactions")


def migrate() -> bool:
    existing = set(inspect(schema_engine).get_table_names())
    missing = [name for name in TABLES if name not in existing]
    for name in missing:
        Base.metadata.tables[name].create(bind=schema_engine, checkfirst=False)
    if not missing:
        print("Native banking tables are already applied.")
        return False
    print(f"Native banking is ready ({len(missing)} tables created).")
    return True


if __name__ == "__main__":
    migrate()
