"""Port of backend/src/utils/mux.ts. Implemented directly against Mux's REST
API + manual JWT signing/webhook verification (rather than the Node SDK's
helper methods) since there's no equivalent first-party Python SDK that
covers all three of direct-upload creation, signed-playback-token signing,
and webhook-signature verification in one package — same Mux account/
credentials, reused as-is per the approved plan (no new accounts).

Lesson video must be gated to enrolled/authenticated users, so every asset
is created with a SIGNED playback policy — never 'public'. The raw playback
URL is never handed to a client; only sign_playback_token() output is.
"""

import base64
import hashlib
import hmac
import time

import jwt
import requests
from django.conf import settings

MUX_API_BASE = "https://api.mux.com"


def _signing_private_key() -> bytes:
    """MUX_SIGNING_KEY_PRIVATE is stored base64-encoded (Mux's dashboard
    hands out signing keys this way) — decode to the raw PEM bytes PyJWT
    expects."""
    return base64.b64decode(settings.MUX_SIGNING_KEY_PRIVATE)


def _auth():
    return (settings.MUX_TOKEN_ID, settings.MUX_TOKEN_SECRET)


def create_direct_upload() -> dict:
    response = requests.post(
        f"{MUX_API_BASE}/video/v1/uploads",
        auth=_auth(),
        json={
            "cors_origin": settings.ACADEMY_FRONTEND_ORIGIN or "*",
            "new_asset_settings": {"playback_policy": ["signed"]},
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()["data"]


def sign_playback_token(playback_id: str, expiration_seconds: int = 60 * 60 * 4) -> str:
    now = int(time.time())
    payload = {
        "sub": playback_id,
        "aud": "v",
        "exp": now + expiration_seconds,
        "kid": settings.MUX_SIGNING_KEY_ID,
    }
    return jwt.encode(
        payload,
        _signing_private_key(),
        algorithm="RS256",
        headers={"kid": settings.MUX_SIGNING_KEY_ID},
    )


def unwrap_webhook_event(raw_body: bytes, mux_signature_header: str) -> dict:
    """Throws ValueError if the payload wasn't sent by Mux; returns the
    parsed event dict otherwise. Mux signs webhooks the same way Stripe
    does: header `Mux-Signature: t=<timestamp>,v1=<hex hmac-sha256>` over
    `f"{timestamp}.{raw_body}"`, keyed by MUX_WEBHOOK_SECRET."""
    import json

    if not settings.MUX_WEBHOOK_SECRET:
        raise ValueError("MUX_WEBHOOK_SECRET is not configured.")

    parts = dict(p.split("=", 1) for p in mux_signature_header.split(",") if "=" in p)
    timestamp, signature = parts.get("t"), parts.get("v1")
    if not timestamp or not signature:
        raise ValueError("Malformed Mux-Signature header.")

    signed_payload = f"{timestamp}.{raw_body.decode()}".encode()
    expected = hmac.new(settings.MUX_WEBHOOK_SECRET.encode(), signed_payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("Invalid Mux webhook signature.")

    return json.loads(raw_body)
