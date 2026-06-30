
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.services.auth_service import authenticate_user

router = APIRouter(prefix='/api/auth', tags=['auth'])

class LoginRequest(BaseModel):
    username:str
    password:str

@router.post('/login')
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    return {
        "success": True,
        "username": user.username,
        "name": user.name,
        "role": user.role.lower(),
        "department": user.department,
        "redirect": "/dashboard_v2"
    }
@router.post("/api/logout")
def logout():
    return {
        "success": True,
        "message": "Logged out successfully."
    }