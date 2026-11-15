# ==========================================
# IMPORTS
# ==========================================

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.storage import sqlite_url


# ==========================================
# DATABASE CONFIGURATION
# ==========================================

load_dotenv()

def normalise_database_url(database_url: str) -> str:
    """Select psycopg 3 for standard PostgreSQL connection strings."""
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


DATABASE_URL = normalise_database_url(os.getenv("DATABASE_URL") or sqlite_url())
MIGRATION_DATABASE_URL = normalise_database_url(
    os.getenv("DATABASE_URL_UNPOOLED") or DATABASE_URL
)


# ==========================================
# ENGINE
# ==========================================

def _engine_options(database_url: str) -> dict:
    options = {"pool_pre_ping": True}
    if database_url.startswith("sqlite:"):
        options["connect_args"] = {"check_same_thread": False}
    return options


engine = create_engine(DATABASE_URL, **_engine_options(DATABASE_URL))
schema_engine = (
    engine
    if MIGRATION_DATABASE_URL == DATABASE_URL
    else create_engine(
        MIGRATION_DATABASE_URL,
        **_engine_options(MIGRATION_DATABASE_URL),
    )
)


# ==========================================
# SESSION FACTORY
# ==========================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# ==========================================
# DATABASE SESSION DEPENDENCY
# ==========================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()
