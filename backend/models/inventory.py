# ==========================================
# INVENTORY MODEL
# ==========================================

from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Float
from sqlalchemy import DateTime

from datetime import datetime

from backend.models.base import Base


class Inventory(Base):

    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)

    bpk_number = Column(String, unique=True, nullable=False)

    item_name = Column(String, nullable=False)

    category = Column(String)

    manufacturer = Column(String)

    supplier = Column(String)

    unit = Column(String)

    current_stock = Column(Integer, default=0)

    minimum_stock = Column(Integer, default=5)

    maximum_stock = Column(Integer, default=100)

    location = Column(String)

    rack = Column(String)

    batch_number = Column(String)

    purchase_price = Column(Float, default=0)

    remarks = Column(String)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )