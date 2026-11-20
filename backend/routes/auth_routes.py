from datetime import datetime, timedelta
from secrets import token_urlsafe

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from backend.auth import (
    JWT_EXPIRY_MINUTES,
    create_access_token,
    create_csrf_token,
    csrf_cookie_name,
    cookie_secure,
    decode_session_token,
    get_current_user,
    session_cookie_name,
)
from backend.database import get_db
from backend.models.auth_session import AuthSession
from backend.models.user import User
from backend.services.security_service import (
    account_lock_until,
    clear_login_failures,
    client_ip,
    decrypt_mfa_secret,
    encrypt_mfa_secret,
    enforce_ip_login_limit,
    generate_mfa_secret,
    provisioning_details,
    record_security_event,
    register_login_failure,
    role_requires_mfa,
    verify_totp,
)


router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=72)
    mfa_code: str = Field(default="", max_length=20)


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


def _set_cookie(response: Response, key: str, value: str, *, httponly: bool) -> None:
    response.set_cookie(
        key=key,
        value=value,
        httponly=httponly,
        secure=cookie_secure(),
        samesite="strict",
        max_age=JWT_EXPIRY_MINUTES * 60,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    for key in {session_cookie_name(), csrf_cookie_name(), "access_token", "biotrack_csrf"}:
        response.delete_cookie(key=key, path="/", secure=cookie_secure(), samesite="strict")


def _password_matches(user: User | None, password: str) -> bool:
    if not user:
        # Keep unknown-user and wrong-password paths closer in execution cost.
        bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10))
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8"))
    except (TypeError, ValueError):
        return False


def _register_account_failure(user: User | None) -> None:
    if not user:
        return
    user.failed_login_attempts = int(user.failed_login_attempts or 0) + 1
    user.locked_until = account_lock_until(user.failed_login_attempts)


def _generic_login_failure() -> HTTPException:
    return HTTPException(status_code=401, detail="Invalid username, password, or verification code.")


@router.post("/api/auth/login")
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    ip_address = client_ip(request)
    enforce_ip_login_limit(ip_address)
    username = payload.username.strip().casefold()
    user = db.query(User).filter(User.username.ilike(username)).first()
    now = datetime.utcnow()

    if user and user.locked_until and user.locked_until > now:
        _password_matches(user, payload.password)
        register_login_failure(ip_address)
        record_security_event(
            db, "authentication.login", "blocked", request=request,
            actor_user_id=user.id, actor_username=user.username,
            details={"reason": "account_locked"},
        )
        raise _generic_login_failure()

    if not user or not user.is_active or not _password_matches(user, payload.password):
        register_login_failure(ip_address)
        _register_account_failure(user)
        record_security_event(
            db, "authentication.login", "failure", request=request,
            actor_user_id=user.id if user else None, actor_username=username,
            details={"reason": "invalid_credentials"},
        )
        raise _generic_login_failure()

    mfa_was_enrolled = False
    if role_requires_mfa(user.role):
        encrypted_secret = user.mfa_secret if user.mfa_enabled else user.mfa_pending_secret
        if not encrypted_secret:
            secret = generate_mfa_secret()
            user.mfa_pending_secret = encrypt_mfa_secret(secret)
            db.commit()
        else:
            try:
                secret = decrypt_mfa_secret(encrypted_secret)
            except ValueError:
                record_security_event(
                    db, "authentication.mfa", "failure", request=request,
                    actor_user_id=user.id, actor_username=user.username,
                    details={"reason": "configuration_unreadable"},
                )
                raise HTTPException(status_code=503, detail="MFA configuration requires administrator recovery.")

        if not payload.mfa_code:
            response.status_code = status.HTTP_202_ACCEPTED
            if user.mfa_enabled:
                return {"success": False, "mfa_required": True, "message": "Enter your authenticator code."}
            return {
                "success": False,
                "mfa_enrollment_required": True,
                "message": "Set up your authenticator to continue.",
                **provisioning_details(user.username, secret),
            }

        if not verify_totp(secret, payload.mfa_code):
            register_login_failure(ip_address)
            _register_account_failure(user)
            record_security_event(
                db, "authentication.mfa", "failure", request=request,
                actor_user_id=user.id, actor_username=user.username,
                details={"reason": "invalid_totp"},
            )
            raise _generic_login_failure()

        if not user.mfa_enabled:
            user.mfa_secret = user.mfa_pending_secret
            user.mfa_pending_secret = None
            user.mfa_enabled = True
            mfa_was_enrolled = True

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    token_id = token_urlsafe(32)
    db.add(AuthSession(
        token_id=token_id, user_id=user.id, created_at=now, last_seen_at=now,
        expires_at=now + timedelta(minutes=JWT_EXPIRY_MINUTES),
        ip_address=ip_address, user_agent=request.headers.get("user-agent", "")[:500],
    ))
    record_security_event(
        db, "authentication.login", "success", request=request,
        actor_user_id=user.id, actor_username=user.username,
        details={"mfa": bool(user.mfa_enabled), "mfa_enrolled": mfa_was_enrolled},
        commit=False,
    )
    db.commit()
    clear_login_failures(ip_address)

    access_token = create_access_token(user, token_id)
    _set_cookie(response, session_cookie_name(), access_token, httponly=True)
    _set_cookie(response, csrf_cookie_name(), create_csrf_token(token_id), httponly=False)
    if session_cookie_name() != "access_token":
        response.delete_cookie("access_token", path="/")
    return {
        "success": True, "username": user.username, "name": user.name,
        "role": user.role.lower(), "department": user.department,
        "mfa_enabled": bool(user.mfa_enabled), "redirect": "/dashboard_v2",
    }


@router.post("/api/auth/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not bcrypt.checkpw(payload.current_password.encode("utf-8"), current_user.password_hash.encode("utf-8")):
        record_security_event(
            db, "account.password_change", "failure", request=request,
            actor_user_id=current_user.id, actor_username=current_user.username,
            details={"reason": "current_password_incorrect"},
        )
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if bcrypt.checkpw(payload.new_password.encode("utf-8"), current_user.password_hash.encode("utf-8")):
        raise HTTPException(status_code=400, detail="Choose a password you have not used for this account.")

    current_user.password_hash = bcrypt.hashpw(payload.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    current_user.password_changed_at = datetime.utcnow()
    db.query(AuthSession).filter(
        AuthSession.user_id == current_user.id, AuthSession.revoked_at.is_(None),
    ).update({AuthSession.revoked_at: datetime.utcnow()}, synchronize_session=False)
    record_security_event(
        db, "account.password_change", "success", request=request,
        actor_user_id=current_user.id, actor_username=current_user.username, commit=False,
    )
    db.commit()
    _clear_auth_cookies(response)
    return {"success": True, "message": "Password changed. Sign in again.", "reauthenticate": True}


@router.get("/api/auth/me")
def current_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id, "username": current_user.username,
        "name": current_user.name or current_user.username,
        "email": current_user.email or "", "phone": current_user.phone or "",
        "department": current_user.department or "", "role": current_user.role,
        "mfa_enabled": bool(current_user.mfa_enabled),
    }


@router.patch("/api/auth/profile")
def update_current_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.name = payload.name
    current_user.email = str(payload.email)
    current_user.phone = payload.phone
    record_security_event(
        db, "account.profile_update", "success", request=request,
        actor_user_id=current_user.id, actor_username=current_user.username, commit=False,
    )
    db.commit()
    return {"success": True, "name": current_user.name, "email": current_user.email, "phone": current_user.phone}


@router.post("/api/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(session_cookie_name()) or request.cookies.get("access_token")
    claims = decode_session_token(token)
    if claims and claims.get("sid"):
        session = db.query(AuthSession).filter(AuthSession.token_id == str(claims["sid"])).first()
        if session and session.revoked_at is None:
            session.revoked_at = datetime.utcnow()
            record_security_event(
                db, "authentication.logout", "success", request=request,
                actor_user_id=session.user_id, target_type="session", target_id=session.token_id,
                commit=False,
            )
            db.commit()
    _clear_auth_cookies(response)
    response.headers["Clear-Site-Data"] = '"cache"'
    return {"success": True, "message": "Logged out successfully."}
