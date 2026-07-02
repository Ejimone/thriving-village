from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings

from .models import AcademyUser, Role, User
from .tokens import check_reset_code, make_reset_code

LOCMEM_EMAIL = "django.core.mail.backends.locmem.EmailBackend"


def _reset_code_from_outbox() -> str:
    body = mail.outbox[-1].body
    for line in body.splitlines():
        if "code=" in line:
            return line.rsplit("code=", 1)[1].strip()
    raise AssertionError("No reset code found in outbox email")


@override_settings(EMAIL_BACKEND=LOCMEM_EMAIL)
class PasswordResetMainRealmTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email="talent@example.com", password="old-password-1", username="talent1", role=Role.TALENT
        )

    def _flush_email_thread(self):
        # send_password_reset runs on a daemon thread; the locmem backend
        # appends synchronously once the thread runs. Poll briefly.
        import time

        for _ in range(50):
            if mail.outbox:
                return
            time.sleep(0.02)

    def test_forgot_password_sends_email_and_reset_works(self):
        response = self.client.post(
            "/api/auth/forgot-password", {"email": "talent@example.com"}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})
        self._flush_email_thread()
        self.assertEqual(len(mail.outbox), 1)
        code = _reset_code_from_outbox()

        response = self.client.post(
            "/api/auth/reset-password",
            {"code": code, "password": "new-password-1", "passwordConfirmation": "new-password-1"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("jwt", payload)
        self.assertEqual(payload["user"]["email"], "talent@example.com")

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("new-password-1"))

    def test_forgot_password_unknown_email_returns_ok_without_email(self):
        response = self.client.post(
            "/api/auth/forgot-password", {"email": "nobody@example.com"}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})
        self.assertEqual(len(mail.outbox), 0)

    def test_reset_code_is_single_use(self):
        code = make_reset_code(self.user, "main")
        first = self.client.post(
            "/api/auth/reset-password",
            {"code": code, "password": "new-password-1", "passwordConfirmation": "new-password-1"},
            content_type="application/json",
        )
        self.assertEqual(first.status_code, 200)
        second = self.client.post(
            "/api/auth/reset-password",
            {"code": code, "password": "other-password-2", "passwordConfirmation": "other-password-2"},
            content_type="application/json",
        )
        self.assertEqual(second.status_code, 400)

    def test_mismatched_confirmation_rejected(self):
        code = make_reset_code(self.user, "main")
        response = self.client.post(
            "/api/auth/reset-password",
            {"code": code, "password": "new-password-1", "passwordConfirmation": "different"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_realm_isolation(self):
        academy = AcademyUser.objects.create_user(
            email="student@example.com", password="student-pass-1", username="student1"
        )
        # A code minted in the academy realm must not reset a main user
        # with the same pk, and must not validate in the main realm at all.
        code = make_reset_code(academy, "academy")
        self.assertIsNone(check_reset_code(code, User, "main"))
        self.assertIsNotNone(check_reset_code(code, AcademyUser, "academy"))


@override_settings(EMAIL_BACKEND=LOCMEM_EMAIL)
class PasswordResetAcademyRealmTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = AcademyUser.objects.create_user(
            email="student@example.com", password="old-password-1", username="student1"
        )

    def test_academy_reset_flow(self):
        code = make_reset_code(self.user, "academy")
        response = self.client.post(
            "/api/academy/auth/reset-password",
            {"code": code, "password": "new-password-1", "passwordConfirmation": "new-password-1"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("jwt", payload)
        self.assertEqual(payload["user"]["role"], "Student")
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("new-password-1"))

    def test_blocked_user_cannot_reset(self):
        self.user.blocked = True
        self.user.save(update_fields=["blocked"])
        code = make_reset_code(self.user, "academy")
        response = self.client.post(
            "/api/academy/auth/reset-password",
            {"code": code, "password": "new-password-1", "passwordConfirmation": "new-password-1"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)


class SupabaseExchangeTests(TestCase):
    def setUp(self):
        # DRF throttle counters live in the cache and would otherwise
        # accumulate across tests (every request shares the test client IP).
        cache.clear()

    def _exchange(self, path="/api/auth/supabase", **body):
        return self.client.post(path, {"access_token": "fake", **body}, content_type="application/json")

    @patch("apps.accounts.views.verify_supabase_token")
    def test_creates_main_user_on_first_exchange(self, verify):
        verify.return_value = {"email": "New@Example.com", "user_metadata": {"full_name": "New Person"}}
        response = self._exchange(role="employer")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("jwt", payload)
        user = User.objects.get(email="new@example.com")
        self.assertEqual(user.role, Role.EMPLOYER)
        self.assertEqual(user.username, "New Person")
        self.assertFalse(user.has_usable_password())

    @patch("apps.accounts.views.verify_supabase_token")
    def test_links_existing_user_by_email(self, verify):
        existing = User.objects.create_user(
            email="talent@example.com", password="pass-123", username="talent1", role=Role.TALENT
        )
        verify.return_value = {"email": "talent@example.com"}
        response = self._exchange()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["id"], existing.id)
        self.assertEqual(User.objects.count(), 1)

    @patch("apps.accounts.views.verify_supabase_token")
    def test_academy_exchange_creates_student(self, verify):
        verify.return_value = {"email": "student@example.com", "user_metadata": {"username": "stu"}}
        response = self._exchange(path="/api/academy/auth/supabase")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["role"], "Student")
        self.assertTrue(AcademyUser.objects.filter(email="student@example.com").exists())

    @patch("apps.accounts.views.verify_supabase_token")
    def test_blocked_user_rejected(self, verify):
        User.objects.create_user(
            email="blocked@example.com", password="pass-123", username="blocked1", blocked=True
        )
        verify.return_value = {"email": "blocked@example.com"}
        response = self._exchange()
        self.assertEqual(response.status_code, 403)

    @patch("apps.accounts.views.verify_supabase_token")
    def test_username_collision_gets_suffix(self, verify):
        User.objects.create_user(email="a@example.com", password="pass-123", username="dupe")
        verify.return_value = {"email": "b@example.com", "user_metadata": {"username": "dupe"}}
        response = self._exchange()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.get(email="b@example.com").username, "dupe2")


class AcademyLoginTests(TestCase):
    def test_academy_login_works(self):
        AcademyUser.objects.create_user(email="s@example.com", password="secret-pass-1", username="s1")
        response = self.client.post(
            "/api/academy/auth/local",
            {"identifier": "s@example.com", "password": "secret-pass-1"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("jwt", response.json())

    def test_admin_fallback_still_works(self):
        User.objects.create_user(
            email="admin@example.com", password="admin-pass-1", username="admin1", role=Role.ADMIN
        )
        response = self.client.post(
            "/api/academy/auth/local",
            {"identifier": "admin@example.com", "password": "admin-pass-1"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["role"], "Admin")

    def test_wrong_password_rejected(self):
        AcademyUser.objects.create_user(email="s@example.com", password="secret-pass-1", username="s1")
        response = self.client.post(
            "/api/academy/auth/local",
            {"identifier": "s@example.com", "password": "wrong"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
