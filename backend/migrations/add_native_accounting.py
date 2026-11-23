"""Add the native BioTrack double-entry accounting foundation."""

from sqlalchemy import inspect

from backend.database import schema_engine
from backend.models import Base  # noqa: F401


ACCOUNTING_TABLES = (
    "finance_companies",
    "finance_accounts",
    "finance_cost_centers",
    "finance_tax_templates",
    "finance_journal_entries",
    "finance_journal_lines",
)


def migrate() -> bool:
    existing = set(inspect(schema_engine).get_table_names())
    missing = [name for name in ACCOUNTING_TABLES if name not in existing]
    for name in ACCOUNTING_TABLES:
        if name in missing:
            Base.metadata.tables[name].create(bind=schema_engine, checkfirst=False)
    if not missing:
        print("Native BioTrack accounting tables are already applied.")
        return False
    print(f"Native BioTrack accounting is ready ({len(missing)} tables created).")
    return True


if __name__ == "__main__":
    migrate()

