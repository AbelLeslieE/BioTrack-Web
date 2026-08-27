
import os

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.services.auth_service import authenticate_user
from backend.auth import JWT_EXPIRY_MINUTES, create_access_token
from backend.auth import get_current_user
from backend.models.user import User
import bcrypt

router = APIRouter(tags=['auth'])

class LoginRequest(BaseModel):
    username:str
    password:str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=12, max_length=128)

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


@router.post("/api/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    return {
        "success": True,
        "message": "Logged out successfully."
    }
