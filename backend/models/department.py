# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy import Column, Integer, String

from backend.models.base import Base


# ==========================================
# DEPARTMENT MODEL
# ==========================================

class Department(Base):

    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)

    department_code = Column(
        String,
        unique=True,
        nullable=False
    )

    department_name = Column(
        String,
        unique=True,
        nullable=False
    )

    building = Column(String)

    floor = Column(String)

    hod = Column(String)

    status = Column(
        String,
        default="Active"
    )