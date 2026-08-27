import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from jose import jwt

from backend.auth import JWT_ALGORITHM, create_access_token, validate_auth_config


class AuthenticationTests(unittest.TestCase):
    def test_access_token_identifies_the_user_and_expires(self):
        user = SimpleNamespace(id=7, username="manager", role="Manager")
        with patch.dict(os.environ, {"JWT_SECRET_KEY": "a" * 32}, clear=False):
            token = create_access_token(user)
            payload = jwt.decode(token, "a" * 32, algorithms=[JWT_ALGORITHM])

        self.assertEqual(payload["sub"], "7")
        self.assertEqual(payload["username"], "manager")
        self.assertIn("exp", payload)

    def test_short_jwt_secret_is_rejected(self):
        with patch.dict(os.environ, {"JWT_SECRET_KEY": "too-short"}, clear=False):
            with self.assertRaises(RuntimeError):
                validate_auth_config()


if __name__ == "__main__":
    unittest.main()
