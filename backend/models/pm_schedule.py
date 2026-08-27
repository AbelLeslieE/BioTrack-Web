# ==========================================
# IMPORTS
# ==========================================

from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    DateTime,
    ForeignKey,
    Boolean,
    Text
)

from sqlalchemy.orm import relationship

from backend.models.base import Base


# ==========================================
# PM SCHEDULE MODEL
# ==========================================

class PMSchedule(Base):

    __tablename__ = "pm_schedules"

    id = Column(Integer, primary_key=True, index=True)

    asset_id = Column(
        Integer,
        ForeignKey("assets.id"),
        nullable=False
    )

    department = Column(String)

    location = Column(String)

    engineer_id = Column(Integer)

    scheduled_date = Column(Date, nullable=False)

    completed_date = Column(Date)

    frequency_days = Column(Integer, nullable=False)

    status = Column(
        String,
        default="Upcoming"
    )

    # Department users confirm whether the planned visit is suitable.
    department_response = Column(
        String,
        default="Pending",
        nullable=False
    )

    department_response_note = Column(Text)

    department_response_at = Column(DateTime)

    checklist_completed = Column(
        Boolean,
        default=False
    )

    remarks = Column(Text)

    created_at = Column(
        DateTime,
        default=datetime.now
    )

    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now
    )

    asset = relationship(
        "Asset",
        backref="pm_schedules"
    )
