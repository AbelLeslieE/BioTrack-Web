# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy import Column, Integer, String, Text

from backend.models.base import Base


# ==========================================
# MANUFACTURER MODEL
# ==========================================

class Manufacturer(Base):

    __tablename__ = "manufacturers"

    id = Column(Integer, primary_key=True, index=True)

    manufacturer_name = Column(
        String,
        unique=True,
        nullable=False
    )

    address = Column(Text)

    contact_person = Column(String)

    phone = Column(String)

    email = Column(String)

    website = Column(String)

    remarks = Column(Text)

    status = Column(
        String,
        default="Active"
    )