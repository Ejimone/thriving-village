"""Line-for-line port of backend/src/utils/academy-progression.ts. Pure
functions, no Django imports — every caller persists the returned state
itself. Originally a server-side port of the Academy frontend's progression
engine (CohortProvider.tsx)."""

from dataclasses import dataclass, replace
from math import ceil

DAYS_PER_WEEK = 7


def week_of(day: int) -> int:
    return ceil(day / DAYS_PER_WEEK)


@dataclass
class ProgressionState:
    current_day: int
    submitted_days: list[int]
    released_week: int
    early_weeks: list[int]


def is_available(released_week: int, early_weeks: list[int], week: int) -> bool:
    return week <= released_week or week in early_weeks


def normalize(p: ProgressionState, days_total: int) -> ProgressionState:
    """Advances current_day through any already-submitted, now-available days."""
    current_day = p.current_day
    while (
        current_day < days_total
        and current_day in p.submitted_days
        and is_available(p.released_week, p.early_weeks, week_of(current_day + 1))
    ):
        current_day += 1
    return replace(p, current_day=current_day)


def is_caught_up(p: ProgressionState, days_total: int) -> bool:
    next_week = week_of(min(p.current_day + 1, days_total))
    return (
        p.current_day in p.submitted_days
        and p.current_day < days_total
        and not is_available(p.released_week, p.early_weeks, next_week)
    )


def pace_completion(day_reached: int, released_day: int) -> int:
    if released_day <= 0:
        return 0
    return min(100, round((day_reached / released_day) * 100))


def chunk(items: list, size: int) -> list[list]:
    return [items[i : i + size] for i in range(0, len(items), size)]
