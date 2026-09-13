"""Night windows in Kyiv local time.

A night belongs to the evening date it starts on (the anchor). The forecast
window is 23:00-07:00; once inside it, the remaining part (now-07:00) is used.
Past nights are observed at the same clock time as "now" so they are comparable.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

KYIV = ZoneInfo("Europe/Kyiv")
NIGHT_START = time(23, 0)
NIGHT_END = time(7, 0)
LATE_SPLIT = time(1, 0)


@dataclass(frozen=True)
class NightWindow:
    anchor: date
    feature_time: datetime
    start: datetime
    late_start: datetime
    end: datetime
    in_window: bool


def local_at(day: date, clock: time) -> datetime:
    """Kyiv wall-clock moment, returned in UTC.

    Same-tzinfo datetime arithmetic in Python ignores DST offset changes, so all
    window bounds are kept in UTC to make subtraction and comparison exact.
    """
    return datetime.combine(day, clock.replace(tzinfo=None), tzinfo=KYIV).astimezone(timezone.utc)


def _is_night(clock: time) -> bool:
    return clock >= NIGHT_START or clock < NIGHT_END


def analog_window(anchor: date, clock: time) -> NightWindow:
    """Window of the night starting on `anchor`, observed at local `clock`."""
    naive_clock = clock.replace(tzinfo=None)
    next_day = anchor + timedelta(days=1)
    feature_day = next_day if naive_clock < NIGHT_END else anchor
    feature_time = local_at(feature_day, naive_clock)
    in_window = _is_night(naive_clock)
    start = feature_time if in_window else local_at(anchor, NIGHT_START)
    late_start = max(start, local_at(next_day, LATE_SPLIT))
    end = local_at(next_day, NIGHT_END)
    return NightWindow(anchor, feature_time, start, late_start, end, in_window)


def fixed_window(anchor: date) -> NightWindow:
    """The full 23:00-07:00 night for `anchor`, independent of the current clock."""
    return analog_window(anchor, time(22, 0))


def night_window(now: datetime) -> NightWindow:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    local = now.astimezone(KYIV)
    clock = local.time()
    anchor = local.date() - timedelta(days=1) if clock < NIGHT_END else local.date()
    return analog_window(anchor, clock)
