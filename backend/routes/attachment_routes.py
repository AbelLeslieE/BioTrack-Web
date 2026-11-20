from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from backend.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models.request import Request
from backend.models.request_attachment import RequestAttachment
from backend.models.user import User
from backend.services.attachment_service import ATTACHMENT_DIRECTORY, optimize_attachment


DOCUMENT_TYPES = {
    "Manual",
    "Invoice",
    "Certificate",
    "Service Report",
    "Photo",
    "Calibration Document",
}

router = APIRouter(
    prefix="/api/engineer/ticket",
    tags=["Maintenance attachments"],
    dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))],
)


def _team_for_role(role: str) -> str | None:
    return {"BME": "Biomedical", "Electrical": "Electrical", "IT": "IT"}.get(role)


def _ticket_for_user(db: Session, ticket_id: int, current_user: User) -> Request:
    query = db.query(Request).filter(Request.id == ticket_id)
    team = _team_for_role(current_user.role)
    if team:
        query = query.filter(Request.service_team == team)
    ticket = query.first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Maintenance call not found.")
    return ticket


def _serialize(attachment: RequestAttachment) -> dict:
    return {
        "id": attachment.id,
        "document_type": attachment.document_type,
        "original_name": attachment.original_name,
        "content_type": attachment.content_type,
        "original_size_bytes": attachment.original_size_bytes,
        "stored_size_bytes": attachment.stored_size_bytes,
        "uploaded_by": attachment.uploaded_by,
        "uploaded_at": attachment.uploaded_at,
        "download_url": f"/api/engineer/ticket/attachments/{attachment.id}/download",
    }


@router.get("/{ticket_id}/attachments")
def list_ticket_attachments(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _ticket_for_user(db, ticket_id, current_user)
    items = (
        db.query(RequestAttachment)
        .filter(RequestAttachment.request_id == ticket.id)
        .order_by(RequestAttachment.uploaded_at.desc())
        .all()
    )
    return [_serialize(item) for item in items]


@router.post("/{ticket_id}/attachments")
async def upload_ticket_attachment(
    ticket_id: int,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _ticket_for_user(db, ticket_id, current_user)
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=422, detail="Select a supported document type.")

    original_name = Path(file.filename or "attachment").name[:240]
    raw = await file.read()
    optimized, stored_content_type, extension = await run_in_threadpool(
        optimize_attachment,
        original_name,
        file.content_type or "",
        raw,
    )
    stored_name = f"{uuid4().hex}{extension}"
    target = ATTACHMENT_DIRECTORY / stored_name
    await run_in_threadpool(target.write_bytes, optimized)

    attachment = RequestAttachment(
        request_id=ticket.id,
        document_type=document_type,
        original_name=original_name,
        stored_name=stored_name,
        content_type=stored_content_type,
        original_size_bytes=len(raw),
        stored_size_bytes=len(optimized),
        uploaded_by=current_user.name or current_user.username,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return {"success": True, "attachment": _serialize(attachment)}


@router.get("/attachments/{attachment_id}/download")
def download_ticket_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachment = db.get(RequestAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    _ticket_for_user(db, attachment.request_id, current_user)
    path = ATTACHMENT_DIRECTORY / attachment.stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="The stored attachment file is missing.")
    return FileResponse(path, media_type=attachment.content_type, filename=attachment.original_name)


@router.delete("/attachments/{attachment_id}")
def delete_ticket_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachment = db.get(RequestAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    _ticket_for_user(db, attachment.request_id, current_user)
    path = ATTACHMENT_DIRECTORY / attachment.stored_name
    db.delete(attachment)
    db.commit()
    if path.is_file():
        path.unlink()
    return {"success": True}
