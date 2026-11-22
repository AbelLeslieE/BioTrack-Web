"""Add the Business Office role and institutional-finance workflow."""

import re
import shutil
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url

from backend.database import MIGRATION_DATABASE_URL, schema_engine
from backend.models import Base  # noqa: F401


BUSINESS_TABLES = (
    "business_budgets",
    "purchase_requests",
    "business_transactions",
    "insurance_policies",
    "insurance_claim_batches",
)


def _backup_sqlite() -> None:
    if not MIGRATION_DATABASE_URL.startswith("sqlite:"):
        return
    database_name = make_url(MIGRATION_DATABASE_URL).database
    if not database_name or database_name == ":memory:":
        return
    path = Path(database_name).resolve()
    backup = path.with_suffix(".before-business-office.db")
    if path.exists() and not backup.exists():
        shutil.copy2(path, backup)
        print(f"Backup created: {backup}")


def _sqlite_add_business_role() -> bool:
    if not MIGRATION_DATABASE_URL.startswith("sqlite:"):
        return False
    with schema_engine.connect() as connection:
        users_sql = connection.execute(
            text("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
        ).scalar() or ""
        columns = [row[1] for row in connection.exec_driver_sql("PRAGMA table_info(users)")]
    if "'Business'" in users_sql or not users_sql:
        return False

    role_pattern = re.compile(r"(role\s+[^,]*?CHECK\s*\(\s*role\s+IN\s*\()([^)]*)(\)\s*\))", re.IGNORECASE | re.DOTALL)
    match = role_pattern.search(users_sql)
    if not match:
        # Deployments created directly from SQLAlchemy have no role CHECK and
        # already accept the new role.
        return False
    roles = match.group(2).rstrip()
    replacement = f"{match.group(1)}{roles}, 'Business'{match.group(3)}"
    new_sql = users_sql[:match.start()] + replacement + users_sql[match.end():]
    new_sql = re.sub(r"CREATE\s+TABLE\s+['\"]?users['\"]?", "CREATE TABLE users_business_new", new_sql, count=1, flags=re.IGNORECASE)
    quoted_columns = ", ".join(f'"{column}"' for column in columns)

    with schema_engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        transaction = connection.begin()
        try:
            connection.execute(text(new_sql))
            connection.execute(text(f"INSERT INTO users_business_new ({quoted_columns}) SELECT {quoted_columns} FROM users"))
            connection.execute(text("DROP TABLE users"))
            connection.execute(text("ALTER TABLE users_business_new RENAME TO users"))
            transaction.commit()
        except Exception:
            transaction.rollback()
            raise
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()
    return True


def migrate() -> bool:
    inspector = inspect(schema_engine)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        raise RuntimeError("The users table must exist before this migration.")
    _backup_sqlite()
    new_tables = set(BUSINESS_TABLES) - tables
    for table_name in BUSINESS_TABLES:
        Base.metadata.tables[table_name].create(bind=schema_engine, checkfirst=True)
    inspector = inspect(schema_engine)
    transaction_columns = {column["name"] for column in inspector.get_columns("business_transactions")}
    budget_link_added = False
    if "budget_id" not in transaction_columns:
        with schema_engine.begin() as connection:
            connection.execute(text("ALTER TABLE business_transactions ADD COLUMN budget_id INTEGER REFERENCES business_budgets(id) ON DELETE SET NULL"))
        budget_link_added = True
    role_updated = _sqlite_add_business_role()
    if not new_tables and not role_updated and not budget_link_added:
        print("Business Office workflow is already applied.")
        return False
    print(f"Business Office workflow is ready ({len(new_tables)} tables created).")
    return True


if __name__ == "__main__":
    migrate()
