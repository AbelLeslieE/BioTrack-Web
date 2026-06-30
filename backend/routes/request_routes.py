# ==========================================
# IMPORTS
# ==========================================

from fastapi import APIRouter
from sqlalchemy.orm import Session
from fastapi import Depends

from backend.database import get_db
from backend.models.request import Request
from datetime import datetime


# ==========================================
# ROUTER
# ==========================================

router = APIRouter()


# ==========================================
# CREATE REQUEST
# ==========================================

@router.post("/api/requests")
def create_request(
    data: dict,
    db: Session = Depends(get_db)
):

    count = db.query(Request).count() + 1

    ticket = (
        f"BT-{datetime.now().year}-"
        f"{count:06d}"
    )

    request = Request(

        ticket_number=ticket,

        department=data.get("department"),

        location=data.get("location"),

        reported_by=data.get("reported_by"),

        # ==========================================
        # REQUEST OWNER
        # ==========================================

        created_by=data.get("created_by"),

        created_by_role=data.get("created_by_role"),

        equipment_identifier=data.get("equipment_identifier"),

        equipment_name=data.get("equipment_name"),

        make_model=data.get("make_model"),

        priority=data.get("priority"),

        problem_category=data.get("problem_category"),

        failure_description=data.get("failure_description"),

        status="Open",

        call_received_datetime=datetime.now()
    )
    db.add(request)

    db.commit()

    db.refresh(request)

    return {
        "success": True,
        "ticket_number": ticket
    }
    # ==========================================
# GET ALL REQUESTS
# ==========================================

@router.get("/api/requests")
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

@router.get("/api/kpis")
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

    closed_today = (
        db.query(Request)
        .filter(
            Request.status == "Closed"
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

@router.put("/api/requests/{ticket}/status")
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
    print("TICKET =", ticket)
    print("DATA =", data)
    
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

            request.final_downtime_hours = (
                request.calculated_downtime_hours
            )
    print("STATUS BEFORE COMMIT =", request.status)
    print("START TIME =", request.engineer_start_datetime)
    db.commit()

    return {
        "success": True
    }
# ==========================================
# DELETE REQUEST
# ==========================================

@router.delete("/api/requests/{ticket}")
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

@router.put("/api/requests/{ticket}/edit")
def edit_request(
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

    request.final_downtime_hours = (
        data.get(
            "downtime",
            0
        )
    )

    db.commit()

    return {
        "success": True
    }
# ==========================================
# MY REQUESTS
# ==========================================

@router.get("/api/user/my-requests")
def get_my_requests(
    username: str,
    db: Session = Depends(get_db)
):

    requests = (
        db.query(Request)
        .filter(Request.created_by == username)
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