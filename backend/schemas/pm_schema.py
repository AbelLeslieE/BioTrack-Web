# ==========================================
# IMPORTS
# ==========================================

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


# ==========================================
# CREATE PM
# ==========================================

class PMScheduleCreate(BaseModel):

    asset_id: int

    scheduled_date: date

    frequency_days: int = Field(
        gt=0,
        description="PM Interval in Days"
    )

    engineer_id: Optional[int] = None

    remarks: Optional[str] = None


# ==========================================
# UPDATE PM
# ==========================================

class PMScheduleUpdate(BaseModel):

    scheduled_date: Optional[date] = None

    frequency_days: Optional[int] = None

    engineer_id: Optional[int] = None

    remarks: Optional[str] = None


# ==========================================
# COMPLETE PM
# ==========================================

class PMComplete(BaseModel):

    engineer_name: str

    remarks: Optional[str] = ""


# ==========================================
# RESPONSE MODEL
# ==========================================

class PMResponse(BaseModel):

    id: int

    asset_id: int

    scheduled_date: date

    completed_date: Optional[date]

    frequency_days: int

    status: str

    class Config:
        from_attributes = True