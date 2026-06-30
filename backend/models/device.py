# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy import Column, Integer, String

from backend.models.base import Base


# ==========================================
# DEVICE MODEL
# ==========================================

class Device(Base):

    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)

    device_name = Column(String)

    device_type = Column(String)

    model = Column(String)

    serial_number = Column(String, unique=True)

    purchased_year = Column(Integer)