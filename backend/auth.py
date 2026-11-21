"""Authentication and authorization helpers for BioTrack's API."""

import os
import hashlib
import hmac
from secrets import token_urlsafe
from datetime import datetime, timedelta, timezone
from typing import Callable

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt.exceptions import PyJWTError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.auth_session import AuthSession
from backend.models.user import User


load_dotenv()

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = int(os.getenv("JWT_EXPIRY_MINUTES", "480"))
SESSION_IDLE_MINUTES = int(os.getenv("SESSION_IDLE_MINUTES", "30"))
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
    environment = os.getenv("ENVIRONMENT", "development").casefold()
    if environment in {"production", "prod"}:
        if not cookie_secure():
            raise RuntimeError("COOKIE_SECURE must be true in production.")
        public_origin = os.getenv("PUBLIC_ORIGIN", "")
        if not public_origin.startswith("https://"):
            raise RuntimeError("PUBLIC_ORIGIN must be an https:// URL in production.")
        if not os.getenv("ALLOWED_HOSTS", "").strip():
            raise RuntimeError("ALLOWED_HOSTS must be configured in production.")


def cookie_secure() -> bool:
    return os.getenv("COOKIE_SECURE", "false").casefold() == "true"


def session_cookie_name() -> str:
    return "__Host-biotrack_session" if cookie_secure() else "access_token"


def csrf_cookie_name() -> str:
    return "__Host-biotrack_csrf" if cookie_secure() else "biotrack_csrf"


def create_csrf_token(token_id: str) -> str:
    nonce = token_urlsafe(24)
    signature = hmac.new(
        _jwt_secret().encode("utf-8"),
        f"{token_id}.{nonce}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{nonce}.{signature}"


def verify_csrf_token(token_id: str, token: str) -> bool:
    try:
        nonce, supplied = token.split(".", 1)
    except ValueError:
        return False
    expected = hmac.new(
        _jwt_secret().encode("utf-8"),
        f"{token_id}.{nonce}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, supplied)


def create_access_token(user: User, token_id: str | None = None) -> str:
    """Create a signed token tied to a revocable server-side session."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "sid": token_id or token_urlsafe(32),
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_session_token(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except PyJWTError:
        return None


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials if credentials else (
        request.cookies.get(session_cookie_name())
        or request.cookies.get("access_token")
    )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub", ""))
        token_id = str(payload.get("sid", ""))
        if not token_id:
            raise ValueError("Session identifier missing")
    except (PyJWTError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session = db.query(AuthSession).filter(
        AuthSession.token_id == token_id,
        AuthSession.user_id == user_id,
    ).first()
    now = datetime.utcnow()
    idle_cutoff = now - timedelta(minutes=SESSION_IDLE_MINUTES)
    if (
        not session
        or session.revoked_at is not None
        or session.expires_at <= now
        or session.last_seen_at <= idle_cutoff
    ):
        if session and session.revoked_at is None:
            session.revoked_at = now
            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your session has expired.")

    user = db.get(User, user_id)
    if not user or not user.is_active:
        session.revoked_at = now
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    if session.last_seen_at <= now - timedelta(seconds=60):
        session.last_seen_at = now
        db.commit()
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
