# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


# ==========================================
# DATABASE CONFIGURATION
# ==========================================

DATABASE_URL = "sqlite:///./database/biotrack.db"


# ==========================================
# ENGINE
# ==========================================

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
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