# ==========================================
# IMPORTS
# ==========================================

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    Form,
    Query,
    HTTPException,
    Body,
)
from fastapi.responses import FileResponse, Response
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy import false, func, select
from sqlalchemy.exc import SQLAlchemyError

from backend.database import get_db
from backend.services.excel_import_service import import_assets_from_excel
from backend.models.asset import Asset
from backend.models.asset_document import AssetDocument
from backend.models.asset_history import AssetHistory
from backend.models.asset_spare import AssetSpare
from backend.models.asset_relocation_request import AssetRelocationRequest
from backend.models.pm_history import PMHistory
from backend.models.pm_schedule import PMSchedule
from backend.auth import get_current_user, require_roles
from backend.models.user import User
from backend.services.service_team import scope_to_team, team_for_user
from backend.services.qr_service import qr_url_for_asset_code
from backend.services.attachment_service import ASSET_DOCUMENT_DIRECTORY, optimize_attachment
from datetime import datetime


ASSET_DOCUMENT_TYPES = {
    "Manual",
    "Invoice",
    "Certificate",
    "Service Report",
    "Photo",
    "Calibration Document",
}


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/api/assets",
    tags=["Assets"],
    dependencies=[Depends(get_current_user)],
)


def _assets_visible_to(db: Session, current_user: User):
    """Return only the assets the signed-in role is allowed to inspect."""
    assets = scope_to_team(db.query(Asset), Asset, current_user)
    if current_user.role == "User":
        if not current_user.department:
            return assets.filter(false())
        assets = assets.filter(Asset.department == current_user.department)
    return assets


def _last_completed_pm_date(db: Session, asset_id: int):
    history_date = (
        select(func.max(PMHistory.completed_date))
        .where(PMHistory.asset_id == asset_id)
        .scalar_subquery()
    )
    schedule_date = (
        select(func.max(PMSchedule.completed_date))
        .where(PMSchedule.asset_id == asset_id)
        .scalar_subquery()
    )
    return db.execute(select(func.coalesce(history_date, schedule_date))).scalar_one_or_none()


# ==========================================
# IMPORT EXCEL
# ==========================================

@router.post("/upload", dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))])
async def upload_asset_excel(
    file: UploadFile = File(...),
    service_team: str | None = Query(default=None),
    service_team_form: str | None = Form(default=None, alias="service_team"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requested_team = service_team or service_team_form

    if current_user.role == "Manager" and not requested_team:
        raise HTTPException(status_code=422, detail="Select the service team for this import.")

    result = import_assets_from_excel(file.file, db, team_for_user(current_user, requested_team))

    if not result.get("success"):
        raise HTTPException(
            status_code=422,
            detail=result.get("message") or "The spreadsheet could not be imported.",
        )

    return result


# ==========================================
# GET ALL ASSETS
# ==========================================





@router.get("/")
def get_assets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 250,
    offset: int = 0,
):

    page_size = max(1, min(int(limit), 500))
    page_offset = max(0, int(offset))
    assets = (
        _assets_visible_to(db, current_user)
        .order_by(Asset.id.desc())
        .offset(page_offset)
        .limit(page_size)
        .all()
    )

    return [
        {
            "id": asset.id,

            "asset_code": asset.asset_code,

            "equipment_no": asset.equipment_no,

            "equipment_name": asset.equipment_name,

            "classification": asset.classification,

            "equipment_type": asset.equipment_type,

            "manufacturer": asset.manufacturer,

            "manufacturer_address": asset.manufacturer_address,

            "model": asset.model,

            "serial_number": asset.serial_number,

            "manufacturing_year": asset.manufacturing_year,

            "maintained_by": asset.maintained_by,

            "service_team": asset.service_team,

            "supplier": asset.supplier,

            "purchase_value": asset.purchase_value,

            "tax_amount": asset.tax_amount,

            "net_value": asset.net_value,

            "purchase_date": asset.purchase_date,

            "installation_date": asset.installation_date,

            "warranty": asset.warranty,

            "department": asset.department,

            "location": asset.location,

            "status": asset.status,

            "pm_frequency": asset.pm_frequency,

            "calibration_required": asset.calibration_required,

            "remarks": asset.remarks,

            "image_path": asset.image_path,

            "qr_generated": asset.qr_generated,

            "qr_code": qr_url_for_asset_code(asset.asset_code) if asset.qr_generated else None,

            "created_at": asset.created_at,

            "updated_at": asset.updated_at

        }

        for asset in assets
    ]
# ==========================================
# GET ASSET BY ASSET CODE
# ==========================================

@router.get("/code/{asset_code}")
def get_asset_by_code(
    asset_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    asset = (
        _assets_visible_to(db, current_user)
        .filter(Asset.asset_code == asset_code)
        .first()
    )

    if not asset:

        raise HTTPException(
            status_code=404,
            detail="Asset not found"
        )

    return {

        "success": True,

        "asset": {

            "id": asset.id,

            "asset_code": asset.asset_code,

            "equipment_name": asset.equipment_name,

            "manufacturer": asset.manufacturer,

            "department": asset.department,

            "location": asset.location,

            "status": asset.status,

            "model": asset.model,

            "serial_number": asset.serial_number,

            "image_path": asset.image_path,

            "qr_code": qr_url_for_asset_code(asset.asset_code) if asset.qr_generated else None

        }

    }
# ==========================================
# DEPARTMENT USER ASSET LIST
# ==========================================

@router.get("/department/mine", dependencies=[Depends(require_roles("User"))])
def get_department_assets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A concise asset feed for the department user's My Assets page."""
    assets = _assets_visible_to(db, current_user).order_by(Asset.equipment_name.asc()).all()
    return [
        {
            "id": asset.id,
            "asset_code": asset.asset_code,
            "equipment_no": asset.equipment_no,
            "equipment_name": asset.equipment_name,
            "classification": asset.classification,
            "equipment_type": asset.equipment_type,
            "manufacturer": asset.manufacturer,
            "model": asset.model,
            "department": asset.department,
            "location": asset.location,
            "status": asset.status,
            "pm_frequency": asset.pm_frequency,
            "service_team": asset.service_team,
        }
        for asset in assets
    ]


def _relocation_payload(item: AssetRelocationRequest, asset: Asset | None) -> dict:
    return {
        "id": item.id,
        "asset_id": item.asset_id,
        "asset_code": asset.asset_code if asset else None,
        "equipment_name": asset.equipment_name if asset else "Removed asset",
        "requested_by": item.requested_by,
        "requester_department": item.requester_department,
        "service_team": item.service_team,
        "from_department": item.from_department,
        "from_location": item.from_location,
        "target_department": item.target_department,
        "target_location": item.target_location,
        "reason": item.reason,
        "status": item.status,
        "reviewed_by": item.reviewed_by,
        "review_note": item.review_note,
        "created_at": item.created_at,
        "reviewed_at": item.reviewed_at,
    }


@router.get("/relocation-requests/mine", dependencies=[Depends(require_roles("User"))])
def get_my_asset_relocation_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requests = (
        db.query(AssetRelocationRequest)
        .filter(AssetRelocationRequest.requested_by == current_user.username)
        .order_by(AssetRelocationRequest.id.desc())
        .all()
    )
    assets = {
        asset.id: asset
        for asset in db.query(Asset).filter(Asset.id.in_([item.asset_id for item in requests])).all()
    } if requests else {}
    return [_relocation_payload(item, assets.get(item.asset_id)) for item in requests]


@router.post("/relocation-requests", dependencies=[Depends(require_roles("User"))])
def create_asset_relocation_request(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        asset_id = int(data.get("asset_id"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Select an asset to relocate.") from exc

    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    user_department = str(current_user.department or "").strip()
    asset_department = str(asset.department or "").strip()
    if not user_department or user_department.casefold() != asset_department.casefold():
        raise HTTPException(status_code=403, detail="You can request relocation only for an asset assigned to your department.")

    target_department = str(data.get("target_department") or "").strip()
    target_location = str(data.get("target_location") or "").strip()
    reason = str(data.get("reason") or "").strip()
    if not target_department:
        raise HTTPException(status_code=422, detail="Select the destination department.")
    if len(target_department) > 255 or len(target_location) > 255 or len(reason) > 2000:
        raise HTTPException(status_code=422, detail="The relocation details are too long.")
    if target_department.casefold() == asset_department.casefold() and not target_location:
        raise HTTPException(status_code=422, detail="Enter the destination room or location.")
    if (
        target_department.casefold() == asset_department.casefold()
        and target_location.casefold() == str(asset.location or "").strip().casefold()
    ):
        raise HTTPException(status_code=422, detail="Choose a different department or room.")

    pending = (
        db.query(AssetRelocationRequest)
        .filter(
            AssetRelocationRequest.asset_id == asset.id,
            AssetRelocationRequest.status == "Pending",
        )
        .first()
    )
    if pending:
        raise HTTPException(status_code=409, detail="A relocation request is already pending for this asset.")

    request = AssetRelocationRequest(
        asset_id=asset.id,
        requested_by=current_user.username,
        requester_department=user_department,
        service_team=asset.service_team or "Biomedical",
        from_department=asset.department,
        from_location=asset.location,
        target_department=target_department,
        target_location=target_location or None,
        reason=reason or None,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return {"success": True, "request": _relocation_payload(request, asset)}


@router.get(
    "/relocation-requests",
    dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))],
)
def get_asset_relocation_requests(
    status: str | None = Query(default="Pending"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AssetRelocationRequest)
    if current_user.role != "Manager":
        query = query.filter(AssetRelocationRequest.service_team == team_for_user(current_user))
    if status and status.casefold() != "all":
        query = query.filter(AssetRelocationRequest.status == status.title())
    requests = query.order_by(AssetRelocationRequest.id.desc()).all()
    assets = {
        asset.id: asset
        for asset in db.query(Asset).filter(Asset.id.in_([item.asset_id for item in requests])).all()
    } if requests else {}
    return [_relocation_payload(item, assets.get(item.asset_id)) for item in requests]


@router.patch(
    "/relocation-requests/{request_id}",
    dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))],
)
def review_asset_relocation_request(
    request_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AssetRelocationRequest).filter(AssetRelocationRequest.id == request_id)
    if current_user.role != "Manager":
        query = query.filter(AssetRelocationRequest.service_team == team_for_user(current_user))
    request = query.first()
    if not request:
        raise HTTPException(status_code=404, detail="Relocation request not found for your engineering team.")
    if request.status != "Pending":
        raise HTTPException(status_code=409, detail=f"This request is already {request.status.lower()}.")

    decision = str(data.get("decision") or "").strip().casefold()
    if decision not in {"approve", "reject"}:
        raise HTTPException(status_code=422, detail="Choose approve or reject.")
    review_note = str(data.get("review_note") or "").strip()
    if len(review_note) > 2000:
        raise HTTPException(status_code=422, detail="The review note is too long.")

    asset = db.get(Asset, request.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="The requested asset no longer exists.")
    if decision == "approve":
        asset.department = request.target_department
        asset.location = request.target_location or None
        request.status = "Approved"
    else:
        request.status = "Rejected"
    request.reviewed_by = current_user.username
    request.review_note = review_note or None
    request.reviewed_at = datetime.now()
    db.commit()
    db.refresh(request)
    return {"success": True, "request": _relocation_payload(request, asset)}


# ==========================================
# ADMINISTRATOR BULK DELETE
# ==========================================

@router.post("/bulk-delete", dependencies=[Depends(require_roles("Manager"))])
def bulk_delete_assets(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently remove administrator-selected assets and their direct child records."""
    raw_ids = data.get("asset_ids")
    if not isinstance(raw_ids, list):
        raise HTTPException(status_code=422, detail="Select one or more assets to delete.")

    try:
        asset_ids = sorted({int(value) for value in raw_ids if int(value) > 0})
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="The asset selection is invalid.") from exc

    if not asset_ids:
        raise HTTPException(status_code=422, detail="Select one or more assets to delete.")
    if len(asset_ids) > 1000:
        raise HTTPException(status_code=422, detail="Delete no more than 1,000 assets at a time.")

    assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
    found_ids = {asset.id for asset in assets}
    if not found_ids:
        raise HTTPException(status_code=404, detail="None of the selected assets were found.")

    try:
        # Delete child rows explicitly because older databases may not have
        # every ON DELETE CASCADE constraint applied.
        db.query(PMHistory).filter(PMHistory.asset_id.in_(found_ids)).delete(synchronize_session=False)
        db.query(PMSchedule).filter(PMSchedule.asset_id.in_(found_ids)).delete(synchronize_session=False)
        db.query(AssetDocument).filter(AssetDocument.asset_id.in_(found_ids)).delete(synchronize_session=False)
        db.query(AssetHistory).filter(AssetHistory.asset_id.in_(found_ids)).delete(synchronize_session=False)
        db.query(AssetSpare).filter(AssetSpare.asset_id.in_(found_ids)).delete(synchronize_session=False)
        db.query(AssetRelocationRequest).filter(AssetRelocationRequest.asset_id.in_(found_ids)).delete(synchronize_session=False)
        db.query(Asset).filter(Asset.id.in_(found_ids)).delete(synchronize_session=False)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="One or more selected assets could not be deleted. Refresh the registry and try again.",
        ) from exc

    return {
        "success": True,
        "deleted": len(found_ids),
        "deleted_ids": sorted(found_ids),
        "missing": len(asset_ids) - len(found_ids),
    }
# ==========================================
# GET SINGLE ASSET
# ==========================================

def _asset_document_payload(document: AssetDocument) -> dict:
    is_image = (document.content_type or "").startswith("image/")
    return {
        "id": document.id,
        "asset_id": document.asset_id,
        "document_name": document.document_name,
        "document_type": document.document_type or "Manual",
        "content_type": document.content_type or "application/pdf",
        "original_size_bytes": document.original_size_bytes or 0,
        "stored_size_bytes": document.stored_size_bytes or 0,
        "uploaded_by": document.uploaded_by or "",
        "uploaded_at": document.uploaded_at,
        "download_url": f"/api/assets/documents/{document.id}/download",
        "preview_url": f"/api/assets/documents/{document.id}/preview" if is_image else None,
    }


def _engineering_asset(db: Session, asset_id: int, current_user: User) -> Asset:
    asset = _assets_visible_to(db, current_user).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found for your engineering team.")
    return asset


@router.get(
    "/{asset_id}/documents",
    dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))],
)
def list_asset_documents(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = _engineering_asset(db, asset_id, current_user)
    documents = (
        db.query(AssetDocument)
        .filter(AssetDocument.asset_id == asset.id)
        .order_by(AssetDocument.uploaded_at.desc(), AssetDocument.id.desc())
        .all()
    )
    return [_asset_document_payload(document) for document in documents]


@router.post(
    "/{asset_id}/documents",
    dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))],
)
async def upload_asset_document(
    asset_id: int,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = _engineering_asset(db, asset_id, current_user)
    if document_type not in ASSET_DOCUMENT_TYPES:
        raise HTTPException(status_code=422, detail="Select a supported document type.")

    existing_documents = db.query(AssetDocument).filter(AssetDocument.asset_id == asset.id).all()
    if len(existing_documents) >= 50:
        raise HTTPException(status_code=409, detail="This asset has reached its 50-document limit.")
    stored_total = sum(int(document.stored_size_bytes or 0) for document in existing_documents)
    if stored_total >= 50 * 1024 * 1024:
        raise HTTPException(status_code=409, detail="This asset has reached its document storage limit.")

    original_name = Path(file.filename or "asset-document").name[:240]
    raw = await file.read()
    optimized, content_type, extension = await run_in_threadpool(
        optimize_attachment,
        original_name,
        file.content_type or "",
        raw,
    )
    if document_type == "Photo" and not content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="Equipment photos must be JPG, JPEG, or PNG images.")
    stored_name = f"{uuid4().hex}{extension}"
    if stored_total + len(optimized) > 50 * 1024 * 1024:
        raise HTTPException(status_code=409, detail="This document would exceed the asset storage limit.")
    document = AssetDocument(
        asset_id=asset.id,
        document_name=original_name,
        document_type=document_type,
        file_path=stored_name,
        file_data=optimized,
        content_type=content_type,
        original_size_bytes=len(raw),
        stored_size_bytes=len(optimized),
        uploaded_by=current_user.name or current_user.username,
    )
    db.add(document)
    try:
        db.flush()
        if document_type == "Photo":
            asset.image_path = f"/api/assets/documents/{document.id}/preview"
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        raise
    return {"success": True, "document": _asset_document_payload(document)}


def _asset_document_for_user(
    db: Session,
    document_id: int,
    current_user: User,
) -> AssetDocument:
    document = db.get(AssetDocument, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Asset document not found.")
    _engineering_asset(db, document.asset_id, current_user)
    return document


@router.get(
    "/documents/{document_id}/preview",
    dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT", "User"))],
)
def preview_asset_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = db.get(AssetDocument, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Asset photo not found.")
    asset = _assets_visible_to(db, current_user).filter(Asset.id == document.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset photo not found for your portal.")
    if not (document.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="This asset document is not an image.")
    if document.file_data is not None:
        return Response(
            content=document.file_data,
            media_type=document.content_type,
            headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"},
        )
    path = ASSET_DOCUMENT_DIRECTORY / Path(document.file_path).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="The stored asset photo is missing.")
    return FileResponse(
        path,
        media_type=document.content_type,
        content_disposition_type="inline",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"},
    )


@router.get(
    "/documents/{document_id}/download",
    dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))],
)
def download_asset_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _asset_document_for_user(db, document_id, current_user)
    if document.file_data is not None:
        safe_name = quote(Path(document.document_name).name, safe="")
        return Response(
            content=document.file_data,
            media_type=document.content_type or "application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, no-store",
            },
        )
    path = ASSET_DOCUMENT_DIRECTORY / Path(document.file_path).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="The stored asset document is missing.")
    return FileResponse(
        path,
        media_type=document.content_type or "application/octet-stream",
        filename=document.document_name,
        content_disposition_type="attachment",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"},
    )


@router.delete(
    "/documents/{document_id}",
    dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))],
)
def delete_asset_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _asset_document_for_user(db, document_id, current_user)
    path = ASSET_DOCUMENT_DIRECTORY / Path(document.file_path).name
    asset = db.get(Asset, document.asset_id)
    active_photo_url = f"/api/assets/documents/{document.id}/preview"
    if asset and asset.image_path == active_photo_url:
        fallback = (
            db.query(AssetDocument)
            .filter(
                AssetDocument.asset_id == asset.id,
                AssetDocument.id != document.id,
                AssetDocument.document_type == "Photo",
                AssetDocument.content_type.like("image/%"),
            )
            .order_by(AssetDocument.uploaded_at.desc(), AssetDocument.id.desc())
            .first()
        )
        asset.image_path = f"/api/assets/documents/{fallback.id}/preview" if fallback else None
    db.delete(document)
    db.commit()
    if path.is_file():
        path.unlink()
    return {"success": True}

@router.get("/{asset_id}")
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    asset = _assets_visible_to(db, current_user).filter(
        Asset.id == asset_id
    ).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    last_pm_date = _last_completed_pm_date(db, asset.id)
    general_details = {
        "id": asset.id,
        "asset_code": asset.asset_code,
        "equipment_no": asset.equipment_no,
        "equipment_name": asset.equipment_name,
        "classification": asset.classification,
        "equipment_type": asset.equipment_type,
        "manufacturer": asset.manufacturer,
        "model": asset.model,
        "serial_number": asset.serial_number,
        "manufacturing_year": asset.manufacturing_year,
        "service_team": asset.service_team,
        "department": asset.department,
        "location": asset.location,
        "status": asset.status,
        "image_path": asset.image_path,
        "last_pm_date": last_pm_date,
    }

    # Department staff only receive operational identification and the latest
    # PM date. Procurement, warranty and lifecycle data remain private to
    # administrators and the responsible engineering teams.
    if current_user.role == "User":
        return general_details

    return {
        **general_details,
        "manufacturer_address": asset.manufacturer_address,
        "maintained_by": asset.maintained_by,
        "supplier": asset.supplier,
        "purchase_value": asset.purchase_value,
        "tax_amount": asset.tax_amount,
        "net_value": asset.net_value,
        "purchase_date": asset.purchase_date,
        "installation_date": asset.installation_date,
        "warranty": asset.warranty,
        "pm_frequency": asset.pm_frequency,
        "calibration_required": asset.calibration_required,
        "remarks": asset.remarks,
        "qr_generated": asset.qr_generated,
        "qr_code": qr_url_for_asset_code(asset.asset_code) if asset.qr_generated else None,
        "created_at": asset.created_at,
        "updated_at": asset.updated_at,
    }
# ==========================================
# CREATE NEW ASSET
# ==========================================

from datetime import date, datetime
from sqlalchemy.exc import IntegrityError

@router.post("/", dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))])
def create_asset(

    data: dict = Body(...),

    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),

):

    equipment_id = str(data.get("equipmentId") or "").strip()
    equipment_name = str(data.get("equipmentName") or "").strip()
    serial_number = str(data.get("serialNumber") or "").strip() or None

    if not equipment_id:
        raise HTTPException(status_code=422, detail="Equipment ID is required.")
    if not equipment_name:
        raise HTTPException(status_code=422, detail="Equipment name is required.")

    asset = Asset(

        asset_code=equipment_id,

        equipment_no=equipment_id,

        equipment_name=equipment_name,

        classification=data.get("assetCategory"),

        equipment_type=data.get("equipmentType"),

        manufacturer=data.get("manufacturer"),

        manufacturer_address=data.get("manufacturerAddress"),

        model=data.get("model"),

        serial_number=serial_number,

        manufacturing_year=(
            int(data["manufacturerYear"])
            if data.get("manufacturerYear")
            else None
        ),

        supplier=data.get("supplier"),

        service_team=team_for_user(current_user, data.get("service_team")),

        purchase_value=float(
            data.get("purchaseCost") or 0
        ),

        tax_amount=float(
            data.get("gst") or 0
        ),

        purchase_date=(
            datetime.strptime(
                data["purchaseDate"],
                "%Y-%m-%d"
            ).date()
            if data.get("purchaseDate")
            else None
        ),

        installation_date=(
            datetime.strptime(
                data["installationDate"],
                "%Y-%m-%d"
            ).date()
            if data.get("installationDate")
            else None
        ),

        warranty=data.get("warrantyAvailable"),

        department=data.get("department"),

        location=data.get("location"),

        status=data.get("status"),

        remarks=data.get("description")

    )

    db.add(asset)

    try:
        db.commit()
        db.refresh(asset)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Asset code, equipment number and serial number must be unique.",
        ) from exc

    return {

        "success": True,

        "asset_id": asset.id

    }


def _asset_date(value, field_name: str):
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Enter a valid {field_name}.") from exc


def _asset_float(value, field_name: str) -> float:
    if value in (None, ""):
        return 0.0
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Enter a valid {field_name}.") from exc
    if parsed < 0:
        raise HTTPException(status_code=422, detail=f"{field_name.title()} cannot be negative.")
    return parsed


def _asset_optional_int(value, field_name: str):
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Enter a valid {field_name}.") from exc
    if parsed < 0:
        raise HTTPException(status_code=422, detail=f"{field_name.title()} cannot be negative.")
    return parsed


@router.patch("/{asset_id}", dependencies=[Depends(require_roles("Manager", "BME", "Electrical", "IT"))])
def update_asset(
    asset_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an asset while preserving role and service-team ownership boundaries."""
    asset = _assets_visible_to(db, current_user).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset_code = str(data.get("asset_code") or "").strip()
    equipment_name = str(data.get("equipment_name") or "").strip()
    equipment_no = str(data.get("equipment_no") or "").strip() or None
    serial_number = str(data.get("serial_number") or "").strip() or None

    if not asset_code:
        raise HTTPException(status_code=422, detail="Asset code is required.")
    if not equipment_name:
        raise HTTPException(status_code=422, detail="Equipment name is required.")

    duplicate_checks = [
        (Asset.asset_code, asset_code, "asset code"),
        (Asset.equipment_no, equipment_no, "equipment number"),
        (Asset.serial_number, serial_number, "serial number"),
    ]
    for column, value, label in duplicate_checks:
        if value and db.query(Asset.id).filter(column == value, Asset.id != asset_id).first():
            raise HTTPException(status_code=409, detail=f"Another asset already uses this {label}.")

    purchase_value = _asset_float(data.get("purchase_value"), "purchase value")
    tax_amount = _asset_float(data.get("tax_amount"), "tax amount")

    asset.asset_code = asset_code
    asset.equipment_no = equipment_no
    asset.equipment_name = equipment_name
    asset.classification = str(data.get("classification") or "").strip() or None
    asset.equipment_type = str(data.get("equipment_type") or "").strip() or None
    asset.manufacturer = str(data.get("manufacturer") or "").strip() or None
    asset.manufacturer_address = str(data.get("manufacturer_address") or "").strip() or None
    asset.model = str(data.get("model") or "").strip() or None
    asset.serial_number = serial_number
    asset.manufacturing_year = _asset_optional_int(data.get("manufacturing_year"), "manufacturing year")
    asset.maintained_by = str(data.get("maintained_by") or "").strip() or None
    asset.service_team = team_for_user(
        current_user,
        data.get("service_team") or asset.service_team,
    )
    asset.supplier = str(data.get("supplier") or "").strip() or None
    asset.purchase_value = purchase_value
    asset.tax_amount = tax_amount
    asset.net_value = purchase_value + tax_amount
    asset.purchase_date = _asset_date(data.get("purchase_date"), "purchase date")
    asset.installation_date = _asset_date(data.get("installation_date"), "installation date")
    asset.warranty = str(data.get("warranty") or "").strip() or None
    asset.department = str(data.get("department") or "").strip() or None
    asset.location = str(data.get("location") or "").strip() or None
    asset.status = str(data.get("status") or "Active").strip() or "Active"
    asset.pm_frequency = _asset_optional_int(data.get("pm_frequency"), "PM frequency")
    asset.calibration_required = bool(data.get("calibration_required"))
    asset.remarks = str(data.get("remarks") or "").strip() or None
    asset.updated_at = datetime.now()

    try:
        db.commit()
        db.refresh(asset)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Asset code, equipment number and serial number must be unique.") from exc

    return {"success": True, "asset_id": asset.id}
