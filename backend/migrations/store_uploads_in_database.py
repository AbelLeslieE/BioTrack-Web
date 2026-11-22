"""Store uploaded evidence in PostgreSQL instead of Render's ephemeral disk."""

from sqlalchemy import inspect, text

from backend.database import MIGRATION_DATABASE_URL, schema_engine


UPLOAD_TABLES = ("asset_documents", "request_attachments")


def migrate() -> bool:
    inspector = inspect(schema_engine)
    existing_tables = set(inspector.get_table_names())
    missing = [
        table_name
        for table_name in UPLOAD_TABLES
        if table_name in existing_tables
        and "file_data" not in {column["name"] for column in inspector.get_columns(table_name)}
    ]
    if not missing:
        print("Database-backed upload storage is already applied.")
        return False

    column_type = "BYTEA" if MIGRATION_DATABASE_URL.startswith("postgresql") else "BLOB"
    with schema_engine.begin() as connection:
        for table_name in missing:
            connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN file_data {column_type}"))

    print("Database-backed upload storage is ready.")
    return True


if __name__ == "__main__":
    migrate()
