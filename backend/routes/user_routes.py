from fastapi import APIRouter, Depends, Request as WebRequest
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from datetime import datetime
import bcrypt
from fastapi import HTTPException
from backend.models import Request
from backend.auth import require_roles
from backend.auth import get_current_user
from backend.models.auth_session import AuthSession
from backend.services.security_service import record_security_event
router=APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(require_roles("Manager"))],
)

ALLOWED_ROLES = {"Manager", "BME", "Electrical", "IT", "User", "WardBoy", "CentralStore"}

class UserFields(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    department: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=30)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=30)
    username: str = Field(min_length=3, max_length=80)
    is_active: bool = True

    @field_validator("name", "department", "role", "phone", "username")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Field cannot be blank.")
        return value

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.casefold()


class UserCreate(UserFields):
    password: str = Field(min_length=12, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password cannot be blank.")
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be no more than 72 UTF-8 bytes.")
        return value

@router.get("")
def get_users(db:Session=Depends(get_db)):
    users=db.query(User).all()
    return [{
        "id":u.id,
        "name":u.name,
        "department":u.department,
        "role":u.role,
        "email":u.email,
        "phone":u.phone,
        "username":u.username,
        "is_active": bool(u.is_active),
        "mfa_enabled": bool(u.mfa_enabled),
        "locked_until": u.locked_until,
    } for u in users]

@router.post("/register")
def register(
    data:UserCreate,
    request: WebRequest,
    db:Session=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=422, detail="Invalid user role")
    existing=db.query(User).filter(User.username==data.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    hashed=bcrypt.hashpw(
        data.password.encode(),
        bcrypt.gensalt()
    ).decode()

    user=User(
        name=data.name,
        department=data.department,
        email=data.email,
        role=data.role,
        phone=data.phone,
        username=data.username,
        password_hash=hashed,
        created_at=datetime.now(),
        is_active=data.is_active,
    )

    db.add(user)
    record_security_event(
        db, "account.created", "success", request=request,
        actor_user_id=current_user.id, actor_username=current_user.username,
        target_type="user", target_id=user.username,
        details={"role": user.role, "department": user.department}, commit=False,
    )
    db.commit()
    db.refresh(user)

    return {"success":True,"message":"User registered successfully"}



class UserUpdate(UserFields):
    password: str = Field(default="", max_length=72)
    reset_mfa: bool = False

    @field_validator("password")
    @classmethod
    def validate_optional_password(cls, value: str) -> str:
        if value and (len(value) < 12 or not value.strip()):
            raise ValueError("Password must contain at least 12 characters and cannot be blank.")
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be no more than 72 UTF-8 bytes.")
        return value

@router.put("/{user_id}")
def update_user(
    user_id:int,
    data:UserUpdate,
    request: WebRequest,
    db:Session=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=422, detail="Invalid user role")
    user=db.query(User).filter(User.id==user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing=db.query(User).filter(
        User.username == data.username
    ).first()

    # ignore the same user's own username while editing
    if existing and existing.id == user_id:
        existing = None

    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    if user.role == "Manager" and user.is_active and (data.role != "Manager" or not data.is_active):
        manager_count = db.query(User).filter(User.role == "Manager", User.is_active.is_(True)).count()
        if manager_count <= 1:
            raise HTTPException(status_code=409, detail="The last active administrator cannot be demoted.")

    security_changed = user.role != data.role or bool(user.is_active) != bool(data.is_active) or bool(data.password)

    user.name=data.name
    user.department=data.department
    user.role=data.role
    user.email=data.email
    user.phone=data.phone
    user.username=data.username
    user.is_active=data.is_active

    if data.password:
        user.password_hash=bcrypt.hashpw(
            data.password.encode(),
            bcrypt.gensalt()
        ).decode()
        user.password_changed_at = datetime.utcnow()

    if data.reset_mfa:
        user.mfa_enabled = False
        user.mfa_secret = None
        user.mfa_pending_secret = None
        security_changed = True

    if security_changed:
        db.query(AuthSession).filter(
            AuthSession.user_id == user.id,
            AuthSession.revoked_at.is_(None),
        ).update({AuthSession.revoked_at: datetime.utcnow()}, synchronize_session=False)

    record_security_event(
        db, "account.updated", "success", request=request,
        actor_user_id=current_user.id, actor_username=current_user.username,
        target_type="user", target_id=user.id,
        details={"role": user.role, "active": bool(user.is_active), "mfa_reset": data.reset_mfa},
        commit=False,
    )
    db.commit()

    return {"success":True,"message":"User updated successfully"}

@router.delete("/{user_id}")
def delete_user(
    user_id:int,
    request: WebRequest,
    db:Session=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user=db.query(User).filter(User.id==user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=409, detail="You cannot delete your own signed-in account.")
    if user.role == "Manager" and user.is_active:
        manager_count = db.query(User).filter(User.role == "Manager", User.is_active.is_(True)).count()
        if manager_count <= 1:
            raise HTTPException(status_code=409, detail="The last active administrator cannot be deleted.")
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete(synchronize_session=False)
    record_security_event(
        db, "account.deleted", "success", request=request,
        actor_user_id=current_user.id, actor_username=current_user.username,
        target_type="user", target_id=user.id,
        details={"username": user.username, "role": user.role}, commit=False,
    )
    db.delete(user)
    db.commit()
    return {"success":True,"message":"User deleted"}

# ==========================================
# REQUEST DETAILS
# ==========================================

@router.get("/request/{ticket_number}")
def get_request_details(
    ticket_number: str,
    db: Session = Depends(get_db)
):

    request = (
        db.query(Request)
        .filter(Request.ticket_number == ticket_number)
        .first()
    )

    if not request:

        raise HTTPException(
            status_code=404,
            detail="Maintenance request not found."
        )

    return {

        "ticket": request.ticket_number,

        "equipment": request.equipment_name,

        "equipment_id": request.equipment_identifier,

        "department": request.department,

        "location": request.location,

        "reported_by": request.reported_by,

        "priority": request.priority,

        "status": request.status,

        "received": request.call_received_datetime,

        "started": request.engineer_start_datetime,

        "completed": request.fixed_datetime,

        "description": request.failure_description,

        "notes": request.engineer_notes,

        "work_done": request.work_done,

        "spare_parts": request.spare_parts,

        "downtime": request.final_downtime_hours

    }
