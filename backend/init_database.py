# ==========================================
# IMPORTS
# ==========================================

from backend.database import schema_engine
from backend.models import Base

# ==========================================
# INITIALIZE DATABASE
# ==========================================

def initialize_database():
    """
    Creates all database tables defined
    in SQLAlchemy models.
    """

    Base.metadata.create_all(bind=schema_engine)

    print("BioTrack database initialized successfully.")


# ==========================================
# RUN
# ==========================================

if __name__ == "__main__":

    initialize_database()
