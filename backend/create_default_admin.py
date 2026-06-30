# ==========================================
# IMPORTS
# ==========================================

from sqlalchemy.orm import Session
import bcrypt

from backend.database import SessionLocal
from backend.models.user import User


# ==========================================
# CREATE DEFAULT ADMIN
# ==========================================

def create_default_admin():

    db: Session = SessionLocal()

    try:

        existing = db.query(User).first()

        if existing:
            print("Users already exist.")
            return

        password = bcrypt.hashpw(
            "admin123".encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        admin = User(

            username="admin",

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
        