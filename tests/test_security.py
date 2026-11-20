import os
import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

from backend.auth import create_access_token, create_csrf_token, get_current_user, verify_csrf_token
from backend.models import Base
from backend.models.auth_session import AuthSession
from backend.models.user import User
from backend.routes.auth_routes import LoginRequest, login
from backend.services.auth_service import authenticate_user
from backend.services.security_service import verify_totp
import bcrypt


class SecurityHardeningTests(unittest.TestCase):
    @staticmethod
    def request(path: str = "/api/auth/login") -> Request:
        return Request({
            "type": "http", "method": "POST", "path": path, "headers": [],
            "scheme": "http", "server": ("testserver", 80), "client": ("127.0.0.1", 1),
            "query_string": b"",
        })

    def test_csrf_token_is_bound_to_the_server_session(self):
        with patch.dict(os.environ, {"JWT_SECRET_KEY": "s" * 32}, clear=False):
            token = create_csrf_token("session-one")
            self.assertTrue(verify_csrf_token("session-one", token))
            self.assertFalse(verify_csrf_token("session-two", token))

    def test_totp_verification_uses_standard_time_windows(self):
        # RFC 6238 SHA-1 test secret; its 8-digit value at t=59 is 94287082.
        secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
        self.assertTrue(verify_totp(secret, "287082", at_time=59))
        self.assertFalse(verify_totp(secret, "000000", at_time=59))

    def test_sql_injection_username_is_treated_as_plain_data(self):
        engine = create_engine("sqlite:///:memory:")
        User.__table__.create(engine)
        db = sessionmaker(bind=engine)()
        try:
            password_hash = bcrypt.hashpw(b"correct-password", bcrypt.gensalt()).decode()
            db.add(User(
                username="manager", password_hash=password_hash, role="Manager",
                is_active=True, failed_login_attempts=0, mfa_enabled=False,
            ))
            db.commit()
            self.assertIsNone(authenticate_user(db, "manager' OR '1'='1", "correct-password"))
            self.assertIsNotNone(authenticate_user(db, "manager", "correct-password"))
        finally:
            db.close()
            engine.dispose()

    def test_manager_login_does_not_require_optional_mfa(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        db = sessionmaker(bind=engine)()
        try:
            password_hash = bcrypt.hashpw(b"correct-password", bcrypt.gensalt()).decode()
            db.add(User(
                username="optional-mfa-manager", password_hash=password_hash, role="Manager",
                is_active=True, failed_login_attempts=0, mfa_enabled=False,
            ))
            db.commit()
            response = Response()
            with patch.dict(os.environ, {"JWT_SECRET_KEY": "m" * 32, "COOKIE_SECURE": "false"}, clear=False):
                result = login(
                    LoginRequest(username="optional-mfa-manager", password="correct-password"),
                    self.request(), response, db,
                )
            self.assertTrue(result["success"])
            self.assertFalse(result["mfa_enabled"])
            self.assertEqual(db.query(AuthSession).count(), 1)
        finally:
            db.close()
            engine.dispose()

    def test_revoked_session_is_not_accepted(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        db = sessionmaker(bind=engine)()
        try:
            user = User(
                username="security-manager", password_hash="unused", role="Manager",
                is_active=True, failed_login_attempts=0, mfa_enabled=False,
            )
            db.add(user)
            db.flush()
            session = AuthSession(
                token_id="session-token", user_id=user.id,
                created_at=datetime.utcnow(), last_seen_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(hours=1),
            )
            db.add(session)
            db.commit()
            with patch.dict(os.environ, {"JWT_SECRET_KEY": "x" * 32, "COOKIE_SECURE": "false"}, clear=False):
                token = create_access_token(SimpleNamespace(id=user.id, username=user.username), session.token_id)
                request = Request({
                    "type": "http", "method": "GET", "path": "/api/auth/me",
                    "headers": [(b"cookie", f"access_token={token}".encode())],
                    "scheme": "http", "server": ("testserver", 80), "client": ("127.0.0.1", 1),
                    "query_string": b"",
                })
                self.assertEqual(get_current_user(request, None, db).id, user.id)
                session.revoked_at = datetime.utcnow()
                db.commit()
                with self.assertRaises(Exception):
                    get_current_user(request, None, db)
        finally:
            db.close()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
