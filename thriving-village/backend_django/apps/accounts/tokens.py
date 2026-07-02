"""Password-reset codes for both auth realms.

A code is `<uidb64>.<token>` — the uid identifies the row, the token is
Django's PasswordResetTokenGenerator output, which hashes the user's current
password hash + last_login + timestamp. That makes codes single-use (setting
the new password changes the hash, invalidating the token) and expiring
(settings.PASSWORD_RESET_TIMEOUT) without storing anything server-side.

Each realm gets its own key_salt so a code minted for an AcademyUser can
never be replayed against a main User with the same numeric pk, and vice
versa.
"""

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode


class _RealmTokenGenerator(PasswordResetTokenGenerator):
    def __init__(self, realm: str):
        super().__init__()
        self.key_salt = f"apps.accounts.tokens.PasswordReset.{realm}"


_GENERATORS = {
    "main": _RealmTokenGenerator("main"),
    "academy": _RealmTokenGenerator("academy"),
}


def make_reset_code(user, realm: str) -> str:
    return f"{urlsafe_base64_encode(force_bytes(user.pk))}.{_GENERATORS[realm].make_token(user)}"


def check_reset_code(code: str, model, realm: str):
    """Returns the user the code belongs to, or None if the code is invalid,
    expired, already used, or minted for the other realm."""
    if not code or "." not in code:
        return None
    uidb64, _, token = code.partition(".")
    try:
        pk = int(urlsafe_base64_decode(uidb64).decode())
    except (ValueError, UnicodeDecodeError):
        return None
    user = model.objects.filter(pk=pk).first()
    if user is None or not _GENERATORS[realm].check_token(user, token):
        return None
    return user
