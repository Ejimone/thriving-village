from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class Conflict(APIException):
    """409 — e.g. "you already applied to this job". DRF has no built-in
    equivalent; Strapi's `ctx.conflict(...)` is the direct counterpart."""

    status_code = 409
    default_detail = "Conflict."


def envelope_exception_handler(exc, context):
    """Shapes DRF error responses as `{ error: { message } }`, matching what
    the frontend's `strapiFetch` (src/lib/strapi.ts) already parses from
    Strapi's error responses (`errJson?.error?.message`) — keeps that parsing
    code untouched.
    """
    response = exception_handler(exc, context)
    if response is None:
        return None

    detail = None
    if isinstance(response.data, dict):
        detail = response.data.get("detail")
        if detail is None:
            # Field-level validation errors: DRF returns {field: [messages]} — flatten to one string.
            first_key = next(iter(response.data), None)
            first_val = response.data.get(first_key) if first_key else None
            if isinstance(first_val, list) and first_val:
                detail = f"{first_key}: {first_val[0]}"
    elif isinstance(response.data, list) and response.data:
        # A plain-string ValidationError("...") comes back as a bare list, not a dict.
        detail = response.data[0]

    detail = detail or "Something went wrong."

    response.data = {"error": {"message": str(detail), "status": response.status_code}}
    return response
