from sqlalchemy.orm import Session
from backend.models.user import User
import bcrypt

def authenticate_user(db: Session, username: str, password: str):
    user = db.query(User).filter(
        User.username.ilike(username.strip())
    ).first()

    if not user:
        return None

    try:
        if bcrypt.checkpw(
            password.encode("utf-8"),
            user.password_hash.encode("utf-8")
        ):
            return user
    except Exception:
        return None

    return None
