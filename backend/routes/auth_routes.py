
import os

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.services.auth_service import authenticate_user
from backend.auth import JWT_EXPIRY_MINUTES, create_access_token
from backend.auth import get_current_user
from backend.models.user import User
import bcrypt

router = APIRouter(tags=['auth'])

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=72)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=12, max_length=72)

    @field_validator("new_password")
    @classmethod
    def reject_blank_password(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password cannot be blank.")
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be no more than 72 UTF-8 bytes.")
        return value


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(default="", max_length=30)

    @field_validator("name", "phone")
    @classmethod
    def trim_profile_fields(cls, value: str) -> str:
        return value.strip()

@router.post('/api/auth/login')
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    access_token = create_access_token(user)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").casefold() == "true",
        samesite="lax",
        max_age=JWT_EXPIRY_MINUTES * 60,
        path="/",
    )
    return {
        "success": True,
        "username": user.username,
        "name": user.name,
        "role": user.role.lower(),
        "department": user.department,
        "redirect": "/dashboard_v2"
    }


@router.post('/api/auth/change-password')
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not bcrypt.checkpw(
        payload.current_password.encode("utf-8"),
        current_user.password_hash.encode("utf-8"),
    ):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if bcrypt.checkpw(
        payload.new_password.encode("utf-8"),
        current_user.password_hash.encode("utf-8"),
    ):
        raise HTTPException(status_code=400, detail="Choose a password you have not used for this account.")

    current_user.password_hash = bcrypt.hashpw(
        payload.new_password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")
    db.commit()
    return {"success": True, "message": "Password changed successfully."}


@router.get('/api/auth/me')
def current_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "name": current_user.name or current_user.username,
        "email": current_user.email or "",
        "phone": current_user.phone or "",
        "department": current_user.department or "",
        "role": current_user.role,
    }


@router.patch('/api/auth/profile')
def update_current_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.name = payload.name
    current_user.email = str(payload.email)
    current_user.phone = payload.phone
    db.commit()
    return {
        "success": True,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
    }


@router.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    return {
        "success": True,
        "message": "Logged out successfully."
    }
