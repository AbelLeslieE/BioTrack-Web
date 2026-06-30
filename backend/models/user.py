# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy import Column, DateTime, Integer, String

from backend.models.base import Base


# ==========================================
# USER MODEL
# ==========================================

class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(String, unique=True, nullable=False)

    password_hash = Column(String, nullable=False)

    department = Column(String)

    name = Column(String)

    email = Column(String)

    phone = Column(String)

    role = Column(String, nullable=False)

    created_at = Column(DateTime)