"""Authentication and authorization helpers for BioTrack's API."""

import os
from datetime import datetime, timedelta, timezone
from typing import Callable

from dotenv import load_dotenv
from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User


load_dotenv()

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = int(os.getenv("JWT_EXPIRY_MINUTES", "480"))
_bearer_scheme = HTTPBearer(auto_error=False)


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY")
    if (
        not secret
        or len(secret) < 32
        or secret.startswith("replace-with-")
    ):
        raise RuntimeError(
            "JWT_SECRET_KEY must be configured with a unique value of at least 32 characters."
        )
    return secret


def validate_auth_config() -> None:
    """Fail fast at startup rather than running an API with an unusable auth setup."""
    _jwt_secret()


def create_access_token(user: User) -> str:
    """Create a short-lived token; the database remains the source of truth for roles."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials if credentials else access_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub", ""))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user


def require_roles(*roles: str) -> Callable:
    allowed_roles = {role.casefold() for role in roles}

    def validate_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.casefold() not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return validate_role
