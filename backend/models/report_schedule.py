from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from backend.models.base import Base


class ReportSchedule(Base):
    __tablename__ = "report_schedules"

    id = Column(Integer, primary_key=True, index=True)
    created_by = Column(String, nullable=False, index=True)
    report_format = Column(String, nullable=False, default="pdf")
    frequency = Column(String, nullable=False, default="once")
    next_run_at = Column(DateTime, nullable=False)
    last_run_at = Column(DateTime)
    filters_json = Column(Text, default="{}")
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
