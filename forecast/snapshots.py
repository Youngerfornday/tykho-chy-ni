"""Live alert snapshots persisted across scheduled builds via the deployed site."""
from __future__ import annotations

import json
import sys
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Iterable, List, Optional, Tuple
from urllib.error import HTTPError

from .live import LiveSnapshot
from .regions import canonical_region

RETENTION = timedelta(days=11)
FETCH_TIMEOUT = 20
USER_AGENT = "tykho-chy-ni/1.0 (+https://github.com/Youngerfornday/tykho-chy-ni)"

Fetch = Callable[[str], bytes]


@dataclass(frozen=True)
class Snapshot:
    t: int
    active: Tuple[str, ...]


def _default_fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT) as response:
        return response.read()


def _valid_entry(entry: Any) -> Optional[Snapshot]:
    if not isinstance(entry, dict):
        return None
    moment, active = entry.get("t"), entry.get("active")
    if isinstance(moment, bool) or not isinstance(moment, int) or not isinstance(active, list):
        return None
    if not all(isinstance(name, str) for name in active):
        return None
    regions = sorted({r for r in (canonical_region(name) for name in active) if r is not None})
    return Snapshot(moment, tuple(regions))


def parse_snapshots(payload: Any) -> Tuple[Snapshot, ...]:
    if not isinstance(payload, list):
        return ()
    return tuple(s for s in (_valid_entry(entry) for entry in payload) if s is not None)


def load_snapshots(url: Optional[str], now: datetime, fetch: Fetch = _default_fetch) -> Tuple[Snapshot, ...]:
    """Previously published snapshots; 404 starts empty, other failures warn and start empty."""
    if not url:
        return ()
    busted = f"{url}{'&' if '?' in url else '?'}t={int(now.timestamp())}"
    try:
        return parse_snapshots(json.loads(fetch(busted)))
    except HTTPError as error:
        if error.code != 404:
            print(f"[snapshots] warning: HTTP {error.code} loading previous snapshots", file=sys.stderr)
        return ()
    except (OSError, ValueError) as error:
        print(f"[snapshots] warning: previous snapshots unavailable: {error}", file=sys.stderr)
        return ()


def update_snapshots(previous: Iterable[Snapshot], live: LiveSnapshot, now: datetime) -> Tuple[Snapshot, ...]:
    stamp = int(now.timestamp())
    cutoff = int((now - RETENTION).timestamp())
    by_time = {s.t: s for s in previous if s.t >= cutoff}
    if live.ok and live.state.active is not None:
        by_time[stamp] = Snapshot(stamp, tuple(sorted(live.state.active)))
    return tuple(by_time[t] for t in sorted(by_time))


def to_json(snapshots: Iterable[Snapshot]) -> List[dict]:
    return [{"t": s.t, "active": list(s.active)} for s in snapshots]
