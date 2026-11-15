import os
import subprocess
import sys
from pathlib import Path

from backend.database import DATABASE_URL, MIGRATION_DATABASE_URL, normalise_database_url
from backend.services.qr_service import generate_qr, generate_qr_png
from backend.storage import resolve_data_directory, sqlite_url


def test_resolve_data_directory_honors_configured_path(tmp_path):
    configured = tmp_path / "persistent-data"
    assert resolve_data_directory(str(configured)) == configured.resolve()


def test_sqlite_url_is_absolute(tmp_path):
    database_path = tmp_path / "biotrack.db"
    url = sqlite_url(database_path)
    assert url.startswith("sqlite:///")
    assert database_path.resolve().as_posix() in url


def test_postgres_urls_select_psycopg_three():
    assert normalise_database_url("postgresql://user:secret@host/db") == (
        "postgresql+psycopg://user:secret@host/db"
    )
    assert normalise_database_url("postgres://user:secret@host/db") == (
        "postgresql+psycopg://user:secret@host/db"
    )


def test_local_database_uses_one_url_for_queries_and_schema_changes():
    if DATABASE_URL.startswith("sqlite:"):
        assert MIGRATION_DATABASE_URL == DATABASE_URL
    else:
        assert MIGRATION_DATABASE_URL.startswith("postgresql+psycopg://")


def test_qr_images_are_rendered_without_runtime_file_storage():
    assert generate_qr("BT-TEST 01") == "/api/qr/image/BT-TEST%2001"
    assert generate_qr_png("BT-TEST 01").startswith(b"\x89PNG\r\n\x1a\n")


def test_configured_runtime_data_survives_separate_processes(tmp_path):
    environment = os.environ.copy()
    environment["BIOTRACK_DATA_DIR"] = str(tmp_path)
    environment["DATABASE_URL"] = ""
    environment["DATABASE_URL_UNPOOLED"] = ""
    create_script = """
from sqlalchemy import text
from backend.database import engine
with engine.begin() as connection:
    connection.execute(text('CREATE TABLE persistent_check (value TEXT NOT NULL)'))
    connection.execute(text("INSERT INTO persistent_check (value) VALUES ('kept')"))
"""
    read_script = """
from sqlalchemy import text
from backend.database import engine
with engine.connect() as connection:
    assert connection.execute(text('SELECT value FROM persistent_check')).scalar_one() == 'kept'
"""

    subprocess.run([sys.executable, "-c", create_script], check=True, env=environment)
    subprocess.run([sys.executable, "-c", read_script], check=True, env=environment)
