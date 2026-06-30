# ==========================================
# IMPORTS
# ==========================================

from backend.database import engine
from backend.models import Base

# ==========================================
# INITIALIZE DATABASE
# ==========================================

def initialize_database():
    """
    Creates all database tables defined
    in SQLAlchemy models.
    """

    Base.metadata.create_all(bind=engine)

    print("BioTrack database initialized successfully.")


# ==========================================
# RUN
# ==========================================

if __name__ == "__main__":

    initialize_database()