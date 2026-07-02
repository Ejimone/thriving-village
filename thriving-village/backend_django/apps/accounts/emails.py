"""Outbound email for the auth flows.

Sends off the request thread (same pattern as apps.activity.utils.log_activity)
so a slow/unreachable SMTP server can never stall a login-path response —
forgot-password must return in constant time whether or not the email exists,
and an SMTP handshake would both slow it down and leak that difference.
"""

import logging
import threading

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_async(subject: str, body: str, to: str) -> None:
    def _send():
        try:
            send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to], fail_silently=False)
        except Exception:  # noqa: BLE001 — best-effort; never crash the worker thread
            logger.exception("Failed to send email %r to %s", subject, to)

    threading.Thread(target=_send, daemon=True).start()


def send_password_reset(user, code: str, base_url: str) -> None:
    link = f"{base_url.rstrip('/')}/reset-password?code={code}"
    name = user.name or user.username
    body = (
        f"Hi {name},\n\n"
        "We received a request to reset your Thriving Village password.\n\n"
        f"Reset it here: {link}\n\n"
        f"Or enter this code on the reset page: {code}\n\n"
        "This link expires in 2 hours and can only be used once. If you didn't "
        "request a reset, you can safely ignore this email — your password is unchanged.\n"
    )
    send_async("Reset your Thriving Village password", body, user.email)
