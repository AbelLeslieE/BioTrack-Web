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
    Float,
    ForeignKey,
    Text
)

from sqlalchemy.orm import relationship

from backend.models.base import Base


# ==========================================
# PM HISTORY MODEL
# ==========================================

class PMHistory(Base):

    __tablename__ = "pm_history"

    # --------------------------------------
    # Primary Key
    # --------------------------------------

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # --------------------------------------
    # Asset Information
    # --------------------------------------

    asset_id = Column(
        Integer,
        ForeignKey("assets.id"),
        nullable=False
    )

    pm_schedule_id = Column(
        Integer,
        ForeignKey("pm_schedules.id"),
        nullable=False
    )

    # --------------------------------------
    # Engineer Information
    # --------------------------------------

    engineer_id = Column(Integer)

    engineer_name = Column(String)

    # --------------------------------------
    # PM Dates
    # --------------------------------------

    scheduled_date = Column(Date)

    completed_date = Column(Date)

    # --------------------------------------
    # Maintenance Details
    # --------------------------------------

    checklist_status = Column(
        String,
        default="Completed"
    )

    maintenance_duration = Column(
        Float,
        default=0
    )

    remarks = Column(Text)

    # --------------------------------------
    # Spare Parts (Phase 2 Ready)
    # --------------------------------------

    spare_parts_used = Column(Text)

    total_parts_cost = Column(
        Float,
        default=0
    )

    # --------------------------------------
    # PM Status
    # --------------------------------------

    status_before = Column(String)

    status_after = Column(
        String,
        default="Completed"
    )

    # --------------------------------------
    # Audit
    # --------------------------------------

    created_at = Column(
        DateTime,
        default=datetime.now
    )

    # --------------------------------------
    # Relationships
    # --------------------------------------

    asset = relationship(
        "Asset",
        backref="pm_history"
    )

    schedule = relationship(
        "PMSchedule",
        backref="history"
    )