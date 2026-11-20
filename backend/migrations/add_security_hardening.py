"""Add revocable sessions, MFA/account state, and security audit storage.

Run once from the project directory:
    python -m backend.migrations.add_security_hardening
"""

import shutil
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url

from backend.database import MIGRATION_DATABASE_URL, schema_engine
from backend.models import Base  # noqa: F401


def _backup_sqlite() -> None:
    if not MIGRATION_DATABASE_URL.startswith("sqlite:"):
        return
    database_name = make_url(MIGRATION_DATABASE_URL).database
    if not database_name:
        return
    path = Path(database_name).resolve()
    backup = path.with_suffix(".before-security-hardening.db")
    if path.exists() and not backup.exists():
        shutil.copy2(path, backup)
        print(f"Backup created: {backup}")


def migrate() -> bool:
    inspector = inspect(schema_engine)
    if "users" not in inspector.get_table_names():
        raise RuntimeError("The users table must exist before this migration.")

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    postgres = MIGRATION_DATABASE_URL.startswith("postgresql")
    true_value = "TRUE" if postgres else "1"
    false_value = "FALSE" if postgres else "0"
    additions = {
        "is_active": f"BOOLEAN NOT NULL DEFAULT {true_value}",
        "failed_login_attempts": "INTEGER NOT NULL DEFAULT 0",
        "locked_until": "TIMESTAMP",
        "last_login_at": "TIMESTAMP",
        "password_changed_at": "TIMESTAMP",
        "mfa_enabled": f"BOOLEAN NOT NULL DEFAULT {false_value}",
        "mfa_secret": "TEXT",
        "mfa_pending_secret": "TEXT",
    }
    missing = {name: ddl for name, ddl in additions.items() if name not in user_columns}
    existing_tables = set(inspector.get_table_names())
    new_tables = {"auth_sessions", "security_audit"} - existing_tables
    if not missing and not new_tables:
        print("Security hardening migration is already applied.")
        return False

    _backup_sqlite()
    with schema_engine.begin() as connection:
        for name, ddl in missing.items():
            connection.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl}"))

    for table_name in ("auth_sessions", "security_audit"):
        Base.metadata.tables[table_name].create(bind=schema_engine, checkfirst=True)

    print("Security hardening schema is ready.")
    return True


if __name__ == "__main__":
    migrate()
