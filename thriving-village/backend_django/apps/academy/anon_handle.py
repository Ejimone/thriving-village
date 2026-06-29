"""Port of backend/src/utils/anon-handle.ts."""

import random

LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # no I/O, avoids look-alike confusion


def generate_anon_handle() -> str:
    """A stable, random "Entry A12"-style handle shared by every judge who
    views a given submission — independent per submission, so it can't be
    used to pivot to identity or to any other submission's handle."""
    from .models import AcademySubmission

    for _ in range(10):
        letter = random.choice(LETTERS)
        digits = random.randint(10, 99)
        handle = f"Entry {letter}{digits}"
        if not AcademySubmission.objects.filter(anon_handle=handle).exists():
            return handle
    raise RuntimeError("Could not generate a unique anonymous handle.")
