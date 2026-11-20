from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint

from backend.models.base import Base


class CentralStoreItem(Base):
    """Hospital-wide master catalogue and physical Central Store stock."""

    __tablename__ = "central_store_items"

    id = Column(Integer, primary_key=True, index=True)
    item_code = Column(String(80), nullable=False, unique=True, index=True)
    item_name = Column(String(240), nullable=False, index=True)
    category = Column(String(120))
    manufacturer = Column(String(160))
    supplier = Column(String(160))
    unit = Column(String(40), nullable=False, default="pieces")
    current_stock = Column(Integer, nullable=False, default=0)
    minimum_stock = Column(Integer, nullable=False, default=5)
    maximum_stock = Column(Integer, nullable=False, default=100)
    location = Column(String(160), nullable=False, default="Central Store")
    rack = Column(String(80))
    purchase_price = Column(Float, nullable=False, default=0)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class SparePartRequest(Base):
    """An engineering request for an internal catalogue item or an external item."""

    __tablename__ = "spare_part_requests"
    __table_args__ = (
        CheckConstraint("service_team IN ('Biomedical', 'Electrical', 'IT')", name="ck_spare_request_team"),
        CheckConstraint("request_type IN ('Internal', 'External')", name="ck_spare_request_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(40), nullable=False, unique=True, index=True)
    requested_by_username = Column(String(80), nullable=False, index=True)
    requested_by_name = Column(String(120), nullable=False)
    requested_by_role = Column(String(30), nullable=False)
    service_team = Column(String(30), nullable=False, index=True)

    request_type = Column(String(20), nullable=False, index=True)
    central_store_item_id = Column(Integer, ForeignKey("central_store_items.id", ondelete="SET NULL"), index=True)
    requested_item_name = Column(String(240), nullable=False)
    requested_item_code = Column(String(80))
    category = Column(String(120))
    manufacturer = Column(String(160))
    specification = Column(String(500))
    quantity = Column(Integer, nullable=False, default=1)
    unit = Column(String(40), nullable=False, default="pieces")
    request_reason = Column(String(40), nullable=False, default="General", index=True)
    priority = Column(String(20), nullable=False, default="Medium")

    linked_request_id = Column(Integer, ForeignKey("requests.id", ondelete="SET NULL"), index=True)
    delivery_location = Column(String(240), nullable=False)
    notes = Column(String(1000), nullable=False, default="")

    status = Column(String(40), nullable=False, default="Submitted", index=True)
    central_store_notes = Column(String(1000), nullable=False, default="")
    approved_by_username = Column(String(80))
    approved_by_name = Column(String(120))
    stock_issued = Column(Boolean, nullable=False, default=False)
    fulfilled_quantity = Column(Integer, nullable=False, default=0)
    delivery_mode = Column(String(30))

    requested_at = Column(DateTime, nullable=False, default=datetime.now, index=True)
    approved_at = Column(DateTime)
    ready_at = Column(DateTime)
    dispatched_at = Column(DateTime)
    ward_boy_completed_at = Column(DateTime)
    engineer_confirmed_at = Column(DateTime)
    completed_at = Column(DateTime)
    rejected_at = Column(DateTime)


class StoreDeliveryTask(Base):
    """Ward Boy delivery created by Central Store for a prepared spare request."""

    __tablename__ = "store_delivery_tasks"
    __table_args__ = (UniqueConstraint("spare_request_id", name="uq_store_delivery_request"),)

    id = Column(Integer, primary_key=True, index=True)
    spare_request_id = Column(
        Integer,
        ForeignKey("spare_part_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default="Pending", index=True)
    source_location = Column(String(240), nullable=False, default="Central Store")
    destination_location = Column(String(240), nullable=False)
    notes = Column(String(500), nullable=False, default="")

    requested_by_username = Column(String(80), nullable=False)
    requested_by_name = Column(String(120), nullable=False)
    assigned_to_username = Column(String(80), index=True)
    assigned_to_name = Column(String(120))

    requested_at = Column(DateTime, nullable=False, default=datetime.now, index=True)
    accepted_at = Column(DateTime)
    completed_at = Column(DateTime)
