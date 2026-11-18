from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from backend.models.base import Base


class WardBoyTask(Base):
    """A pickup or return journey for equipment attached to a maintenance call."""

    __tablename__ = "ward_boy_tasks"
    __table_args__ = (UniqueConstraint("request_id", "movement_type", name="uq_ward_boy_task_phase"),)

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id", ondelete="CASCADE"), nullable=False, index=True)
    movement_type = Column(String(20), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="Pending", index=True)

    source_location = Column(String(240), nullable=False)
    destination_location = Column(String(240), nullable=False)
    notes = Column(String(500), nullable=False, default="")

    requested_by_username = Column(String(80), nullable=False)
    requested_by_name = Column(String(120), nullable=False)
    requested_by_role = Column(String(30), nullable=False)
    assigned_to_username = Column(String(80), index=True)
    assigned_to_name = Column(String(120))

    requested_at = Column(DateTime, nullable=False, default=datetime.now, index=True)
    accepted_at = Column(DateTime)
    completed_at = Column(DateTime)
