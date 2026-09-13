"""Per-night facts extracted from history, observed at a fixed clock time."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time, timedelta
from typing import FrozenSet, Iterable, Optional, Tuple

from .history import History
from .windows import analog_window

CLEAR_HORIZON = timedelta(hours=1)


@dataclass(frozen=True)
class NightObservation:
    anchor: date
    activity: int                 # covered regions under alert at the snapshot clock time
    covered: FrozenSet[str]       # regions whose data covers the whole window
    active: FrozenSet[str]        # under alert at the snapshot clock time
    alerted: FrozenSet[str]       # any alert overlapping the window
    quiet_late: FrozenSet[str]    # no alert in the late part of the window (from 01:00)
    cleared_1h: FrozenSet[str]    # active at snapshot and the alert ended within an hour


@dataclass(frozen=True)
class CurrentState:
    activity: Optional[int]
    active: Optional[FrozenSet[str]]


def observe_nights(history: History, clock: time, anchors: Iterable[date]) -> Tuple[NightObservation, ...]:
    observations = []
    for anchor in anchors:
        w = analog_window(anchor, clock)
        covered, active, alerted, quiet_late, cleared = set(), set(), set(), set(), set()
        for region, record in history.regions.items():
            if record.covered_until < w.end:
                continue
            tl = record.timeline
            covered.add(region)
            if tl.active_at(w.feature_time):
                active.add(region)
                end = tl.end_of_active(w.feature_time)
                if end is not None and end - w.feature_time <= CLEAR_HORIZON:
                    cleared.add(region)
            if tl.overlaps(w.start, w.end):
                alerted.add(region)
            if not tl.overlaps(w.late_start, w.end):
                quiet_late.add(region)
        observations.append(
            NightObservation(
                anchor=anchor,
                activity=len(active),
                covered=frozenset(covered),
                active=frozenset(active),
                alerted=frozenset(alerted),
                quiet_late=frozenset(quiet_late),
                cleared_1h=frozenset(cleared),
            )
        )
    return tuple(observations)
