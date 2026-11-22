"""Run every reviewed BioTrack migration in dependency order.

Each migration is idempotent and remains directly executable for recovery.
This runner provides one canonical upgrade command so deployments cannot omit a
step when moving an existing database to the current application version.
"""

from __future__ import annotations

from importlib import import_module

from sqlalchemy import text

from backend.database import MIGRATION_DATABASE_URL, schema_engine
from backend.models import Base


MIGRATIONS = (
    "add_electrical_engineer_support",
    "separate_engineering_assets_inventory",
    "scope_inventory_bpk_to_service_team",
    "add_spare_parts_stock_consumption",
    "add_pm_department_responses",
    "add_service_operations_features",
    "add_central_store_workflow",
    "add_security_hardening",
    "add_business_office",
    "store_uploads_in_database",
)


POSTGRES_MIGRATION_LOCK_ID = 424_946_873


def _run_registered_migrations() -> list[tuple[str, bool]]:
    """Create a current baseline, then upgrade any pre-existing legacy tables."""
    # create_all is intentionally first: a brand-new Render/Neon database has
    # no legacy tables for the historical migrations to inspect.  On an
    # existing database this only creates missing tables; it never replaces or
    # rewrites existing ones, so the ordered migrations can safely add columns
    # and constraints afterwards.
    Base.metadata.create_all(bind=schema_engine)
    results: list[tuple[str, bool]] = []
    for name in MIGRATIONS:
        module = import_module(f"backend.migrations.{name}")
        changed = bool(module.migrate())
        results.append((name, changed))
    return results


def run_all() -> list[tuple[str, bool]]:
    """Run the idempotent release migration under a PostgreSQL advisory lock."""
    if not MIGRATION_DATABASE_URL.startswith("postgresql"):
        return _run_registered_migrations()

    # Render can overlap instance startup during a zero-downtime deploy.  A
    # session-level advisory lock makes only one release instance mutate the
    # shared Postgres schema at a time while the others wait.
    with schema_engine.connect() as lock_connection:
        lock_connection.execute(
            text("SELECT pg_advisory_lock(:lock_id)"),
            {"lock_id": POSTGRES_MIGRATION_LOCK_ID},
        )
        try:
            return _run_registered_migrations()
        finally:
            lock_connection.execute(
                text("SELECT pg_advisory_unlock(:lock_id)"),
                {"lock_id": POSTGRES_MIGRATION_LOCK_ID},
            )
            lock_connection.commit()


def main() -> None:
    for name, changed in run_all():
        print(f"{name}: {'updated' if changed else 'already current'}")


if __name__ == "__main__":
    main()
