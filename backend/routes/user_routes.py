from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from datetime import datetime
import bcrypt

router=APIRouter(prefix="/api/users", tags=["users"])

class UserCreate(BaseModel):
    name:str
    department:str
    role:str
    email:str
    phone:str
    username:str
    password:str

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
    existing=db.query(User).filter(User.username==data.username.lower().strip()).first()
    if existing:
        return {"success":False,"message":"Username already exists"}

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
        username=data.username.lower().strip(),
        password_hash=hashed,
        created_at=datetime.now()
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {"success":True,"message":"User registered successfully"}



class UserUpdate(BaseModel):
    name:str
    department:str
    role:str
    email:str
    phone:str
    username:str
    password:str = ""

@router.put("/{user_id}")
def update_user(user_id:int, data:UserUpdate, db:Session=Depends(get_db)):
    user=db.query(User).filter(User.id==user_id).first()
    if not user:
        return {"success":False,"message":"User not found"}

    existing=db.query(User).filter(
        User.username == data.username.lower().strip()
    ).first()

    # ignore the same user's own username while editing
    if existing and existing.id == user_id:
        existing = None

    if existing:
        return {"success":False,"message":"Username already exists"}

    user.name=data.name
    user.department=data.department
    user.role=data.role
    user.email=data.email
    user.phone=data.phone
    user.username=data.username.lower().strip()

    if data.password.strip():
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
        return {"success":False,"message":"User not found"}
    db.delete(user)
    db.commit()
    return {"success":True,"message":"User deleted"}
