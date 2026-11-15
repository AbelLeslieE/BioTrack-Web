"""Runtime storage locations for local development and persistent hosting."""

from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PACKAGED_QR_DIRECTORY = PROJECT_ROOT / "frontend" / "qr"


def resolve_data_directory(configured_path: str | None = None) -> Path:
    """Return the directory that owns mutable BioTrack runtime data."""
    configured_path = configured_path if configured_path is not None else os.getenv("BIOTRACK_DATA_DIR")
    if configured_path:
        return Path(configured_path).expanduser().resolve()
    return (PROJECT_ROOT / "database").resolve()


DATA_DIRECTORY = resolve_data_directory()
DATABASE_PATH = DATA_DIRECTORY / "biotrack.db"

# Keep the current local-development layout, while placing generated QR files
# on the persistent Render disk whenever BIOTRACK_DATA_DIR is configured.
QR_DIRECTORY = (
    DATA_DIRECTORY / "qr"
    if os.getenv("BIOTRACK_DATA_DIR")
    else PACKAGED_QR_DIRECTORY
)


def ensure_runtime_storage() -> None:
    """Create runtime directories before SQLAlchemy or static mounts use them."""
    DATA_DIRECTORY.mkdir(parents=True, exist_ok=True)
    QR_DIRECTORY.mkdir(parents=True, exist_ok=True)


def sqlite_url(database_path: Path = DATABASE_PATH) -> str:
    """Build an absolute SQLAlchemy SQLite URL on Windows and Linux."""
    return f"sqlite:///{database_path.resolve().as_posix()}"


ensure_runtime_storage()
