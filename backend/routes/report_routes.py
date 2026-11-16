# ==========================================
# IMPORTS
# ==========================================

import calendar
import csv
import io
import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from backend.database import get_db
from backend.models import Request, Asset, ReportSchedule
from backend.auth import get_current_user, require_roles
from backend.models.user import User

# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"],
    dependencies=[Depends(require_roles("Manager", "BME"))],
)


def _report_date(value: str | None, field_name: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Enter a valid {field_name} date.") from exc


def _filtered_report_requests(
    db: Session,
    start_date: str | None = None,
    end_date: str | None = None,
    department: str | None = None,
    location: str | None = None,
    equipment: str | None = None,
):
    query = db.query(Request)
    parsed_start = _report_date(start_date, "start")
    parsed_end = _report_date(end_date, "end")
    if parsed_start:
        query = query.filter(Request.call_received_datetime >= datetime.combine(parsed_start, datetime.min.time()))
    if parsed_end:
        query = query.filter(Request.call_received_datetime <= datetime.combine(parsed_end, datetime.max.time()))
    if department and not department.casefold().startswith("all "):
        query = query.filter(Request.department == department)
    if location and not location.casefold().startswith("all "):
        query = query.filter(Request.location == location)
    if equipment and not equipment.casefold().startswith("all "):
        query = query.filter(Request.equipment_name == equipment)
    return query.order_by(Request.call_received_datetime.desc()).all()


def _report_rows(requests):
    return [
        [
            request.ticket_number or "",
            request.equipment_name or "",
            request.department or "",
            request.location or "",
            request.priority or "",
            request.status or "",
            request.reported_by or "",
            round(request.final_downtime_hours or 0, 2),
            request.call_received_datetime.strftime("%d-%m-%Y %I:%M %p") if request.call_received_datetime else "",
        ]
        for request in requests
    ]


REPORT_HEADERS = [
    "Ticket", "Equipment", "Department", "Location", "Priority",
    "Status", "Reported By", "Downtime (h)", "Received",
]

# ==========================================
# REPORT SUMMARY
# ==========================================

@router.get("/summary")
def report_summary(db: Session = Depends(get_db)):

    total_assets = db.query(Asset).count()

    active_assets = (
        db.query(Asset)
        .filter(Asset.status == "Active")
        .count()
    )

    maintenance_requests = db.query(Request).count()

    completed_requests = (
        db.query(Request)
        .filter(Request.status == "Completed")
        .count()
    )

    pending_requests = (
        db.query(Request)
        .filter(
            Request.status.in_(
                [
                    "Open",
                    "Pending",
                    "Assigned",
                    "In Progress"
                ]
            )
        )
        .count()
    )

    overdue_requests = (
        db.query(Request)
        .filter(Request.status == "Overdue")
        .count()
    )

    average_downtime = (
        db.query(
            func.avg(Request.final_downtime_hours)
        ).scalar()
    )

    if average_downtime is None:
        average_downtime = 0

    return {

        "total_assets": total_assets,

        "active_assets": active_assets,

        "maintenance_requests": maintenance_requests,

        "completed_requests": completed_requests,

        "pending_requests": pending_requests,

        "overdue_requests": overdue_requests,

        "average_downtime": round(
            average_downtime,
            2
        )

    }

# ==========================================
# MAINTENANCE TREND
# ==========================================

@router.get("/maintenance-trend")
def maintenance_trend(db: Session = Depends(get_db)):

    months = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"
    ]

    values = []

    for month in range(1,13):

        total = (

            db.query(Request)

            .filter(

                extract(
                    "month",
                    Request.call_received_datetime
                ) == month

            )

            .count()

        )

        values.append(total)

    return {

        "labels": months,

        "values": values

    }

# ==========================================
# STATUS SUMMARY
# ==========================================

@router.get("/status")
def report_status(db: Session = Depends(get_db)):

    completed = (

        db.query(Request)

        .filter(Request.status == "Completed")

        .count()

    )

    pending = (

        db.query(Request)

        .filter(

            Request.status.in_(

                [

                    "Open",

                    "Pending",

                    "Assigned",

                    "In Progress"

                ]

            )

        )

        .count()

    )

    overdue = (

        db.query(Request)

        .filter(Request.status == "Overdue")

        .count()

    )

    return {

        "labels":[

            "Completed",

            "Pending",

            "Overdue"

        ],

        "values":[

            completed,

            pending,

            overdue

        ]

    }
# ==========================================
# DEPARTMENT STATISTICS
# ==========================================

@router.get("/departments")
def report_departments(db: Session = Depends(get_db)):

    results = (

        db.query(

            Request.department,

            func.count(Request.id)

        )

        .group_by(Request.department)

        .all()

    )

    return {

        "labels":[

            row[0] if row[0] else "Unknown"

            for row in results

        ],

        "values":[

            row[1]

            for row in results

        ]

    }


# ==========================================
# CATEGORY STATISTICS
# ==========================================

@router.get("/categories")
def report_categories(db: Session = Depends(get_db)):

    results = (

        db.query(

            Request.problem_category,

            func.count(Request.id)

        )

        .group_by(Request.problem_category)

        .all()

    )

    return {

        "labels":[

            row[0] if row[0] else "Others"

            for row in results

        ],

        "values":[

            row[1]

            for row in results

        ]

    }


# ==========================================
# DOWNTIME TREND
# ==========================================

@router.get("/downtime")
def report_downtime(db: Session = Depends(get_db)):

    months = [

        "Jan","Feb","Mar","Apr","May","Jun",

        "Jul","Aug","Sep","Oct","Nov","Dec"

    ]

    values = []

    for month in range(1,13):

        avg = (

            db.query(

                func.avg(

                    Request.final_downtime_hours

                )

            )

            .filter(

                extract(

                    "month",

                    Request.call_received_datetime

                ) == month

            )

            .scalar()

        )

        values.append(

            round(avg or 0,2)

        )

    return {

        "labels":months,

        "values":values

    }
    # ==========================================
# REPORT TABLE
# ==========================================

@router.get("/table")
def report_table(db: Session = Depends(get_db)):

    requests = (

        db.query(Request)

        .order_by(

            Request.call_received_datetime.desc()

        )

        .limit(100)

        .all()

    )

    return [

        {

            "ticket": r.ticket_number,

            "equipment": r.equipment_name,

            "department": r.department,

            "priority": r.priority,

            "status": r.status,

            "reported_by": r.reported_by,

            "downtime": r.final_downtime_hours,

            "date": (

                r.call_received_datetime.strftime(

                    "%d-%m-%Y"

                )

                if r.call_received_datetime

                else ""

            )

        }

        for r in requests

    ]


# ==========================================
# REAL REPORT EXPORTS
# ==========================================

@router.get("/export/{report_format}")
def export_report(
    report_format: str,
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    department: str | None = Query(default=None),
    location: str | None = Query(default=None),
    equipment: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    normalized_format = report_format.strip().casefold()
    if normalized_format not in {"pdf", "xlsx", "csv"}:
        raise HTTPException(status_code=404, detail="Unsupported report format.")

    requests = _filtered_report_requests(
        db,
        start_date=start_date,
        end_date=end_date,
        department=department,
        location=location,
        equipment=equipment,
    )
    rows = _report_rows(requests)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M")
    filename = f"BioTrack-maintenance-report-{timestamp}.{normalized_format}"

    if normalized_format == "csv":
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(REPORT_HEADERS)
        writer.writerows(rows)
        content = io.BytesIO(output.getvalue().encode("utf-8-sig"))
        media_type = "text/csv; charset=utf-8"

    elif normalized_format == "xlsx":
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Maintenance Report"
        sheet.append(REPORT_HEADERS)
        for row in rows:
            sheet.append(row)
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        for cell in sheet[1]:
            cell.font = cell.font.copy(bold=True, color="FFFFFF")
            cell.fill = cell.fill.copy(fill_type="solid", fgColor="2563EB")
        for column in sheet.columns:
            width = min(max(len(str(cell.value or "")) for cell in column) + 2, 42)
            sheet.column_dimensions[column[0].column_letter].width = width
        content = io.BytesIO()
        workbook.save(content)
        content.seek(0)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    else:
        content = io.BytesIO()
        document = SimpleDocTemplate(
            content,
            pagesize=landscape(A4),
            rightMargin=12 * mm,
            leftMargin=12 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
        )
        styles = getSampleStyleSheet()
        story = [
            Paragraph("BioTrack Maintenance Report", styles["Title"]),
            Paragraph(f"Generated {datetime.now().strftime('%d %b %Y, %I:%M %p')} · {len(rows)} records", styles["Normal"]),
            Spacer(1, 7 * mm),
        ]
        pdf_rows = [REPORT_HEADERS] + [[Paragraph(str(value), styles["BodyText"]) for value in row] for row in rows]
        if len(pdf_rows) == 1:
            pdf_rows.append(["No maintenance records match the selected filters."] + [""] * (len(REPORT_HEADERS) - 1))
        table = Table(pdf_rows, repeatRows=1, colWidths=[25*mm, 39*mm, 34*mm, 28*mm, 22*mm, 25*mm, 28*mm, 23*mm, 32*mm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(table)
        document.build(story)
        content.seek(0)
        media_type = "application/pdf"

    return StreamingResponse(
        content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _schedule_datetime(value) -> datetime:
    try:
        parsed = datetime.fromisoformat(str(value))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Choose a valid first report date and time.") from exc
    if parsed <= datetime.now():
        raise HTTPException(status_code=422, detail="The first report time must be in the future.")
    return parsed


def _next_schedule_time(current: datetime, frequency: str) -> datetime | None:
    if frequency == "once":
        return None
    if frequency == "daily":
        return current + timedelta(days=1)
    if frequency == "weekly":
        return current + timedelta(days=7)
    year = current.year + (1 if current.month == 12 else 0)
    month = 1 if current.month == 12 else current.month + 1
    day = min(current.day, calendar.monthrange(year, month)[1])
    return current.replace(year=year, month=month, day=day)


@router.get("/schedules")
def list_report_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedules = (
        db.query(ReportSchedule)
        .filter(ReportSchedule.created_by == current_user.username, ReportSchedule.active.is_(True))
        .order_by(ReportSchedule.next_run_at.asc())
        .all()
    )
    return [
        {
            "id": schedule.id,
            "report_format": schedule.report_format,
            "frequency": schedule.frequency,
            "next_run_at": schedule.next_run_at.isoformat(),
            "last_run_at": schedule.last_run_at.isoformat() if schedule.last_run_at else None,
            "filters": json.loads(schedule.filters_json or "{}"),
        }
        for schedule in schedules
    ]


@router.post("/schedules")
def create_report_schedule(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report_format = str(data.get("report_format") or "pdf").casefold()
    frequency = str(data.get("frequency") or "once").casefold()
    if report_format not in {"pdf", "xlsx", "csv"}:
        raise HTTPException(status_code=422, detail="Choose PDF, Excel or CSV.")
    if frequency not in {"once", "daily", "weekly", "monthly"}:
        raise HTTPException(status_code=422, detail="Choose a valid report frequency.")

    schedule = ReportSchedule(
        created_by=current_user.username,
        report_format=report_format,
        frequency=frequency,
        next_run_at=_schedule_datetime(data.get("next_run_at")),
        filters_json=json.dumps(data.get("filters") if isinstance(data.get("filters"), dict) else {}),
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return {"success": True, "schedule_id": schedule.id, "next_run_at": schedule.next_run_at.isoformat()}


@router.post("/schedules/{schedule_id}/complete")
def complete_report_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = db.query(ReportSchedule).filter(
        ReportSchedule.id == schedule_id,
        ReportSchedule.created_by == current_user.username,
        ReportSchedule.active.is_(True),
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Report schedule not found.")
    completed_at = datetime.now()
    next_run = _next_schedule_time(schedule.next_run_at, schedule.frequency)
    schedule.last_run_at = completed_at
    schedule.active = next_run is not None
    if next_run:
        schedule.next_run_at = next_run
    db.commit()
    return {"success": True, "active": schedule.active, "next_run_at": next_run.isoformat() if next_run else None}
