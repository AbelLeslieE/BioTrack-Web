# ==========================================
# IMPORTS
# ==========================================

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text
)

from backend.models.base import Base


# ==========================================
# ASSET HISTORY MODEL
# ==========================================

class AssetHistory(Base):

    __tablename__ = "asset_history"

    id = Column(Integer, primary_key=True, index=True)

    asset_id = Column(
        Integer,
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False
    )

    action = Column(String)

    description = Column(Text)

    performed_by = Column(String)

    timestamp = Column(
        DateTime,
        default=datetime.now
    )