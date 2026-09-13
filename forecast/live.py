"""Live alert status from the public ubilling.net.ua mirror."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional

from .observations import CurrentState
from .regions import canonical_region
from .windows import KYIV

MIN_REGIONS_SEEN = 20
MAX_AGE = timedelta(minutes=90)


@dataclass(frozen=True)
class LiveSnapshot:
    state: CurrentState
    ok: bool
    reason: str
    as_of: Optional[datetime]


UNKNOWN = CurrentState(activity=None, active=None)


def _parse_cached_at(value: Any) -> Optional[datetime]:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.strip())
    except ValueError:
        return None
    return parsed.replace(tzinfo=KYIV) if parsed.tzinfo is None else parsed


def parse_live(payload: Any, now: datetime) -> LiveSnapshot:
    if not isinstance(payload, dict) or not isinstance(payload.get("states"), dict):
        return LiveSnapshot(UNKNOWN, False, "unexpected payload shape", None)
    seen, active = set(), set()
    for name, value in payload["states"].items():
        region = canonical_region(name) if isinstance(name, str) else None
        if region is None or not isinstance(value, dict) or not isinstance(value.get("alertnow"), bool):
            continue
        seen.add(region)
        if value["alertnow"]:
            active.add(region)
    as_of = _parse_cached_at(payload.get("cachedat"))
    if len(seen) < MIN_REGIONS_SEEN:
        return LiveSnapshot(UNKNOWN, False, f"only {len(seen)} regions in payload", as_of)
    if as_of is None or now - as_of > MAX_AGE:
        return LiveSnapshot(UNKNOWN, False, "live data is stale", as_of)
    return LiveSnapshot(CurrentState(len(active), frozenset(active)), True, "ok", as_of)
