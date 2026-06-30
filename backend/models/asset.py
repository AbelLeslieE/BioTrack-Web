# ==========================================
# IMPORTS
# ==========================================

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    Integer,
    String,
    Text
)

from backend.models.base import Base


# ==========================================
# ASSET MODEL
# ==========================================

class Asset(Base):

    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)

    asset_code = Column(String, unique=True, nullable=False, index=True)

    equipment_no = Column(String, unique=True)

    equipment_name = Column(String, nullable=False)

    classification = Column(String)

    equipment_type = Column(String)

    manufacturer = Column(String)

    manufacturer_address = Column(Text)

    model = Column(String)

    serial_number = Column(String, unique=True)

    manufacturing_year = Column(Integer)

    maintained_by = Column(String)

    supplier = Column(String)

    purchase_value = Column(Float, default=0)

    tax_amount = Column(Float, default=0)

    net_value = Column(Float, default=0)

    purchase_date = Column(Date)

    installation_date = Column(Date)

    warranty = Column(String)

    department = Column(String)

    location = Column(String)

    status = Column(String, default="Active")

    pm_frequency = Column(Integer)

    calibration_required = Column(Boolean, default=False)

    remarks = Column(Text)

    image_path = Column(String)

    qr_generated = Column(Boolean, default=False)

    qr_code = Column(String)

    created_at = Column(DateTime, default=datetime.now)

    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now
    )