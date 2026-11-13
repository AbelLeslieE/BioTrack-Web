from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from datetime import datetime
import bcrypt
from fastapi import HTTPException
from backend.models import Request
from backend.auth import require_roles
router=APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(require_roles("Manager"))],
)

ALLOWED_ROLES = {"Manager", "BME", "Electrical", "IT", "User"}

class UserFields(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    department: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=30)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=30)
    username: str = Field(min_length=3, max_length=80)

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
        "username":u.username
    } for u in users]

@router.post("/register")
def register(data:UserCreate, db:Session=Depends(get_db)):
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
        created_at=datetime.now()
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {"success":True,"message":"User registered successfully"}



class UserUpdate(UserFields):
    password: str = Field(default="", max_length=72)

    @field_validator("password")
    @classmethod
    def validate_optional_password(cls, value: str) -> str:
        if value and (len(value) < 12 or not value.strip()):
            raise ValueError("Password must contain at least 12 characters and cannot be blank.")
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be no more than 72 UTF-8 bytes.")
        return value

@router.put("/{user_id}")
def update_user(user_id:int, data:UserUpdate, db:Session=Depends(get_db)):
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

    user.name=data.name
    user.department=data.department
    user.role=data.role
    user.email=data.email
    user.phone=data.phone
    user.username=data.username

    if data.password:
        user.password_hash=bcrypt.hashpw(
            data.password.encode(),
            bcrypt.gensalt()
        ).decode()

    db.commit()

    return {"success":True,"message":"User updated successfully"}

@router.delete("/{user_id}")
def delete_user(user_id:int, db:Session=Depends(get_db)):
    user=db.query(User).filter(User.id==user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
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
