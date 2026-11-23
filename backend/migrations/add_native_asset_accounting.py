"""Add financial asset categories, capitalization records and depreciation schedules."""

from sqlalchemy import inspect

from backend.database import schema_engine
from backend.models import Base  # noqa: F401


TABLES = ("finance_asset_categories", "finance_asset_records", "finance_depreciation_schedules")


def migrate() -> bool:
    existing = set(inspect(schema_engine).get_table_names())
    missing = [name for name in TABLES if name not in existing]
    for name in missing:
        Base.metadata.tables[name].create(bind=schema_engine, checkfirst=False)
    if not missing:
        print("Native asset accounting tables are already applied.")
        return False
    print(f"Native asset accounting is ready ({len(missing)} tables created).")
    return True


if __name__ == "__main__":
    migrate()
