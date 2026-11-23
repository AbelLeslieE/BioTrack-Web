"""Native fixed-asset accounting linked one-to-one with BioTrack equipment."""

import calendar
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request as WebRequest
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_roles
from backend.database import get_db
from backend.models.accounting import (
    FinanceAccount, FinanceAssetCategory, FinanceAssetRecord, FinanceCompany,
    FinanceDepreciationSchedule, FinanceJournalEntry,
)
from backend.models.asset import Asset
from backend.models.user import User
from backend.schemas.accounting_schema import AssetCapitalizationInput, AssetCategoryInput
from backend.services.accounting_posting_service import AccountingPostingError, _post
from backend.services.accounting_service import money
from backend.services.security_service import record_security_event


router = APIRouter(prefix="/api/finance/assets", tags=["native-asset-accounting"], dependencies=[Depends(require_roles("Business", "Manager"))])


def _add_months(value: date, months: int) -> date:
    index = value.month - 1 + months
    year = value.year + index // 12
    month = index % 12 + 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))


def _asset_row(row, asset=None, category=None):
    return {
        "id": row.id, "company_id": row.company_id, "category_id": row.category_id,
        "biotrack_asset_id": row.biotrack_asset_id, "asset_number": row.asset_number,
        "asset_code": asset.asset_code if asset else "", "equipment_name": asset.equipment_name if asset else "",
        "department": asset.department if asset else "", "category_name": category.category_name if category else "",
        "capitalization_date": row.capitalization_date.isoformat(), "available_for_use_date": row.available_for_use_date.isoformat(),
        "gross_cost": money(row.gross_cost), "salvage_value": money(row.salvage_value),
        "depreciation_method": row.depreciation_method, "useful_life_months": row.useful_life_months,
        "annual_rate": row.annual_rate, "accumulated_depreciation": money(row.accumulated_depreciation),
        "net_book_value": money(row.net_book_value), "status": row.status, "notes": row.notes,
    }


@router.get("/dashboard")
def asset_accounting_dashboard(db: Session = Depends(get_db)):
    categories = db.query(FinanceAssetCategory).order_by(FinanceAssetCategory.category_name).all()
    records = db.query(FinanceAssetRecord).order_by(FinanceAssetRecord.asset_number).all()
    assets = {row.id: row for row in db.query(Asset).filter(Asset.id.in_([item.biotrack_asset_id for item in records])).all()} if records else {}
    category_map = {row.id: row for row in categories}
    schedules = db.query(FinanceDepreciationSchedule).order_by(FinanceDepreciationSchedule.schedule_date, FinanceDepreciationSchedule.id).all()
    linked_ids = {row.biotrack_asset_id for row in records}
    available_assets = db.query(Asset).filter(Asset.status != "Disposed").order_by(Asset.asset_code).all()
    return {
        "summary": {
            "capitalized_assets": len(records),
            "gross_cost": money(sum((money(row.gross_cost) for row in records if row.status != "Disposed"), Decimal("0"))),
            "accumulated_depreciation": money(sum((money(row.accumulated_depreciation) for row in records), Decimal("0"))),
            "net_book_value": money(sum((money(row.net_book_value) for row in records if row.status != "Disposed"), Decimal("0"))),
            "depreciation_due": sum(row.status == "Planned" and row.schedule_date <= date.today() for row in schedules),
        },
        "categories": [{
            "id": row.id, "company_id": row.company_id, "category_code": row.category_code,
            "category_name": row.category_name, "fixed_asset_account_id": row.fixed_asset_account_id,
            "accumulated_depreciation_account_id": row.accumulated_depreciation_account_id,
            "depreciation_expense_account_id": row.depreciation_expense_account_id,
            "default_method": row.default_method, "default_useful_life_months": row.default_useful_life_months,
            "default_annual_rate": row.default_annual_rate, "status": row.status,
        } for row in categories],
        "assets": [_asset_row(row, assets.get(row.biotrack_asset_id), category_map.get(row.category_id)) for row in records],
        "schedules": [{
            "id": row.id, "finance_asset_id": row.finance_asset_id, "schedule_number": row.schedule_number,
            "schedule_date": row.schedule_date.isoformat(), "depreciation_amount": money(row.depreciation_amount),
            "accumulated_depreciation": money(row.accumulated_depreciation), "book_value_after": money(row.book_value_after),
            "status": row.status, "journal_entry_id": row.journal_entry_id,
        } for row in schedules],
        "available_assets": [{
            "id": row.id, "asset_code": row.asset_code, "equipment_name": row.equipment_name,
            "department": row.department, "purchase_value": money(row.purchase_value),
            "purchase_date": row.purchase_date.isoformat() if row.purchase_date else None,
        } for row in available_assets if row.id not in linked_ids],
    }


@router.post("/categories", dependencies=[Depends(require_roles("Manager"))])
def create_asset_category(data: AssetCategoryInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    company = db.get(FinanceCompany, data.company_id)
    account_ids = {data.fixed_asset_account_id, data.accumulated_depreciation_account_id, data.depreciation_expense_account_id}
    accounts = db.query(FinanceAccount).filter(FinanceAccount.id.in_(account_ids), FinanceAccount.company_id == data.company_id).all()
    if not company or len(accounts) != len(account_ids):
        raise HTTPException(status_code=422, detail="All asset-category accounts must belong to the selected company.")
    row = FinanceAssetCategory(**data.model_dump(), created_by=current_user.username)
    db.add(row)
    try: db.flush()
    except IntegrityError as exc:
        db.rollback(); raise HTTPException(status_code=409, detail="That asset category code already exists.") from exc
    record_security_event(db, "finance.asset_category.created", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_asset_category", target_id=row.category_code, commit=False)
    db.commit(); db.refresh(row)
    return {"id": row.id, "category_code": row.category_code, "category_name": row.category_name}


@router.post("/capitalize", dependencies=[Depends(require_roles("Manager"))])
def capitalize_asset(data: AssetCapitalizationInput, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    company, category, asset = db.get(FinanceCompany, data.company_id), db.get(FinanceAssetCategory, data.category_id), db.get(Asset, data.biotrack_asset_id)
    if not company or not category or category.company_id != data.company_id or not asset:
        raise HTTPException(status_code=422, detail="Select a valid company, asset category and BioTrack equipment record.")
    if db.query(FinanceAssetRecord).filter(FinanceAssetRecord.biotrack_asset_id == asset.id).first():
        raise HTTPException(status_code=409, detail="This BioTrack asset is already capitalized.")
    row = FinanceAssetRecord(
        **data.model_dump(exclude={"opening_balance_posting"}), asset_number=f"PENDING-{uuid4().hex}",
        net_book_value=money(data.gross_cost), created_by=current_user.username,
    )
    db.add(row); db.flush(); row.asset_number = f"FA-{row.id:05d}"
    depreciable = money(data.gross_cost - data.salvage_value)
    accumulated, book = Decimal("0.00"), money(data.gross_cost)
    for number in range(1, data.useful_life_months + 1):
        if data.depreciation_method == "Straight Line":
            amount = money(depreciable / data.useful_life_months) if number < data.useful_life_months else money(depreciable - accumulated)
        else:
            amount = money(book * data.annual_rate / Decimal("1200"))
            amount = min(amount, money(book - data.salvage_value))
        accumulated = money(accumulated + amount); book = money(book - amount)
        db.add(FinanceDepreciationSchedule(finance_asset_id=row.id, schedule_number=number, schedule_date=_add_months(data.available_for_use_date, number), depreciation_amount=amount, accumulated_depreciation=accumulated, book_value_after=book))
    if data.opening_balance_posting:
        general_fund = db.query(FinanceAccount).filter(FinanceAccount.company_id == company.id, FinanceAccount.system_key == "GENERAL_FUND").first()
        if not general_fund: raise HTTPException(status_code=409, detail="Initialize the General Fund account before opening capitalization.")
        try:
            journal = _post(db, company=company, entry_date=data.capitalization_date, entry_type="Opening", narration=f"Opening capitalization {row.asset_number} · {asset.equipment_name}", source_type="asset_capitalization", source_id=row.id, actor=current_user.username, approved_by=current_user.username, lines=[{"account_id": category.fixed_asset_account_id, "debit": data.gross_cost}, {"account_id": general_fund.id, "credit": data.gross_cost}])
        except AccountingPostingError as exc: raise HTTPException(status_code=409, detail=str(exc)) from exc
        row.capitalization_journal_id = journal.id
    record_security_event(db, "finance.asset.capitalized", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_asset", target_id=row.asset_number, details={"biotrack_asset": asset.asset_code, "gross_cost": data.gross_cost}, commit=False)
    db.commit(); db.refresh(row)
    return _asset_row(row, asset, category)


@router.post("/depreciation/{schedule_id}/post", dependencies=[Depends(require_roles("Manager"))])
def post_depreciation(schedule_id: int, request: WebRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    schedule = db.get(FinanceDepreciationSchedule, schedule_id)
    if not schedule or schedule.status != "Planned": raise HTTPException(status_code=409, detail="Only a planned depreciation row can be posted.")
    record = db.get(FinanceAssetRecord, schedule.finance_asset_id); category = db.get(FinanceAssetCategory, record.category_id); company = db.get(FinanceCompany, record.company_id)
    prior = db.query(FinanceDepreciationSchedule).filter(FinanceDepreciationSchedule.finance_asset_id == record.id, FinanceDepreciationSchedule.schedule_number < schedule.schedule_number, FinanceDepreciationSchedule.status != "Posted").first()
    if prior: raise HTTPException(status_code=409, detail="Post earlier depreciation schedule rows first.")
    try:
        journal = _post(db, company=company, entry_date=schedule.schedule_date, entry_type="Adjustment", narration=f"Depreciation {record.asset_number} period {schedule.schedule_number}", source_type="asset_depreciation", source_id=schedule.id, actor=current_user.username, approved_by=current_user.username, lines=[{"account_id": category.depreciation_expense_account_id, "debit": schedule.depreciation_amount}, {"account_id": category.accumulated_depreciation_account_id, "credit": schedule.depreciation_amount}])
    except AccountingPostingError as exc: raise HTTPException(status_code=409, detail=str(exc)) from exc
    schedule.status = "Posted"; schedule.journal_entry_id = journal.id; schedule.posted_by = current_user.username; schedule.posted_at = datetime.now()
    record.accumulated_depreciation = schedule.accumulated_depreciation; record.net_book_value = schedule.book_value_after
    if money(record.net_book_value) <= money(record.salvage_value): record.status = "Fully Depreciated"
    record_security_event(db, "finance.asset.depreciation_posted", "success", request=request, actor_user_id=current_user.id, actor_username=current_user.username, target_type="finance_asset", target_id=record.asset_number, details={"schedule": schedule.schedule_number, "amount": schedule.depreciation_amount}, commit=False)
    db.commit()
    return {"id": schedule.id, "status": schedule.status, "journal_entry_id": journal.id, "net_book_value": money(record.net_book_value)}
