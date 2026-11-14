# ==========================================
# IMPORTS
# ==========================================

from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from fastapi import Depends

from backend.database import get_db
from backend.models.request import Request
from backend.models.user import User
from backend.auth import get_current_user, require_roles
import json


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(dependencies=[Depends(get_current_user)])

SERVICE_TEAMS = {"Biomedical", "Electrical", "IT"}


class MaintenanceRequestCreate(BaseModel):
    """Validated input accepted from the maintenance-request form."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    department: str = Field(min_length=1, max_length=120)
    location: str = Field(min_length=1, max_length=200)
    equipment_identifier: str = Field(min_length=1, max_length=120)
    equipment_name: str = Field(min_length=1, max_length=200)
    make_model: str = Field(default="", max_length=200)
    priority: Literal["Critical", "High", "Medium", "Low"]
    problem_category: Literal[
        "Breakdown",
        "Calibration",
        "Preventive Maintenance",
        "Installation",
        "Accessories",
    ]
    service_team: Literal["Biomedical", "Electrical", "IT"] = "Biomedical"
    failure_description: str = Field(min_length=1, max_length=4000)


class DowntimeOverride(BaseModel):
    """Administrator-supplied downtime stored directly on a maintenance call."""

    model_config = ConfigDict(extra="forbid")

    hours: float = Field(ge=0, le=1_000_000)


def ticket_number_for(request_id: int, created_at: datetime) -> str:
    """Build a stable ticket number from the database-generated primary key."""
    return f"BT-{created_at.year}-{request_id:06d}"


def _user_request_details(request: Request) -> dict:
    """Return the request detail format used by the department-user portal."""
    spare_parts = request.spare_parts or ""
    try:
        parsed_parts = json.loads(spare_parts)
        if isinstance(parsed_parts, list):
            spare_parts = ", ".join(
                f"Part #{part.get('inventory_id')} × {part.get('quantity', 1)}"
                for part in parsed_parts
                if isinstance(part, dict)
            )
    except (TypeError, json.JSONDecodeError):
        pass

    return {
        "ticket": request.ticket_number,
        "equipment": request.equipment_name,
        "equipment_id": request.equipment_identifier,
        "department": request.department,
        "location": request.location,
        "reported_by": request.reported_by,
        "priority": request.priority,
        "status": request.status,
        "received": request.call_received_datetime,
        "started": request.engineer_start_datetime,
        "completed": request.fixed_datetime,
        "description": request.failure_description,
        "notes": request.engineer_notes,
        "work_done": request.work_done,
        "spare_parts": spare_parts,
        "downtime": request.final_downtime_hours,
    }


# ==========================================
# CREATE REQUEST
# ==========================================

@router.post("/api/requests")
def create_request(
    data: MaintenanceRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    service_team = data.service_team
    department = data.department
    if current_user.role == "User":
        if not current_user.department:
            raise HTTPException(status_code=422, detail="Your account has no assigned department.")
        department = current_user.department

    created_at = datetime.now()

    request = Request(

        # Assigned after flush from the database-generated primary key.
        ticket_number=None,

        department=department,

        location=data.location,

        reported_by=current_user.name or current_user.username,

        # ==========================================
        # REQUEST OWNER
        # ==========================================

        created_by=current_user.username,

        created_by_role=current_user.role,

        service_team=service_team,

        equipment_identifier=data.equipment_identifier,

        equipment_name=data.equipment_name,

        make_model=data.make_model,

        priority=data.priority,

        problem_category=data.problem_category,

        failure_description=data.failure_description,

        status="Open",

        call_received_datetime=created_at
    )
    db.add(request)

    # The primary key is monotonic and database-owned, so ticket numbers remain
    # unique after deletions and across concurrent submissions.
    db.flush()
    request.ticket_number = ticket_number_for(request.id, created_at)
    db.commit()

    db.refresh(request)

    return {
        "success": True,
        "ticket_number": request.ticket_number
    }
    # ==========================================
# GET ALL REQUESTS
# ==========================================

@router.get("/api/requests", dependencies=[Depends(require_roles("Manager", "BME"))])
def get_requests(
    db: Session = Depends(get_db)
):

    requests = (
        db.query(Request)
        .order_by(Request.id.desc())
        .all()
    )

    result = []

    for request in requests:

        result.append({

            "ticket":
                request.ticket_number,

            "department":
                request.department,

            "equipment":
                request.equipment_name,

            "priority":
                request.priority,

            "status":
                request.status,

            "reportedBy":
                request.reported_by,

            "category":
                request.problem_category,

            "description":
                request.failure_description,

            "engineerNotes":
                request.engineer_notes,

            "workDone":
                request.work_done,

            "spareParts":
                request.spare_parts,
            "callReceived":
                str(request.call_received_datetime),

            "engineerStart":
                str(request.engineer_start_datetime),

            "fixedTime":
                str(request.fixed_datetime),

            "downtime":
                request.final_downtime_hours,
        })

    return result
# ==========================================
# KPI COUNTS
# ==========================================

@router.get("/api/kpis", dependencies=[Depends(require_roles("Manager", "BME"))])
def get_kpis(
    db: Session = Depends(get_db)
):

    open_calls = (
        db.query(Request)
        .filter(Request.status == "Open")
        .count()
    )

    in_progress = (
        db.query(Request)
        .filter(
            Request.status == "In Progress"
        )
        .count()
    )

    awaiting_parts = (
        db.query(Request)
        .filter(
            Request.status == "Awaiting Parts"
        )
        .count()
    )

    start_of_today = datetime.combine(date.today(), time.min)
    start_of_tomorrow = start_of_today + timedelta(days=1)
    closed_today = (
        db.query(Request)
        .filter(
            Request.status == "Closed",
            Request.fixed_datetime >= start_of_today,
            Request.fixed_datetime < start_of_tomorrow,
        )
        .count()
    )

    return {

        "open_calls":
            open_calls,

        "in_progress":
            in_progress,

        "awaiting_parts":
            awaiting_parts,

        "closed_today":
            closed_today

    }
# ==========================================
# UPDATE REQUEST STATUS
# ==========================================

@router.put(
    "/api/requests/{ticket}/status",
    dependencies=[Depends(require_roles("Manager", "BME"))],
)
def update_status(
    ticket: str,
    data: dict,
    db: Session = Depends(get_db)
):

    request = (
        db.query(Request)
        .filter(
            Request.ticket_number == ticket
        )
        .first()
    )

    if not request:

        return {
            "success": False
            
        }
    request.status = data.get("status")

    request.engineer_notes = (
        data.get(
            "engineer_notes",
            request.engineer_notes
        )
    )

    request.work_done = (
        data.get(
            "work_done",
            request.work_done
        )
    )

    request.spare_parts = (
        data.get(
            "spare_parts",
            request.spare_parts
        )
    )

    # ==========================================
    # Start Work Timestamp
    # ==========================================

    if (
        data.get("status")
        == "In Progress"
    ):

        if (
            not request.engineer_start_datetime
        ):

            request.engineer_start_datetime = (
                datetime.now()
            )

    # ==========================================
    # Close Call Timestamp
    # ==========================================

    if (
        data.get("status")
        == "Closed"
    ):

        request.fixed_datetime = (
            datetime.now()
        )

        if (
            request.call_received_datetime
        ):

            downtime_hours = (

                request.fixed_datetime
                -
                request.call_received_datetime

            ).total_seconds() / 3600

            request.calculated_downtime_hours = (
                round(
                    downtime_hours,
                    2
                )
            )

            if request.manual_downtime_hours is None:
                request.final_downtime_hours = (
                    request.calculated_downtime_hours
                )
    db.commit()

    return {
        "success": True
    }


# ==========================================
# ADMIN DOWNTIME OVERRIDE
# ==========================================

@router.patch("/api/requests/{ticket}/downtime")
def override_request_downtime(
    ticket: str,
    data: DowntimeOverride,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Manager")),
):
    """Replace the displayed downtime without creating a history or audit entry."""
    del current_user

    maintenance_request = (
        db.query(Request)
        .filter(Request.ticket_number == ticket)
        .first()
    )
    if not maintenance_request:
        raise HTTPException(status_code=404, detail="Maintenance request not found.")

    hours = round(float(data.hours), 2)
    maintenance_request.manual_downtime_hours = hours
    maintenance_request.final_downtime_hours = hours
    db.commit()
    db.refresh(maintenance_request)

    return {
        "success": True,
        "ticket": maintenance_request.ticket_number,
        "downtime": maintenance_request.final_downtime_hours,
    }
# ==========================================
# DELETE REQUEST
# ==========================================

@router.delete("/api/requests/{ticket}", dependencies=[Depends(require_roles("Manager"))])
def delete_request(
    ticket: str,
    db: Session = Depends(get_db)
):

    request = (
        db.query(Request)
        .filter(
            Request.ticket_number == ticket
        )
        .first()
    )

    if not request:

        return {
            "success": False,
            "message": "Request not found"
        }

    db.delete(request)

    db.commit()

    return {
        "success": True
    }
    # ==========================================
# EDIT REQUEST
# ==========================================

@router.put(
    "/api/requests/{ticket}/edit",
    dependencies=[Depends(require_roles("Manager", "BME"))],
)
def edit_request(
    ticket: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    request = (
        db.query(Request)
        .filter(
            Request.ticket_number == ticket
        )
        .first()
    )

    if not request:

        return {
            "success": False,
            "message": "Request not found"
        }

    if data.get("call_received"):

        request.call_received_datetime = (
            datetime.fromisoformat(
                data["call_received"]
            )
        )

    if data.get("engineer_start"):

        request.engineer_start_datetime = (
            datetime.fromisoformat(
                data["engineer_start"]
            )
        )

    if data.get("fixed_time"):

        request.fixed_datetime = (
            datetime.fromisoformat(
                data["fixed_time"]
            )
        )

    if "downtime" in data:
        if current_user.role.casefold() != "manager":
            raise HTTPException(status_code=403, detail="Only administrators can change downtime.")
        request.manual_downtime_hours = round(float(data["downtime"]), 2)
        request.final_downtime_hours = request.manual_downtime_hours

    db.commit()

    return {
        "success": True
    }
# ==========================================
# MY REQUESTS
# ==========================================

@router.get("/api/user/request-details/{ticket_number}", dependencies=[Depends(require_roles("User"))])
def get_own_request_details(
    ticket_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = (
        db.query(Request)
        .filter(
            Request.ticket_number == ticket_number,
            Request.created_by == current_user.username,
        )
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Maintenance request not found.")
    return _user_request_details(request)

@router.get("/api/user/my-requests")
def get_my_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    requests = (
        db.query(Request)
        .filter(Request.created_by == current_user.username)
        .order_by(Request.id.desc())
        .all()
    )

    total = len(requests)

    open_count = sum(
        1 for r in requests
        if r.status == "Open"
    )

    in_progress = sum(
        1 for r in requests
        if r.status == "In Progress"
    )

    completed = sum(
        1 for r in requests
        if r.status in ["Completed", "Closed"]
    )

    return {

        "success": True,

        "summary": {

            "total": total,
            "open": open_count,
            "in_progress": in_progress,
            "completed": completed

        },

        "requests": [

            {

                "ticket": r.ticket_number,

                "equipment": r.equipment_name,

                "equipment_id": r.equipment_identifier,

                "department": r.department,

                "priority": r.priority,

                "status": r.status,

                "reported_by": r.reported_by,

                "reported_time": str(
                    r.call_received_datetime
                ),

                "downtime": r.final_downtime_hours

            }

            for r in requests

        ]

    }
