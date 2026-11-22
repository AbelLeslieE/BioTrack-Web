# ==========================================
# IMPORTS
# ==========================================

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String
)

from backend.models.base import Base


# ==========================================
# ASSET DOCUMENT MODEL
# ==========================================

class AssetDocument(Base):

    __tablename__ = "asset_documents"

    id = Column(Integer, primary_key=True, index=True)

    asset_id = Column(
        Integer,
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False
    )

    document_name = Column(String, nullable=False)

    document_type = Column(String)

    file_path = Column(String, nullable=False)

    # Keep uploaded evidence in the database so files survive Render restarts.
    # file_path remains for backward-compatible access to legacy disk uploads.
    file_data = Column(LargeBinary)

    content_type = Column(String, nullable=False, default="application/pdf")

    original_size_bytes = Column(Integer, nullable=False, default=0)

    stored_size_bytes = Column(Integer, nullable=False, default=0)

    uploaded_by = Column(String)

    uploaded_at = Column(
        DateTime,
        default=datetime.now
    )
