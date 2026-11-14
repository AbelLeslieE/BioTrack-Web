from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from backend.models.base import Base


class GoogleCalendarConnection(Base):
    __tablename__ = "google_calendar_connections"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    email = Column(String, nullable=False)
    encrypted_refresh_token = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class GoogleCalendarEventLink(Base):
    __tablename__ = "google_calendar_event_links"
    __table_args__ = (UniqueConstraint("user_id", "schedule_id", name="uq_google_event_user_schedule"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule_id = Column(Integer, ForeignKey("pm_schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    google_event_id = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
