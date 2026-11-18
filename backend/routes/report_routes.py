# ==========================================
# IMPORTS
# ==========================================

import calendar
import csv
import io
import json
import math
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.graphics.charts.barcharts import HorizontalBarChart, VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Circle, Drawing, Rect, String
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
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


PDF_NAVY = colors.HexColor("#0F172A")
PDF_BLUE = colors.HexColor("#2563EB")
PDF_SKY = colors.HexColor("#0EA5E9")
PDF_TEAL = colors.HexColor("#0F766E")
PDF_GREEN = colors.HexColor("#16A34A")
PDF_AMBER = colors.HexColor("#D97706")
PDF_RED = colors.HexColor("#DC2626")
PDF_VIOLET = colors.HexColor("#7C3AED")
PDF_SLATE = colors.HexColor("#64748B")
PDF_BORDER = colors.HexColor("#DCE5F0")
PDF_SURFACE = colors.HexColor("#F8FAFC")


def _pdf_styles():
    styles = getSampleStyleSheet()
    return {
        "hero_title": ParagraphStyle(
            "HeroTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=25,
            leading=29, textColor=colors.white, alignment=TA_LEFT, spaceAfter=5,
        ),
        "hero_subtitle": ParagraphStyle(
            "HeroSubtitle", parent=styles["BodyText"], fontName="Helvetica", fontSize=9,
            leading=14, textColor=colors.HexColor("#DBEAFE"),
        ),
        "eyebrow": ParagraphStyle(
            "Eyebrow", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=7.5,
            leading=10, textColor=PDF_BLUE, uppercase=True, spaceAfter=4,
        ),
        "section": ParagraphStyle(
            "Section", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=15,
            leading=19, textColor=PDF_NAVY, spaceAfter=3,
        ),
        "section_note": ParagraphStyle(
            "SectionNote", parent=styles["BodyText"], fontSize=8.5, leading=12,
            textColor=PDF_SLATE,
        ),
        "metric_label": ParagraphStyle(
            "MetricLabel", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=7,
            leading=9, textColor=PDF_SLATE, uppercase=True,
        ),
        "metric_value": ParagraphStyle(
            "MetricValue", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=19,
            leading=22, textColor=PDF_NAVY,
        ),
        "metric_note": ParagraphStyle(
            "MetricNote", parent=styles["BodyText"], fontSize=6.8, leading=9,
            textColor=PDF_SLATE,
        ),
        "body": ParagraphStyle(
            "ReportBody", parent=styles["BodyText"], fontSize=8, leading=11, textColor=PDF_NAVY,
        ),
        "small": ParagraphStyle(
            "ReportSmall", parent=styles["BodyText"], fontSize=6.7, leading=9, textColor=PDF_SLATE,
        ),
        "table_header": ParagraphStyle(
            "TableHeader", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=6.6,
            leading=8, textColor=colors.white,
        ),
        "table_cell": ParagraphStyle(
            "TableCell", parent=styles["BodyText"], fontSize=6.4, leading=8.2, textColor=PDF_NAVY,
        ),
    }


def _pdf_filter_text(start_date, end_date, department, location, equipment):
    filters = []
    if start_date or end_date:
        filters.append(f"Date: {start_date or 'earliest'} to {end_date or 'latest'}")
    for label, value in (("Department", department), ("Location", location), ("Equipment", equipment)):
        if value and not value.casefold().startswith("all "):
            filters.append(f"{label}: {value}")
    return "  |  ".join(filters) if filters else "All dates, departments, locations and equipment"


def _pdf_metric_card(label, value, note, accent, styles, width=57 * mm):
    card = Table(
        [["", Paragraph(label, styles["metric_label"])], ["", Paragraph(str(value), styles["metric_value"])], ["", Paragraph(note, styles["metric_note"])]],
        colWidths=[3 * mm, width - 3 * mm],
        rowHeights=[5 * mm, 9 * mm, 5 * mm],
    )
    card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BACKGROUND", (0, 0), (0, -1), accent),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 0),
        ("LEFTPADDING", (1, 0), (1, -1), 8),
        ("RIGHTPADDING", (1, 0), (1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("BOX", (0, 0), (-1, -1), 0.6, PDF_BORDER),
        ("ROUNDEDCORNERS", [5]),
    ]))
    return card


def _pdf_status_chart(status_counts):
    drawing = Drawing(340, 150)
    drawing.add(String(0, 137, "REQUEST STATUS", fontName="Helvetica-Bold", fontSize=8, fillColor=PDF_SLATE))
    labels = [name for name, count in status_counts.most_common() if count]
    values = [status_counts[name] for name in labels]
    if not values:
        drawing.add(String(40, 70, "No maintenance calls in this selection", fontName="Helvetica", fontSize=10, fillColor=PDF_SLATE))
        return drawing
    palette = [PDF_GREEN, PDF_BLUE, PDF_AMBER, PDF_RED, PDF_VIOLET, PDF_SKY, PDF_TEAL]
    pie = Pie()
    pie.x, pie.y, pie.width, pie.height = 8, 8, 122, 122
    pie.data = values
    pie.labels = None
    pie.slices.strokeColor = colors.white
    pie.slices.strokeWidth = 1.4
    for index in range(len(values)):
        pie.slices[index].fillColor = palette[index % len(palette)]
    drawing.add(pie)
    total = sum(values)
    drawing.add(String(69, 66, str(total), fontName="Helvetica-Bold", fontSize=16, textAnchor="middle", fillColor=PDF_NAVY))
    drawing.add(String(69, 53, "CALLS", fontName="Helvetica-Bold", fontSize=6, textAnchor="middle", fillColor=PDF_SLATE))
    for index, (label, value) in enumerate(zip(labels[:7], values[:7])):
        y = 118 - index * 16
        drawing.add(Circle(160, y + 2, 4, fillColor=palette[index % len(palette)], strokeColor=None))
        drawing.add(String(171, y, str(label)[:24], fontName="Helvetica", fontSize=7.2, fillColor=PDF_NAVY))
        drawing.add(String(325, y, f"{value}  -  {value / total * 100:.0f}%", fontName="Helvetica-Bold", fontSize=7.2, textAnchor="end", fillColor=PDF_NAVY))
    return drawing


def _pdf_department_chart(department_counts):
    drawing = Drawing(340, 150)
    drawing.add(String(0, 137, "CALLS BY DEPARTMENT", fontName="Helvetica-Bold", fontSize=8, fillColor=PDF_SLATE))
    top_departments = department_counts.most_common(6)
    if not top_departments:
        drawing.add(String(45, 70, "No department data in this selection", fontName="Helvetica", fontSize=10, fillColor=PDF_SLATE))
        return drawing
    chart = HorizontalBarChart()
    chart.x, chart.y, chart.width, chart.height = 108, 12, 215, 110
    chart.data = [[value for _, value in reversed(top_departments)]]
    chart.categoryAxis.categoryNames = [name[:20] for name, _ in reversed(top_departments)]
    chart.categoryAxis.labels.fontName = "Helvetica"
    chart.categoryAxis.labels.fontSize = 6.5
    chart.categoryAxis.labels.fillColor = PDF_SLATE
    chart.valueAxis.valueMin = 0
    maximum = max(value for _, value in top_departments)
    chart.valueAxis.valueMax = max(1, math.ceil(maximum * 1.15))
    chart.valueAxis.valueStep = max(1, math.ceil(chart.valueAxis.valueMax / 4))
    chart.valueAxis.labels.fontSize = 6
    chart.valueAxis.labels.fillColor = PDF_SLATE
    chart.valueAxis.strokeColor = PDF_BORDER
    chart.categoryAxis.strokeColor = PDF_BORDER
    chart.bars[0].fillColor = PDF_BLUE
    chart.bars[0].strokeColor = None
    chart.barWidth = 10
    chart.barSpacing = 4
    chart.barLabelFormat = "%d"
    chart.barLabels.fontName = "Helvetica-Bold"
    chart.barLabels.fontSize = 6.5
    chart.barLabels.fillColor = PDF_NAVY
    drawing.add(chart)
    return drawing


def _pdf_trend_chart(requests):
    drawing = Drawing(700, 155)
    drawing.add(String(0, 142, "MAINTENANCE VOLUME TREND", fontName="Helvetica-Bold", fontSize=8, fillColor=PDF_SLATE))
    monthly = defaultdict(int)
    for request in requests:
        if request.call_received_datetime:
            key = request.call_received_datetime.strftime("%Y-%m")
            monthly[key] += 1
    keys = sorted(monthly)[-8:]
    if not keys:
        drawing.add(String(220, 72, "No dated calls available for a trend chart", fontName="Helvetica", fontSize=10, fillColor=PDF_SLATE))
        return drawing
    values = [monthly[key] for key in keys]
    chart = VerticalBarChart()
    chart.x, chart.y, chart.width, chart.height = 42, 22, 625, 100
    chart.data = [values]
    chart.categoryAxis.categoryNames = [datetime.strptime(key, "%Y-%m").strftime("%b %y") for key in keys]
    chart.categoryAxis.labels.fontSize = 7
    chart.categoryAxis.labels.fillColor = PDF_SLATE
    chart.categoryAxis.strokeColor = PDF_BORDER
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = max(1, math.ceil(max(values) * 1.2))
    chart.valueAxis.valueStep = max(1, math.ceil(chart.valueAxis.valueMax / 4))
    chart.valueAxis.labels.fontSize = 6.5
    chart.valueAxis.labels.fillColor = PDF_SLATE
    chart.valueAxis.strokeColor = PDF_BORDER
    chart.bars[0].fillColor = PDF_TEAL
    chart.bars[0].strokeColor = None
    chart.barWidth = 27
    chart.barLabelFormat = "%d"
    chart.barLabels.fontName = "Helvetica-Bold"
    chart.barLabels.fontSize = 7
    chart.barLabels.fillColor = PDF_NAVY
    drawing.add(chart)
    return drawing


def _pdf_page_frame(canvas, document):
    width, height = landscape(A4)
    canvas.saveState()
    canvas.setFillColor(PDF_NAVY)
    canvas.rect(0, height - 8 * mm, width, 8 * mm, fill=1, stroke=0)
    canvas.setFillColor(PDF_BLUE)
    canvas.rect(0, height - 8 * mm, 42 * mm, 8 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(colors.white)
    canvas.drawString(12 * mm, height - 5.2 * mm, "BIOTRACK  -  MAINTENANCE INTELLIGENCE")
    canvas.setStrokeColor(PDF_BORDER)
    canvas.line(12 * mm, 11 * mm, width - 12 * mm, 11 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(PDF_SLATE)
    canvas.drawString(12 * mm, 7 * mm, "Little Flower Hospital & Research Centre  -  Confidential operational report")
    canvas.drawRightString(width - 12 * mm, 7 * mm, f"Page {document.page}")
    canvas.restoreState()


def _build_executive_pdf(content, requests, rows, filters):
    styles = _pdf_styles()
    status_counts = Counter((request.status or "Unspecified") for request in requests)
    department_counts = Counter((request.department or "Unassigned") for request in requests)
    priority_counts = Counter((request.priority or "Unspecified") for request in requests)
    completed = sum((request.status or "") in {"Completed", "Closed"} for request in requests)
    active = len(requests) - completed
    critical = priority_counts.get("Critical", 0)
    total_downtime = round(sum(request.final_downtime_hours or 0 for request in requests), 1)
    average_downtime = round(total_downtime / completed, 1) if completed else 0
    completion_rate = round(completed / len(requests) * 100) if requests else 0

    document = SimpleDocTemplate(
        content,
        pagesize=landscape(A4),
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=14 * mm,
        bottomMargin=15 * mm,
        title="BioTrack Executive Maintenance Report",
        author="BioTrack Biomedical Maintenance System",
        subject="Hospital equipment maintenance performance and operational analytics",
    )

    hero = Table([
        [
            [
                Paragraph("EXECUTIVE MAINTENANCE INTELLIGENCE", styles["hero_subtitle"]),
                Paragraph("BioTrack Performance Report", styles["hero_title"]),
                Paragraph("A clear operational view of equipment calls, response workload and service performance.", styles["hero_subtitle"]),
            ],
            [
                Paragraph("REPORT GENERATED", styles["hero_subtitle"]),
                Paragraph(datetime.now().strftime("%d %b %Y"), ParagraphStyle("HeroDate", parent=styles["hero_title"], fontSize=17, leading=20, alignment=TA_RIGHT)),
                Paragraph(datetime.now().strftime("%I:%M %p"), ParagraphStyle("HeroTime", parent=styles["hero_subtitle"], alignment=TA_RIGHT)),
            ],
        ]
    ], colWidths=[190 * mm, 65 * mm])
    hero.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PDF_NAVY),
        ("BACKGROUND", (1, 0), (1, 0), PDF_BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 12 * mm),
        ("RIGHTPADDING", (0, 0), (0, 0), 8 * mm),
        ("LEFTPADDING", (1, 0), (1, 0), 8 * mm),
        ("RIGHTPADDING", (1, 0), (1, 0), 8 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 10 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10 * mm),
    ]))

    filter_banner = Table([[Paragraph("<b>Report scope</b>  -  " + _pdf_filter_text(*filters), styles["body"])]], colWidths=[255 * mm])
    filter_banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#BFDBFE")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))

    metric_rows = [
        [
            _pdf_metric_card("Total calls", len(requests), f"{len(department_counts)} departments represented", PDF_BLUE, styles),
            _pdf_metric_card("Completed", completed, f"{completion_rate}% completion rate", PDF_GREEN, styles),
            _pdf_metric_card("Active workload", active, "Calls requiring follow-up", PDF_AMBER, styles),
            _pdf_metric_card("Critical calls", critical, "Highest-priority requests", PDF_RED, styles),
        ],
        [
            _pdf_metric_card("Total downtime", f"{total_downtime:.1f} h", "Across this report selection", PDF_VIOLET, styles),
            _pdf_metric_card("Average downtime", f"{average_downtime:.1f} h", "Per completed maintenance call", PDF_SKY, styles),
            _pdf_metric_card("Equipment types", len({request.equipment_name for request in requests if request.equipment_name}), "Unique equipment represented", PDF_TEAL, styles),
            _pdf_metric_card("Top department", department_counts.most_common(1)[0][0] if department_counts else "-", f"{department_counts.most_common(1)[0][1] if department_counts else 0} maintenance calls", PDF_BLUE, styles),
        ],
    ]
    metrics = Table(metric_rows, colWidths=[63.75 * mm] * 4, hAlign="LEFT")
    metrics.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    charts = Table(
        [[_pdf_status_chart(status_counts), _pdf_department_chart(department_counts)]],
        colWidths=[127.5 * mm, 127.5 * mm],
    )
    charts.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.6, PDF_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, PDF_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    highlights = [
        [Paragraph("COMPLETION", styles["eyebrow"]), Paragraph("PRIORITY", styles["eyebrow"]), Paragraph("DOWNTIME", styles["eyebrow"])],
        [
            Paragraph(f"{completed} of {len(requests)} calls are complete. The current completion rate is <b>{completion_rate}%</b>.", styles["body"]),
            Paragraph(f"<b>{critical}</b> critical and <b>{priority_counts.get('High', 0)}</b> high-priority calls are included in this selection.", styles["body"]),
            Paragraph(f"Recorded downtime totals <b>{total_downtime:.1f} hours</b>, averaging <b>{average_downtime:.1f} hours</b> per completed call.", styles["body"]),
        ],
    ]
    highlights_table = Table(highlights, colWidths=[85 * mm] * 3)
    highlights_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PDF_SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.6, PDF_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, PDF_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    detailed_rows = [[Paragraph(header, styles["table_header"]) for header in REPORT_HEADERS]]
    detailed_rows.extend([[Paragraph(str(value), styles["table_cell"]) for value in row] for row in rows])
    if len(detailed_rows) == 1:
        detailed_rows.append([Paragraph("No maintenance records match the selected filters.", styles["table_cell"])] + [""] * (len(REPORT_HEADERS) - 1))
    detail_table = Table(
        detailed_rows,
        repeatRows=1,
        colWidths=[24*mm, 39*mm, 32*mm, 26*mm, 19*mm, 22*mm, 27*mm, 22*mm, 35*mm],
    )
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PDF_NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, PDF_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PDF_SURFACE]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    story = [
        hero,
        Spacer(1, 5 * mm),
        filter_banner,
        Spacer(1, 5 * mm),
        Paragraph("PERFORMANCE AT A GLANCE", styles["eyebrow"]),
        Paragraph("Operational overview", styles["section"]),
        Paragraph("Key indicators calculated from the maintenance calls included in this report.", styles["section_note"]),
        Spacer(1, 3 * mm),
        metrics,
        Spacer(1, 4 * mm),
        highlights_table,
        PageBreak(),
        Paragraph("ANALYTICS", styles["eyebrow"]),
        Paragraph("Maintenance demand and operational signals", styles["section"]),
        Paragraph("Use these patterns to identify workload concentration, emerging demand and downtime exposure.", styles["section_note"]),
        Spacer(1, 4 * mm),
        KeepTogether(charts),
        Spacer(1, 4 * mm),
        KeepTogether(_pdf_trend_chart(requests)),
        PageBreak(),
        Paragraph("MAINTENANCE REGISTER", styles["eyebrow"]),
        Paragraph("Detailed call records", styles["section"]),
        Paragraph(f"{len(rows)} maintenance record{'s' if len(rows) != 1 else ''} in the selected scope. Table headers repeat automatically across pages.", styles["section_note"]),
        Spacer(1, 3 * mm),
        detail_table,
    ]
    document.build(story, onFirstPage=_pdf_page_frame, onLaterPages=_pdf_page_frame)

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
        _build_executive_pdf(
            content,
            requests,
            rows,
            (start_date, end_date, department, location, equipment),
        )
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
