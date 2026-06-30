# ==========================================
# IMPORTS
# ==========================================

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from backend.models.base import Base


# ==========================================
# REQUEST MODEL
# ==========================================

class Request(Base):

    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)

    ticket_number = Column(String, unique=True)

    department = Column(String)

    location = Column(String)

    reported_by = Column(String)
    # ==========================================
    # REQUEST OWNER
    # ==========================================

    created_by = Column(String, index=True)

    created_by_role = Column(String)

    equipment_identifier = Column(String)

    equipment_name = Column(String)

    make_model = Column(String)

    priority = Column(String)

    problem_category = Column(String)

    failure_description = Column(String)

    status = Column(String, default="Open")

    call_received_datetime = Column(
        DateTime,
        default=datetime.now
    )

    engineer_start_datetime = Column(DateTime)

    fixed_datetime = Column(DateTime)

    calculated_downtime_hours = Column(Float, default=0)

    manual_downtime_hours = Column(Float)

    final_downtime_hours = Column(Float, default=0)

    engineer_notes = Column(String, default="")

    work_done = Column(String, default="")

    spare_parts = Column(String, default="")
  