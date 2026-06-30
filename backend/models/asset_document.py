# ==========================================
# IMPORTS
# ==========================================

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
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

    uploaded_by = Column(String)

    uploaded_at = Column(
        DateTime,
        default=datetime.now
    )