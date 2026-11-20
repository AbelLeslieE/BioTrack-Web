from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from backend.models.base import Base


class AuthSession(Base):
    """Server-side record for every browser session.

    The browser still receives a signed JWT, but the JWT is accepted only while
    this record remains active. That makes logout, password changes, role
    changes, and account disabling immediately revocable.
    """

    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_seen_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime)
    ip_address = Column(String(64))
    user_agent = Column(String(500))

