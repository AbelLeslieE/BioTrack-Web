from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from backend.models.base import Base


class AssetRelocationRequest(Base):
    __tablename__ = "asset_relocation_requests"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    requested_by = Column(String, nullable=False, index=True)
    requester_department = Column(String, nullable=False, index=True)
    service_team = Column(String, nullable=False, index=True)
    from_department = Column(String)
    from_location = Column(String)
    target_department = Column(String, nullable=False)
    target_location = Column(String)
    reason = Column(Text)
    status = Column(String, nullable=False, default="Pending", index=True)
    reviewed_by = Column(String)
    review_note = Column(Text)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    reviewed_at = Column(DateTime)
