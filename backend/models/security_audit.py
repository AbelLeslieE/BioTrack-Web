from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from backend.models.base import Base


class SecurityAudit(Base):
    """Append-only security event trail kept separate from maintenance logs."""

    __tablename__ = "security_audit"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(80), nullable=False, index=True)
    outcome = Column(String(20), nullable=False)
    actor_user_id = Column(Integer, index=True)
    actor_username = Column(String(80), index=True)
    target_type = Column(String(80))
    target_id = Column(String(120))
    ip_address = Column(String(64))
    user_agent = Column(String(500))
    request_id = Column(String(64), index=True)
    details = Column(Text)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

