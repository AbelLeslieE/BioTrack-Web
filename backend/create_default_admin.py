# ==========================================
# IMPORTS
# ==========================================

import os

from sqlalchemy.orm import Session
import bcrypt

from backend.database import SessionLocal
from backend.models.user import User


# ==========================================
# CREATE DEFAULT ADMIN
# ==========================================

def create_default_admin():

    username = os.getenv("BOOTSTRAP_ADMIN_USERNAME")
    password_value = os.getenv("BOOTSTRAP_ADMIN_PASSWORD")

    if not username or not password_value:
        print("No bootstrap administrator configured; skipping default-admin creation.")
        return

    if len(password_value) < 12:
        raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters.")

    db: Session = SessionLocal()

    try:

        existing = db.query(User).first()

        if existing:
            print("Users already exist.")
            return

        password = bcrypt.hashpw(
            password_value.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        admin = User(

            username=username.strip().lower(),

            password_hash=password,

            name="System Administrator",

            department="Biomedical",

            email="admin@biotrack.local",

            phone="",

            role="Manager"

        )

        db.add(admin)

        db.commit()

        print("Default admin created.")

    finally:

        db.close()
        
