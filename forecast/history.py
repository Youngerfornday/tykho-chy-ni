"""Alert history: parse dataset rows and merge official with volunteer data.

The official dataset is authoritative but lags by days; the volunteer one is
fresh but wrong for some regions. Volunteer rows are only trusted for regions
where both sources agree on past nights.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Dict, Iterable, List, Mapping, Optional, Tuple

from .regions import FORECAST_REGIONS, canonical_region
from .timeline import Interval, Timeline
from .windows import KYIV, analog_window

AGREEMENT_NIGHTS = 60
AGREEMENT_THRESHOLD = 0.7
_REFERENCE_CLOCK = time(22, 0)


@dataclass(frozen=True)
class ParsedSource:
    intervals: Mapping[str, List[Interval]]
    invalid: int
    latest_start: Optional[datetime]


@dataclass(frozen=True)
class RegionHistory:
    timeline: Timeline
    covered_until: datetime


@dataclass(frozen=True)
class History:
    regions: Mapping[str, RegionHistory]
    official_until: datetime
    volunteer_until: datetime
    excluded: Tuple[Tuple[str, float], ...] = field(default_factory=tuple)
    # Raw volunteer data for rejected regions: its silence still proves a quiet night.
    volunteer_timelines: Mapping[str, Timeline] = field(default_factory=dict)


def _parse_time(value: str) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError("timestamp without timezone")
    return parsed


def parse_rows(rows: Iterable[Mapping[str, str]], region_key: str, since: datetime, cutoff: datetime) -> ParsedSource:
    """Group alert rows into per-region intervals.

    Rows with an unknown region are skipped silently (occupied or non-forecast
    areas); rows with a missing region or unparseable timestamps count as invalid.
    Alerts without an end are treated as running until `cutoff`.
    """
    grouped: Dict[str, List[Interval]] = {}
    invalid = 0
    latest: Optional[datetime] = None
    for raw in rows:
        name = raw.get(region_key)
        try:
            start = _parse_time(raw.get("started_at", ""))
            end = _parse_time(raw.get("finished_at", "")) or cutoff
        except ValueError:
            invalid += 1
            continue
        if not name or start is None:
            invalid += 1
            continue
        region = canonical_region(name)
        if region is None or start < since:
            continue
        grouped.setdefault(region, []).append((start, end))
        latest = start if latest is None or start > latest else latest
    return ParsedSource(grouped, invalid, latest)


def nights_ending_before(moment: datetime, count: int) -> List[date]:
    """The `count` most recent night anchors whose window ended by `moment`."""
    anchor = moment.astimezone(KYIV).date()
    while analog_window(anchor, _REFERENCE_CLOCK).end > moment:
        anchor -= timedelta(days=1)
    return [anchor - timedelta(days=i) for i in range(count)]


def agreement(a: Timeline, b: Timeline, anchors: Iterable[date]) -> float:
    windows = [analog_window(anchor, _REFERENCE_CLOCK) for anchor in anchors]
    if not windows:
        return 1.0
    same = sum(a.overlaps(w.start, w.end) == b.overlaps(w.start, w.end) for w in windows)
    return same / len(windows)


def merge_sources(
    official: ParsedSource,
    volunteer: ParsedSource,
    official_until: datetime,
    volunteer_until: datetime,
    threshold: float = AGREEMENT_THRESHOLD,
) -> History:
    anchors = nights_ending_before(official_until, AGREEMENT_NIGHTS)
    regions: Dict[str, RegionHistory] = {}
    excluded: List[Tuple[str, float]] = []
    rejected: Dict[str, Timeline] = {}
    for region in FORECAST_REGIONS:
        official_rows = official.intervals.get(region, [])
        volunteer_rows = volunteer.intervals.get(region, [])
        volunteer_timeline = Timeline.from_intervals(volunteer_rows)
        score = agreement(Timeline.from_intervals(official_rows), volunteer_timeline, anchors)
        if score >= threshold:
            fresh = [iv for iv in volunteer_rows if iv[0] >= official_until]
            regions[region] = RegionHistory(Timeline.from_intervals(official_rows + fresh), volunteer_until)
        else:
            regions[region] = RegionHistory(Timeline.from_intervals(official_rows), official_until)
            excluded.append((region, round(score, 3)))
            rejected[region] = volunteer_timeline
    return History(regions, official_until, volunteer_until, tuple(excluded), rejected)
