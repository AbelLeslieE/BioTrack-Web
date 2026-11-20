from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text

from backend.models.base import Base


class VendorContract(Base):
    __tablename__ = "vendor_contracts"

    id = Column(Integer, primary_key=True, index=True)
    service_team = Column(String, nullable=False, default="Biomedical", index=True)
    vendor_name = Column(String, nullable=False, index=True)
    contact_person = Column(String)
    phone = Column(String)
    email = Column(String)
    contract_type = Column(String, nullable=False, default="AMC")
    contract_number = Column(String)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False, index=True)
    response_sla_hours = Column(Integer, nullable=False, default=24)
    coverage = Column(Text)
    status = Column(String, nullable=False, default="Active")
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class VendorServiceHistory(Base):
    __tablename__ = "vendor_service_history"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(
        Integer,
        ForeignKey("vendor_contracts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    service_date = Column(Date, nullable=False)
    reference_number = Column(String)
    technician_name = Column(String)
    summary = Column(Text, nullable=False)
    cost = Column(Float, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
