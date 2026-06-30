# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy import Column, Integer, String, Text

from backend.models.base import Base


# ==========================================
# SUPPLIER MODEL
# ==========================================

class Supplier(Base):

    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)

    supplier_name = Column(
        String,
        unique=True,
        nullable=False
    )

    address = Column(Text)

    contact_person = Column(String)

    phone = Column(String)

    email = Column(String)

    gst_number = Column(String)

    remarks = Column(Text)

    status = Column(
        String,
        default="Active"
    )