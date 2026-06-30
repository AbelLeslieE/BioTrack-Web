# ==========================================
# IMPORTS
# ==========================================

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    HTTPException
)
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.excel_import_service import import_assets_from_excel
from backend.models.asset import Asset


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/api/assets",
    tags=["Assets"]
)


# ==========================================
# IMPORT EXCEL
# ==========================================

@router.post("/upload")
async def upload_asset_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    result = import_assets_from_excel(file.file, db)

    return result


# ==========================================
# GET ALL ASSETS
# ==========================================





@router.get("/")
def get_assets(db: Session = Depends(get_db)):

    assets = db.query(Asset).order_by(Asset.id.desc()).all()

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

            "qr_code": asset.qr_code,

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
    db: Session = Depends(get_db)
):

    asset = (
        db.query(Asset)
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

            "qr_code": asset.qr_code

        }

    }
# ==========================================
# GET SINGLE ASSET
# ==========================================

@router.get("/{asset_id}")
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db)
):

    asset = db.query(Asset).filter(
        Asset.id == asset_id
    ).first()

    if not asset:
        return {"error": "Asset not found"}

    return {

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

        "qr_code": asset.qr_code,

        "created_at": asset.created_at,

        "updated_at": asset.updated_at

    }
# ==========================================
# CREATE NEW ASSET
# ==========================================

from fastapi import Body
from datetime import datetime

@router.post("/")
def create_asset(

    data: dict = Body(...),

    db: Session = Depends(get_db)

):

    asset = Asset(

        asset_code=data.get("equipmentId"),

        equipment_no=data.get("equipmentId"),

        equipment_name=data.get("equipmentName"),

        classification=data.get("assetCategory"),

        equipment_type=data.get("equipmentType"),

        manufacturer=data.get("manufacturer"),

        manufacturer_address=data.get("manufacturerAddress"),

        model=data.get("model"),

        serial_number=data.get("serialNumber"),

        manufacturing_year=(
            int(data["manufacturerYear"])
            if data.get("manufacturerYear")
            else None
        ),

        supplier=data.get("supplier"),

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

    db.commit()

    db.refresh(asset)

    return {

        "success": True,

        "asset_id": asset.id

    }