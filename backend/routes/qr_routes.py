# ==========================================
# IMPORTS
# ==========================================

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from backend.database import get_db

from backend.models.asset import Asset

from backend.services.qr_service import generate_qr

# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/api/qr",
    tags=["QR"]
)

# ==========================================
# GENERATE QR
# ==========================================

@router.post("/generate/{asset_id}")
def generate_asset_qr(asset_id: int, db: Session = Depends(get_db)):

    asset = db.query(Asset).filter(
        Asset.id == asset_id
    ).first()

    if not asset:
        raise HTTPException(
            status_code=404,
            detail="Asset not found"
        )

    qr_path = generate_qr(asset.asset_code)

    asset.qr_generated = True

    asset.qr_code = qr_path

    db.commit()

    return {

        "success": True,

        "asset_id": asset.id,

        "asset_code": asset.asset_code,

        "equipment_name": asset.equipment_name,

        "qr_url": qr_path

    }