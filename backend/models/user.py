# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

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

    is_active = Column(Boolean, nullable=False, default=True)

    failed_login_attempts = Column(Integer, nullable=False, default=0)

    locked_until = Column(DateTime)

    last_login_at = Column(DateTime)

    password_changed_at = Column(DateTime)

    mfa_enabled = Column(Boolean, nullable=False, default=False)

    mfa_secret = Column(Text)

    mfa_pending_secret = Column(Text)
