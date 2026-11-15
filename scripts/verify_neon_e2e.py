"""Exercise a database-backed BioTrack login against a running local server."""

from __future__ import annotations

import secrets
import sys
import uuid

import bcrypt
import requests

from backend.database import SessionLocal
from backend.models.user import User


def main() -> None:
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8011"
    username = f"neon_verify_{uuid.uuid4().hex[:10]}"
    password = secrets.token_urlsafe(24)

    database = SessionLocal()
    try:
        database.add(
            User(
                username=username,
                password_hash=bcrypt.hashpw(
                    password.encode("utf-8"), bcrypt.gensalt()
                ).decode("utf-8"),
                name="Neon Verification",
                department="Biomedical",
                email=f"{username}@example.invalid",
                phone="",
                role="Manager",
            )
        )
        database.commit()
    finally:
        database.close()

    try:
        browser = requests.Session()
        health = browser.get(f"{base_url}/api/health", timeout=30)
        health.raise_for_status()
        login = browser.post(
            f"{base_url}/api/auth/login",
            json={"username": username, "password": password},
            timeout=30,
        )
        login.raise_for_status()
        profile = browser.get(f"{base_url}/api/auth/me", timeout=30)
        profile.raise_for_status()
        assets = browser.get(f"{base_url}/api/assets/", timeout=30)
        assets.raise_for_status()

        assert health.json() == {"status": "ok"}
        assert profile.json()["username"] == username
        assert profile.json()["role"] == "Manager"
        assert len(assets.json()) == 12
        print(
            "E2E passed: health=ok, authenticated_profile=ok, "
            f"neon_assets={len(assets.json())}."
        )
    finally:
        database = SessionLocal()
        try:
            database.query(User).filter(User.username == username).delete()
            database.commit()
        finally:
            database.close()


if __name__ == "__main__":
    main()
