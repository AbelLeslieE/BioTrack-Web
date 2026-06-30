# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import DateTime

from backend.models.base import Base


# ==========================================
# LOG MODEL
# ==========================================

class Log(Base):

    __tablename__ = "logs"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    yearly_index = Column(Integer)

    token_number = Column(
        Integer,
        unique=True
    )

    month = Column(String)

    call_received_date = Column(String)
    call_received_time = Column(String)

    department_location = Column(String)

    attended_person = Column(String)

    asset_id = Column(String)

    equipment_name = Column(String)

    problem_category = Column(String)

    contract_type = Column(String)

    make_service_provider_model = Column(String)

    failure_description = Column(String)

    responded_date = Column(String)
    responded_time = Column(String)

    solution_description = Column(String)

    rectification_date = Column(String)
    rectification_time = Column(String)

    machine_downtime = Column(String)

    call_status = Column(String)

    created_by = Column(String)

    created_at = Column(DateTime)

    updated_at = Column(DateTime)