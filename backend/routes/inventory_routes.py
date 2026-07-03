# ==========================================
# IMPORTS
# ==========================================

from fastapi import (
    APIRouter,
    Depends,
    Body,
    HTTPException
)

from sqlalchemy.orm import Session

from backend.database import get_db

from backend.models.inventory import Inventory
from fastapi import UploadFile, File

from backend.services.inventory_excel_service import import_inventory_excel
# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/api/inventory",
    tags=["Inventory"]
)
# ==========================================
# GET INVENTORY
# ==========================================

@router.get("/")
def get_inventory(
    db: Session = Depends(get_db)
):

    items = (
        db.query(Inventory)
        .order_by(Inventory.item_name)
        .all()
    )

    return [

        {

            "id": item.id,

            "bpk_number": item.bpk_number,

            "item_name": item.item_name,

            "category": item.category,

            "manufacturer": item.manufacturer,

            "supplier": item.supplier,

            "unit": item.unit,

            "current_stock": item.current_stock,

            "minimum_stock": item.minimum_stock,

            "maximum_stock": item.maximum_stock,

            "location": item.location,

            "rack": item.rack,

            "batch_number": item.batch_number,

            "purchase_price": item.purchase_price,

            "remarks": item.remarks,

            "status": (

                "Out of Stock"

                if item.current_stock == 0

                else

                "Low Stock"

                if item.current_stock <= item.minimum_stock

                else

                "Available"

            )

        }

        for item in items

    ]
# ==========================================
# CREATE INVENTORY ITEM
# ==========================================

@router.post("/")
def create_inventory_item(

    data: dict = Body(...),

    db: Session = Depends(get_db)

):

    item = Inventory(

        bpk_number=data.get("bpk_number"),

        item_name=data.get("item_name"),

        category=data.get("category"),

        manufacturer=data.get("manufacturer"),

        supplier=data.get("supplier"),

        unit=data.get("unit"),

        current_stock=data.get("current_stock",0),

        minimum_stock=data.get("minimum_stock",5),

        maximum_stock=data.get("maximum_stock",100),

        location=data.get("location"),

        rack=data.get("rack"),

        batch_number=data.get("batch_number"),

        purchase_price=data.get("purchase_price",0),

        remarks=data.get("remarks")

    )

    db.add(item)

    db.commit()

    db.refresh(item)

    return {

        "success":True,

        "id":item.id

    }
# ==========================================
# UPDATE INVENTORY ITEM
# ==========================================

@router.put("/{item_id}")
def update_inventory_item(
    item_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db)
):

    item = (
        db.query(Inventory)
        .filter(Inventory.id == item_id)
        .first()
    )

    if not item:

        raise HTTPException(
            status_code=404,
            detail="Inventory item not found"
        )

    item.bpk_number = data.get("bpk_number")
    item.item_name = data.get("item_name")
    item.category = data.get("category")
    item.manufacturer = data.get("manufacturer")
    item.supplier = data.get("supplier")
    item.unit = data.get("unit")

    item.current_stock = data.get("current_stock", 0)
    item.minimum_stock = data.get("minimum_stock", 5)
    item.maximum_stock = data.get("maximum_stock", 100)

    item.location = data.get("location")
    item.rack = data.get("rack")
    item.batch_number = data.get("batch_number")
    item.purchase_price = data.get("purchase_price", 0)
    item.remarks = data.get("remarks")

    db.commit()

    return {
        "success": True
    }

# ==========================================
# DELETE INVENTORY ITEM
# ==========================================

@router.delete("/{item_id}")
def delete_inventory_item(
    item_id: int,
    db: Session = Depends(get_db)
):

    item = (
        db.query(Inventory)
        .filter(Inventory.id == item_id)
        .first()
    )

    if not item:

        raise HTTPException(
            status_code=404,
            detail="Inventory item not found"
        )

    db.delete(item)

    db.commit()

    return {

        "success": True

    }
# ==========================================
# INVENTORY STATISTICS
# ==========================================

@router.get("/stats")
def inventory_stats(
    db: Session = Depends(get_db)
):

    items = db.query(Inventory).all()

    total_items = len(items)

    low_stock = len([

        i for i in items

        if i.current_stock > 0
        and i.current_stock <= i.minimum_stock

    ])

    out_stock = len([

        i for i in items

        if i.current_stock == 0

    ])

    total_value = sum(

        (i.purchase_price or 0)
        *
        (i.current_stock or 0)

        for i in items

    )

    return {

        "total_items": total_items,

        "low_stock": low_stock,

        "out_stock": out_stock,

        "total_value": total_value

    }
# ==========================================
# IMPORT INVENTORY EXCEL
# ==========================================

@router.post("/upload")
async def upload_inventory_excel(

    file: UploadFile = File(...),

    db: Session = Depends(get_db)

):

    return import_inventory_excel(

        file.file,

        db

    )
    