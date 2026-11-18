import unittest

from pydantic import ValidationError

from backend.routes.user_routes import ALLOWED_ROLES, UserCreate, UserUpdate


def valid_user(**overrides):
    data = {
        "name": "Test User",
        "department": "ICU",
        "role": "User",
        "email": "test@example.com",
        "phone": "9876543210",
        "username": "Test.User",
        "password": "a-secure-password",
    }
    data.update(overrides)
    return data


class UserValidationTests(unittest.TestCase):
    def test_ward_boy_is_a_supported_login_role(self):
        self.assertIn("WardBoy", ALLOWED_ROLES)

    def test_new_users_require_a_strong_initial_password(self):
        with self.assertRaises(ValidationError):
            UserCreate(**valid_user(password="short"))
        with self.assertRaises(ValidationError):
            UserCreate(**valid_user(password=" " * 12))

    def test_usernames_are_normalized(self):
        user = UserCreate(**valid_user())
        self.assertEqual(user.username, "test.user")

    def test_update_allows_no_password_but_rejects_a_short_replacement(self):
        without_password = valid_user(password="")
        self.assertEqual(UserUpdate(**without_password).password, "")

        with self.assertRaises(ValidationError):
            UserUpdate(**valid_user(password="replacement"))


if __name__ == "__main__":
    unittest.main()
