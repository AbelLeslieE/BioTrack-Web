# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Date,
    Boolean,
    ForeignKey,
    Text
)

from sqlalchemy.orm import declarative_base

from datetime import datetime


# ==========================================
# BASE
# ==========================================

Base = declarative_base()


# ==========================================
# REQUESTS TABLE
# ==========================================

class Request(Base):

    __tablename__ = "requests"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    ticket_number = Column(
        String,
        unique=True
    )

    department = Column(String)

    location = Column(String)

    reported_by = Column(String)

    equipment_identifier = Column(String)

    equipment_name = Column(String)

    make_model = Column(String)

    priority = Column(String)

    problem_category = Column(String)

    failure_description = Column(String)

    status = Column(
        String,
        default="Open"
    )

    call_received_datetime = Column(
        DateTime,
        default=datetime.now
    )

    engineer_start_datetime = Column(
        DateTime,
        nullable=True
    )

    fixed_datetime = Column(
        DateTime,
        nullable=True
    )

    calculated_downtime_hours = Column(
        Float,
        default=0
    )

    manual_downtime_hours = Column(
        Float,
        nullable=True
    )

    final_downtime_hours = Column(
        Float,
        default=0
    )

    engineer_notes = Column(
        String,
        default=""
    )

    work_done = Column(
        String,
        default=""
    )

    spare_parts = Column(
        String,
        default=""
    )

class Device(Base):
    """
    Legacy Device Table.
    Existing functionality is preserved.
    Future development will use the Asset table.
    """

    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)

    device_name = Column(String)

    device_type = Column(String)

    model = Column(String)

    serial_number = Column(String, unique=True)

    purchased_year = Column(Integer)




# USER MODEL
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    department = Column(String, nullable=True)
    name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role = Column(String, nullable=False)
    created_at = Column(DateTime)
# ==========================================
# ASSET MASTER TABLE
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