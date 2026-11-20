"""Security primitives shared by authentication and audit-sensitive routes."""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import os
import secrets
import struct
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.models.security_audit import SecurityAudit


PRIVILEGED_MFA_ROLES = {
    role.strip().casefold()
    for role in os.getenv("MFA_REQUIRED_ROLES", "Manager,CentralStore").split(",")
    if role.strip()
}
LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_RATE_WINDOW_SECONDS", "900"))
LOGIN_MAX_ATTEMPTS_PER_IP = int(os.getenv("LOGIN_RATE_MAX_ATTEMPTS", "20"))

_attempts: dict[str, deque[float]] = defaultdict(deque)
_attempt_lock = threading.Lock()


def client_ip(request: Request) -> str:
    """Use the socket peer by default; trust proxy headers only when configured."""
    if os.getenv("TRUST_PROXY_HEADERS", "false").casefold() == "true":
        forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
        if forwarded:
            return forwarded[:64]
    return (request.client.host if request.client else "unknown")[:64]


def enforce_ip_login_limit(ip_address: str) -> None:
    now = time.monotonic()
    with _attempt_lock:
        attempts = _attempts[ip_address]
        while attempts and attempts[0] <= now - LOGIN_WINDOW_SECONDS:
            attempts.popleft()
        if len(attempts) >= LOGIN_MAX_ATTEMPTS_PER_IP:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many sign-in attempts. Try again later.",
                headers={"Retry-After": str(LOGIN_WINDOW_SECONDS)},
            )


def register_login_failure(ip_address: str) -> None:
    with _attempt_lock:
        _attempts[ip_address].append(time.monotonic())


def clear_login_failures(ip_address: str) -> None:
    with _attempt_lock:
        _attempts.pop(ip_address, None)


def role_requires_mfa(role: str | None) -> bool:
    return (role or "").casefold() in PRIVILEGED_MFA_ROLES


def _fernet() -> Fernet:
    configured = os.getenv("MFA_ENCRYPTION_KEY", "").strip()
    if configured:
        try:
            return Fernet(configured.encode("ascii"))
        except (ValueError, TypeError) as exc:
            raise RuntimeError("MFA_ENCRYPTION_KEY must be a valid Fernet key.") from exc

    jwt_secret = os.getenv("JWT_SECRET_KEY", "")
    if len(jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET_KEY must be configured before MFA can be used.")
    derived = hashlib.sha256(f"biotrack-mfa|{jwt_secret}".encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_mfa_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode("ascii")).decode("ascii")


def decrypt_mfa_secret(encrypted: str | None) -> str:
    if not encrypted:
        raise ValueError("MFA is not configured for this account.")
    try:
        return _fernet().decrypt(encrypted.encode("ascii")).decode("ascii")
    except (InvalidToken, ValueError) as exc:
        raise ValueError("The stored MFA configuration could not be decrypted.") from exc


def generate_mfa_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def verify_totp(secret: str, code: str, *, at_time: int | None = None) -> bool:
    normalized = "".join(character for character in str(code or "") if character.isdigit())
    if len(normalized) != 6:
        return False
    current = int(at_time if at_time is not None else time.time()) // 30
    padded = secret + "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(padded, casefold=True)
    for offset in (-1, 0, 1):
        digest = hmac.new(key, struct.pack(">Q", current + offset), hashlib.sha1).digest()
        index = digest[-1] & 0x0F
        value = (struct.unpack(">I", digest[index:index + 4])[0] & 0x7FFFFFFF) % 1_000_000
        if hmac.compare_digest(f"{value:06d}", normalized):
            return True
    return False


def provisioning_details(username: str, secret: str) -> dict[str, str]:
    issuer = os.getenv("MFA_ISSUER", "BioTrack")
    label = quote(f"{issuer}:{username}")
    uri = f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&digits=6&period=30"
    try:
        import qrcode

        image = qrcode.make(uri)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        qr_data = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    except Exception:
        qr_data = ""
    return {"secret": secret, "provisioning_uri": uri, "qr_data_url": qr_data}


def account_lock_until(failed_attempts: int) -> datetime | None:
    if failed_attempts < 5:
        return None
    minutes = min(60, 5 * (2 ** min(3, failed_attempts - 5)))
    return datetime.utcnow() + timedelta(minutes=minutes)


def record_security_event(
    db: Session,
    event_type: str,
    outcome: str,
    *,
    request: Request | None = None,
    actor_user_id: int | None = None,
    actor_username: str | None = None,
    target_type: str | None = None,
    target_id: str | int | None = None,
    details: dict | None = None,
    commit: bool = True,
) -> SecurityAudit:
    event = SecurityAudit(
        event_type=event_type[:80],
        outcome=outcome[:20],
        actor_user_id=actor_user_id,
        actor_username=(actor_username or "")[:80] or None,
        target_type=(target_type or "")[:80] or None,
        target_id=str(target_id)[:120] if target_id is not None else None,
        ip_address=client_ip(request) if request else None,
        user_agent=request.headers.get("user-agent", "")[:500] if request else None,
        request_id=getattr(request.state, "request_id", None) if request else None,
        details=json.dumps(details or {}, separators=(",", ":"), default=str)[:4000],
    )
    db.add(event)
    if commit:
        db.commit()
    return event
