# ==========================================
# IMPORTS
# ==========================================
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.request import Request

router = APIRouter(
    prefix="/api/engineer",
    tags=["Biomedical Engineer"]
)

# ==========================================
# ENGINEER DASHBOARD
# ==========================================

@router.get("/dashboard")
def engineer_dashboard(db: Session = Depends(get_db)):

    assigned_calls = db.query(Request).filter(
        Request.status == "Assigned"
    ).count()

    in_progress = db.query(Request).filter(
        Request.status == "In Progress"
    ).count()

    critical_calls = db.query(Request).filter(
        Request.priority == "Critical"
    ).count()

    completed_today = db.query(Request).filter(
        Request.status == "Completed"
    ).count()

    assigned = (

        db.query(Request)

        .filter(

            Request.status.in_(

                [
                    "Open",
                    "Assigned",
                    "In Progress"
                ]

            )

        )

        .order_by(

            Request.call_received_datetime.desc()

        )

        .all()

    )

    return {

        "assigned_calls": assigned_calls,

        "in_progress": in_progress,

        "critical_calls": critical_calls,

        "completed_today": completed_today,

        "assigned": [

            {

                "id": call.id,

                "ticket": call.ticket_number,

                "equipment": call.equipment_name,

                "equipment_id": call.equipment_identifier,

                "department": call.department,

                "location": call.location,

                "reported_by": call.reported_by,

                "issue": call.problem_category,

                "priority": call.priority,

                "status": call.status,

                "reported_time": (
                    call.call_received_datetime.strftime("%d %b %Y %I:%M %p")
                    if call.call_received_datetime
                    else "" 
                )
            }

            for call in assigned

        ]

    }
# ==========================================
# GET SINGLE TICKET
# ==========================================

@router.get("/ticket/{ticket_id}")
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):

    ticket = db.query(Request).filter(
        Request.id == ticket_id
    ).first()

    if not ticket:
        return {
            "success": False
        }

    return {

        "id": ticket.id,

        "ticket": ticket.ticket_number,

        "equipment": ticket.equipment_name,

        "equipment_id": ticket.equipment_identifier,

        "department": ticket.department,

        "location": ticket.location,

        "reported_by": ticket.reported_by,

        "priority": ticket.priority,

        "status": ticket.status,

        "issue": ticket.problem_category,

        "description": ticket.failure_description,

        "received": ticket.call_received_datetime.strftime(
            "%d %b %Y %I:%M %p"
        ) if ticket.call_received_datetime else "",

        "notes": ticket.engineer_notes or "",

        "work_done": ticket.work_done or "",

        "spare_parts": ticket.spare_parts or ""

    }

# ==========================================
# MAINTENANCE LIST
# ==========================================

@router.get("/maintenance")
def get_maintenance(db: Session = Depends(get_db)):

    requests = (
        db.query(Request)
        .order_by(Request.call_received_datetime.desc())
        .all()
    )

    total_calls = len(requests)

    in_progress = sum(
        1 for r in requests
        if r.status == "In Progress"
    )

    completed = sum(
        1 for r in requests
        if r.status == "Completed"
    )

    total_downtime = sum(
        r.final_downtime_hours or 0
        for r in requests
    )

    return {

        "total_calls": total_calls,

        "in_progress": in_progress,

        "completed": completed,

        "downtime": round(total_downtime,2),

        "calls":[

            {

                "id": r.id,

                "ticket": r.ticket_number,

                "equipment": r.equipment_name,

                "department": r.department,

                "received": r.call_received_datetime.strftime(
                    "%d %b %Y %I:%M %p"
                ) if r.call_received_datetime else "",

                "status": r.status,

                "downtime": r.final_downtime_hours or 0

            }

            for r in requests

        ]

    }
# ==========================================
# UPDATE TICKET MODEL
# ==========================================

class TicketUpdate(BaseModel):

    status: str

    engineer_notes: str

    work_done: str

    spare_parts: str

    start_work: bool = False

    complete_work: bool = False


# ==========================================
# UPDATE TICKET
# ==========================================

@router.put("/ticket/{ticket_id}")
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    db: Session = Depends(get_db)
):

    ticket = db.query(Request).filter(
        Request.id == ticket_id
    ).first()

    if not ticket:

        return {

            "success": False,

            "message": "Ticket not found"

        }

    # ======================================
    # Save Engineer Data
    # ======================================

    ticket.engineer_notes = payload.engineer_notes

    ticket.work_done = payload.work_done

    ticket.spare_parts = payload.spare_parts

    # ======================================
    # START WORK
    # ======================================

    if payload.start_work:

        ticket.status = "In Progress"

        if ticket.engineer_start_datetime is None:

            ticket.engineer_start_datetime = datetime.now()

    # ======================================
    # COMPLETE WORK
    # ======================================

    elif payload.complete_work:

        ticket.status = "Completed"

        ticket.fixed_datetime = datetime.now()

        if ticket.call_received_datetime:

            downtime = (

                ticket.fixed_datetime -

                ticket.call_received_datetime

            ).total_seconds() / 3600

            ticket.final_downtime_hours = round(
                downtime,
                2
            )

    # ======================================
    # NORMAL SAVE
    # ======================================

    else:

        ticket.status = payload.status

    db.commit()

    db.refresh(ticket)

    return {

        "success": True,

        "message": "Ticket updated successfully.",

        "status": ticket.status,

        "engineer_start_datetime":
            ticket.engineer_start_datetime,

        "fixed_datetime":
            ticket.fixed_datetime,

        "downtime":
            ticket.final_downtime_hours

    }