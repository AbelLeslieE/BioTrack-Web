"""Browser-facing security headers and CSRF enforcement."""

from __future__ import annotations

import os
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, RedirectResponse

from backend.auth import (
    cookie_secure,
    csrf_cookie_name,
    decode_session_token,
    session_cookie_name,
    verify_csrf_token,
)


SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
CSRF_EXEMPT_PATHS = {"/api/auth/login", "/api/health"}


def _origin(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}".casefold()


def _trusted_origins(request: Request) -> set[str]:
    configured = {
        _origin(item.strip())
        for item in os.getenv("PUBLIC_ORIGIN", "").split(",")
        if item.strip()
    }
    request_origin = _origin(str(request.base_url))
    if request_origin:
        configured.add(request_origin)
    return {item for item in configured if item}


def _csrf_error(detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={"detail": detail},
        headers={"Cache-Control": "no-store"},
    )


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.request_id = request.headers.get("x-request-id", "")[:64] or uuid4().hex

        direct_dashboard_files = {
            "/static/dashboard.html": "/dashboard",
            "/static/biomedical_dashboard.html": "/dashboard",
            "/static/user_dashboard.html": "/dashboard",
            "/static/dashboard_v2/dashboard.html": "/dashboard",
            "/static/dashboard_v2/maintenance.html": "/maintenance",
            "/static/devices.html": "/devices",
        }
        if request.url.path in direct_dashboard_files:
            return RedirectResponse(direct_dashboard_files[request.url.path], status_code=307)

        if (
            request.url.path.startswith("/api/")
            and request.method.upper() not in SAFE_METHODS
            and request.url.path not in CSRF_EXEMPT_PATHS
        ):
            session_token = request.cookies.get(session_cookie_name()) or request.cookies.get("access_token")
            # Bearer-only API clients do not use ambient browser credentials and
            # therefore are not subject to cookie-based CSRF.
            if session_token:
                source = request.headers.get("origin") or request.headers.get("referer", "")
                if _origin(source) not in _trusted_origins(request):
                    return _csrf_error("The request origin could not be verified.")

                cookie_token = request.cookies.get(csrf_cookie_name()) or request.cookies.get("biotrack_csrf")
                header_token = request.headers.get("x-csrf-token", "")
                claims = decode_session_token(session_token)
                token_id = str((claims or {}).get("sid", ""))
                if (
                    not cookie_token
                    or not header_token
                    or cookie_token != header_token
                    or not token_id
                    or not verify_csrf_token(token_id, header_token)
                ):
                    return _csrf_error("CSRF validation failed. Refresh the page and try again.")

        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Permissions-Policy"] = (
            "camera=(self), microphone=(), geolocation=(), payment=(), usb=()"
        )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; "
            "manifest-src 'self'"
        )
        if cookie_secure():
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        if request.url.path.startswith("/api/") and request.url.path != "/api/health":
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
        return response
