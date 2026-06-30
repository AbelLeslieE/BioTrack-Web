# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy import (
    Column,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Text
)

from backend.models.base import Base


# ==========================================
# ASSET SPARE PART MODEL
# ==========================================

class AssetSpare(Base):

    __tablename__ = "asset_spares"

    id = Column(Integer, primary_key=True, index=True)

    asset_id = Column(
        Integer,
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False
    )

    part_name = Column(String)

    part_number = Column(String)

    vendor = Column(String)

    cost = Column(Float)

    replacement_date = Column(Date)

    replaced_by = Column(String)

    remarks = Column(Text)