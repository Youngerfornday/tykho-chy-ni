"""Settlement evidence for the betting game: what happened in each recent night (docs/betting.md)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Dict, Iterable

from .history import History
from .regions import FORECAST_REGIONS
from .snapshots import Snapshot
from .timeline import Timeline
from .windows import fixed_window

RESULT_NIGHTS = 10
RESULTS_VERSION = 1
SNAPSHOT_POINT_SECONDS = 60


def _epoch(moment: datetime) -> int:
    return int(moment.timestamp())


def _moment(seconds: int) -> datetime:
    return datetime.fromtimestamp(seconds, tz=timezone.utc)


def _no_known_until(history: History, region: str, start: datetime, end: datetime) -> datetime:
    """Dataset coverage; for rejected volunteer regions, volunteer silence also counts."""
    record = history.regions[region]
    volunteer = history.volunteer_timelines.get(region)
    if volunteer is not None and not volunteer.overlaps(start, end):
        return max(record.covered_until, history.volunteer_until)
    return record.covered_until


def _region_night(history: History, region: str, snapshots: Iterable[Snapshot], start: datetime, end: datetime, now: datetime) -> dict:
    points = [
        (_moment(s.t), _moment(s.t + SNAPSHOT_POINT_SECONDS))
        for s in snapshots
        if region in s.active and start <= _moment(s.t) < end
    ]
    observed = Timeline.from_intervals(list(history.regions[region].timeline.overlapping(start, end)) + points)
    return {
        "yes_known_until": _epoch(now),
        "no_known_until": _epoch(_no_known_until(history, region, start, end)),
        "alerts": [[_epoch(s), _epoch(e)] for s, e in observed.overlapping(start, end)],
    }


def build_results(history: History, snapshots: Iterable[Snapshot], now: datetime, anchor: date) -> dict:
    snaps = tuple(snapshots)
    nights: Dict[str, dict] = {}
    for offset in range(RESULT_NIGHTS):
        night = anchor - timedelta(days=offset)
        window = fixed_window(night)
        regions = [r for r in FORECAST_REGIONS if r in history.regions]
        nights[night.isoformat()] = {
            "window_start": _epoch(window.start),
            "late_start": _epoch(window.late_start),
            "window_end": _epoch(window.end),
            "regions": {r: _region_night(history, r, snaps, window.start, window.end, now) for r in regions},
        }
    return {"version": RESULTS_VERSION, "generated_at": _epoch(now), "nights": nights}
