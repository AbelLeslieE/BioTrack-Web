from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, LargeBinary, String

from backend.models.base import Base


class RequestAttachment(Base):
    __tablename__ = "request_attachments"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(
        Integer,
        ForeignKey("requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_type = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    stored_name = Column(String, nullable=False, unique=True)
    # Database-backed storage is durable on free Render hosting. stored_name is
    # retained so older filesystem-backed attachments continue to work.
    file_data = Column(LargeBinary)
    content_type = Column(String, nullable=False)
    original_size_bytes = Column(Integer, nullable=False, default=0)
    stored_size_bytes = Column(Integer, nullable=False, default=0)
    uploaded_by = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.now, nullable=False)
