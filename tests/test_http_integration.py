import asyncio
import json
import os
import unittest
from http.cookies import SimpleCookie

import bcrypt
from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("JWT_SECRET_KEY", "integration-test-secret-key-that-is-long-enough")
os.environ["COOKIE_SECURE"] = "false"
os.environ["PUBLIC_ORIGIN"] = "http://testserver"

from backend.database import get_db
from backend.models import Base
from backend.models.user import User
from backend.routes.auth_routes import router as auth_router
from backend.security_middleware import SecurityMiddleware


class ASGIResponse:
    def __init__(self, messages: list[dict]):
        start = next(message for message in messages if message["type"] == "http.response.start")
        self.status_code = start["status"]
        self.raw_headers = [
            (key.decode("latin-1"), value.decode("latin-1"))
            for key, value in start.get("headers", [])
        ]
        self.body = b"".join(
            message.get("body", b"")
            for message in messages
            if message["type"] == "http.response.body"
        )

    def json(self):
        return json.loads(self.body or b"null")

    def cookies(self) -> dict[str, str]:
        result: dict[str, str] = {}
        for key, value in self.raw_headers:
            if key.casefold() != "set-cookie":
                continue
            parsed = SimpleCookie()
            parsed.load(value)
            result.update({name: morsel.value for name, morsel in parsed.items()})
        return result


async def asgi_request(
    app,
    method: str,
    path: str,
    *,
    payload: dict | None = None,
    cookies: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
) -> ASGIResponse:
    body = json.dumps(payload).encode("utf-8") if payload is not None else b""
    request_headers = {"host": "testserver", **(headers or {})}
    if payload is not None:
        request_headers["content-type"] = "application/json"
    if cookies:
        request_headers["cookie"] = "; ".join(f"{key}={value}" for key, value in cookies.items())
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "root_path": "",
        "headers": [
            (key.lower().encode("latin-1"), value.encode("latin-1"))
            for key, value in request_headers.items()
        ],
        "client": ("127.0.0.1", 54321),
        "server": ("testserver", 80),
    }
    sent: list[dict] = []
    delivered = False

    async def receive():
        nonlocal delivered
        if not delivered:
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)

    await app(scope, receive, send)
    return ASGIResponse(sent)


class AuthenticationHTTPIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.Session = sessionmaker(bind=cls.engine, autocommit=False, autoflush=False)
        cls.app = FastAPI()
        cls.app.add_middleware(SecurityMiddleware)
        cls.app.include_router(auth_router)

        def test_db():
            session = cls.Session()
            try:
                yield session
            finally:
                session.close()

        cls.app.dependency_overrides[get_db] = test_db

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        with self.Session() as session:
            session.add(User(
                username="manager",
                password_hash=bcrypt.hashpw(b"StrongPassword123!", bcrypt.gensalt()).decode("utf-8"),
                name="Test Manager",
                email="manager@example.test",
                department="Biomedical",
                role="Manager",
                is_active=True,
            ))
            session.commit()

    def request(self, *args, **kwargs) -> ASGIResponse:
        return asyncio.run(asgi_request(self.app, *args, **kwargs))

    def login(self) -> tuple[ASGIResponse, dict[str, str]]:
        response = self.request(
            "POST",
            "/api/auth/login",
            payload={"username": "manager", "password": "StrongPassword123!"},
        )
        return response, response.cookies()

    def test_login_cookie_authentication_and_logout_boundary(self):
        login, cookies = self.login()
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.json()["success"])
        self.assertIn("access_token", cookies)
        self.assertIn("biotrack_csrf", cookies)

        profile = self.request("GET", "/api/auth/me", cookies=cookies)
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.json()["username"], "manager")

    def test_cookie_mutation_requires_and_accepts_bound_csrf_token(self):
        _, cookies = self.login()
        payload = {
            "current_password": "StrongPassword123!",
            "new_password": "EvenStrongerPassword456!",
        }
        rejected = self.request("POST", "/api/auth/change-password", payload=payload, cookies=cookies)
        self.assertEqual(rejected.status_code, 403)

        accepted = self.request(
            "POST",
            "/api/auth/change-password",
            payload=payload,
            cookies=cookies,
            headers={
                "origin": "http://testserver",
                "x-csrf-token": cookies["biotrack_csrf"],
            },
        )
        self.assertEqual(accepted.status_code, 200)
        self.assertTrue(accepted.json()["reauthenticate"])

        stale_session = self.request("GET", "/api/auth/me", cookies=cookies)
        self.assertEqual(stale_session.status_code, 401)


if __name__ == "__main__":
    unittest.main()
