"""Add audited financial asset lifecycle events."""

from sqlalchemy import inspect

from backend.database import schema_engine
from backend.models import Base  # noqa: F401


def migrate() -> bool:
    if "finance_asset_events" in set(inspect(schema_engine).get_table_names()):
        print("Asset lifecycle events are already applied.")
        return False
    Base.metadata.tables["finance_asset_events"].create(bind=schema_engine, checkfirst=False)
    print("Asset lifecycle events are ready.")
    return True


if __name__ == "__main__":
    migrate()
