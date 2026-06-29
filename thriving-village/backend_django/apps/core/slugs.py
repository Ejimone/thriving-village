import re


def slugify(value: str) -> str:
    """Matches backend/src/utils/slugify.ts exactly (no external dep)."""
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"(^-|-$)+", "", value)
    return value or "item"


def unique_slug(model, base: str, field: str = "slug") -> str:
    """Port of backend/src/utils/slugify.ts's uniqueSlug — appends -2, -3, ...
    until the slug is free. Django generates this server-side on create,
    same as Strapi's controllers do for API-driven (non-admin-UI) creates.
    """
    candidate = base
    suffix = 1
    while model.objects.filter(**{field: candidate}).exists():
        suffix += 1
        candidate = f"{base}-{suffix}"
    return candidate
