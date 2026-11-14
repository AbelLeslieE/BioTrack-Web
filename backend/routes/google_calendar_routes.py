"""OAuth connection and one-way PM schedule sync for Google Calendar."""

import os
from datetime import date, timedelta
from urllib.parse import urlencode

import requests
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from backend.auth import _jwt_secret, get_current_user, require_roles
from backend.database import get_db
from backend.models.asset import Asset
from backend.models.google_calendar import GoogleCalendarConnection, GoogleCalendarEventLink
from backend.models.pm_schedule import PMSchedule
from backend.models.user import User
from backend.services.pm_service import update_all_pm_status


router = APIRouter(
    prefix="/api/google-calendar",
    tags=["Google Calendar"],
    dependencies=[Depends(require_roles("Manager", "BME"))],
)

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_API_BASE = "https://www.googleapis.com/calendar/v3"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
OAUTH_SCOPES = "openid email https://www.googleapis.com/auth/calendar.events"
OAUTH_STATE_MAX_AGE = 600


def _config() -> tuple[str, str, str, str] | None:
    values = (
        os.getenv("GOOGLE_CALENDAR_CLIENT_ID", "").strip(),
        os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET", "").strip(),
        os.getenv("GOOGLE_CALENDAR_REDIRECT_URI", "").strip(),
        os.getenv("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY", "").strip(),
    )
    if not all(values):
        return None
    try:
        Fernet(values[3].encode("ascii"))
    except (ValueError, UnicodeEncodeError):
        return None
    return values


def _fernet() -> Fernet:
    config = _config()
    if not config:
        raise HTTPException(status_code=503, detail="Google Calendar is not configured on the server.")
    try:
        return Fernet(config[3].encode("ascii"))
    except (ValueError, UnicodeEncodeError):
        raise HTTPException(status_code=503, detail="Google Calendar token encryption key is invalid.")


def _state_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(_jwt_secret(), salt="biotrack-google-calendar-oauth")


def _google_request(method: str, url: str, **kwargs) -> requests.Response:
    try:
        response = requests.request(method, url, timeout=20, **kwargs)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Could not reach Google Calendar. Please try again.") from exc
    return response


def _refresh_access_token(connection: GoogleCalendarConnection, db: Session) -> str:
    config = _config()
    if not config:
        raise HTTPException(status_code=503, detail="Google Calendar is not configured on the server.")
    try:
        refresh_token = _fernet().decrypt(connection.encrypted_refresh_token.encode()).decode()
    except (InvalidToken, UnicodeDecodeError):
        raise HTTPException(status_code=500, detail="Saved Google Calendar credentials could not be decrypted.")

    response = _google_request(
        "POST",
        GOOGLE_TOKEN_URL,
        data={
            "client_id": config[0],
            "client_secret": config[1],
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
    )
    if not response.ok:
        if response.status_code in (400, 401):
            raise HTTPException(status_code=409, detail="Google authorization expired. Reconnect your Google Calendar.")
        raise HTTPException(status_code=502, detail="Google could not refresh calendar access. Please try again.")
    token_data = response.json()
    if token_data.get("refresh_token"):
        connection.encrypted_refresh_token = _fernet().encrypt(token_data["refresh_token"].encode()).decode()
        db.commit()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=502, detail="Google returned no calendar access token.")
    return access_token


@router.get("/status")
def calendar_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = _config()
    connection = db.query(GoogleCalendarConnection).filter_by(user_id=current_user.id).first()
    return {
        "configured": bool(config),
        "connected": bool(connection),
        "email": connection.email if connection else None,
        "calendar": "primary" if connection else None,
    }


@router.get("/connect")
def connect_google_calendar(current_user: User = Depends(get_current_user)):
    config = _config()
    if not config:
        raise HTTPException(status_code=503, detail="Google Calendar setup is incomplete. Configure the Google OAuth environment variables.")
    state = _state_serializer().dumps({"user_id": current_user.id})
    params = {
        "client_id": config[0],
        "redirect_uri": config[2],
        "response_type": "code",
        "scope": OAUTH_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return RedirectResponse(f"{GOOGLE_AUTHORIZE_URL}?{urlencode(params)}", status_code=302)


@router.get("/callback", include_in_schema=False)
def google_calendar_callback(
    state: str = Query(...),
    code: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if error or not code:
        return RedirectResponse("/dashboard_v2?googleCalendar=cancelled", status_code=303)
    try:
        state_data = _state_serializer().loads(state, max_age=OAUTH_STATE_MAX_AGE)
    except SignatureExpired:
        raise HTTPException(status_code=400, detail="Google sign-in expired. Start the connection again.")
    except BadSignature:
        raise HTTPException(status_code=400, detail="Google sign-in could not be verified.")
    if state_data.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Google Calendar connection belongs to a different session.")

    config = _config()
    if not config:
        raise HTTPException(status_code=503, detail="Google Calendar is not configured on the server.")
    token_response = _google_request(
        "POST",
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": config[0],
            "client_secret": config[1],
            "redirect_uri": config[2],
            "grant_type": "authorization_code",
        },
    )
    if not token_response.ok:
        raise HTTPException(status_code=502, detail="Google authorization could not be completed. Please try again.")
    token_data = token_response.json()
    refresh_token = token_data.get("refresh_token")
    connection = db.query(GoogleCalendarConnection).filter_by(user_id=current_user.id).first()
    if not refresh_token and connection:
        try:
            refresh_token = _fernet().decrypt(connection.encrypted_refresh_token.encode()).decode()
        except (InvalidToken, UnicodeDecodeError):
            refresh_token = None
    if not refresh_token:
        raise HTTPException(status_code=502, detail="Google did not grant offline access. Reconnect and approve calendar access.")

    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=502, detail="Google returned no calendar access token.")
    profile_response = _google_request(
        "GET", GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
    )
    if not profile_response.ok or not profile_response.json().get("email"):
        raise HTTPException(status_code=502, detail="Google account email could not be verified.")
    if not connection:
        connection = GoogleCalendarConnection(user_id=current_user.id)
        db.add(connection)
    connection.email = profile_response.json()["email"]
    connection.encrypted_refresh_token = _fernet().encrypt(refresh_token.encode()).decode()
    db.commit()
    return RedirectResponse("/dashboard_v2?googleCalendar=connected", status_code=303)


@router.post("/sync")
def sync_pm_schedules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = db.query(GoogleCalendarConnection).filter_by(user_id=current_user.id).first()
    if not connection:
        raise HTTPException(status_code=409, detail="Connect a Google Calendar before syncing PM schedules.")
    access_token = _refresh_access_token(connection, db)
    update_all_pm_status(db)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    schedules = (
        db.query(PMSchedule)
        .join(Asset, PMSchedule.asset_id == Asset.id)
        .order_by(PMSchedule.scheduled_date.asc())
        .all()
    )
    created = updated = 0
    errors: list[dict] = []
    for schedule in schedules:
        asset = schedule.asset
        event = {
            "summary": f"Preventive Maintenance — {asset.equipment_name or asset.asset_code or 'Equipment'}",
            "description": "\n".join(filter(None, [
                f"BioTrack PM schedule #{schedule.id}",
                f"Asset: {asset.asset_code or '—'}",
                f"Department: {asset.department or schedule.department or '—'}",
                f"Location: {asset.location or schedule.location or '—'}",
                f"Status: {schedule.status or 'Upcoming'}",
                f"Assigned engineer ID: {schedule.engineer_id}" if schedule.engineer_id else None,
                f"Remarks: {schedule.remarks.strip()}" if schedule.remarks and schedule.remarks.strip() else None,
            ])),
            "start": {"date": schedule.scheduled_date.isoformat()},
            "end": {"date": (schedule.scheduled_date + timedelta(days=1)).isoformat()},
            "extendedProperties": {"private": {"biotrackScheduleId": str(schedule.id)}},
        }
        link = db.query(GoogleCalendarEventLink).filter_by(user_id=current_user.id, schedule_id=schedule.id).first()
        if link:
            response = _google_request(
                "PUT", f"{GOOGLE_API_BASE}/calendars/primary/events/{link.google_event_id}",
                headers=headers, json=event,
            )
            if response.ok:
                updated += 1
            if response.status_code == 404:
                response = _google_request(
                    "POST", f"{GOOGLE_API_BASE}/calendars/primary/events",
                    headers=headers, params={"sendUpdates": "none"}, json=event,
                )
                if response.ok:
                    link.google_event_id = response.json()["id"]
                    created += 1
        else:
            response = _google_request(
                "POST", f"{GOOGLE_API_BASE}/calendars/primary/events",
                headers=headers, params={"sendUpdates": "none"}, json=event,
            )
            if response.ok:
                link = GoogleCalendarEventLink(
                    user_id=current_user.id,
                    schedule_id=schedule.id,
                    google_event_id=response.json()["id"],
                )
                db.add(link)
                created += 1

        if not response.ok:
            try:
                detail = response.json().get("error", {}).get("message", "Google Calendar rejected this event.")
            except ValueError:
                detail = "Google Calendar rejected this event."
            errors.append({"schedule_id": schedule.id, "message": detail})

    db.commit()
    return {"created": created, "updated": updated, "total": len(schedules), "errors": errors}


@router.delete("/disconnect")
def disconnect_google_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = db.query(GoogleCalendarConnection).filter_by(user_id=current_user.id).first()
    if not connection:
        return {"success": True, "connected": False}
    try:
        refresh_token = _fernet().decrypt(connection.encrypted_refresh_token.encode()).decode()
        _google_request("POST", GOOGLE_REVOKE_URL, data={"token": refresh_token})
    except (InvalidToken, UnicodeDecodeError, HTTPException):
        pass
    db.query(GoogleCalendarEventLink).filter_by(user_id=current_user.id).delete(synchronize_session=False)
    db.delete(connection)
    db.commit()
    return {"success": True, "connected": False, "events_kept": True}
