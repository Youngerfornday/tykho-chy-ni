"""Sorted, merged alert intervals with fast point and range queries."""
from __future__ import annotations

from bisect import bisect_left, bisect_right
from datetime import datetime
from typing import Iterable, Optional, Tuple

Interval = Tuple[datetime, datetime]


class Timeline:
    """Immutable set of disjoint [start, end) intervals.

    Because merged intervals are disjoint and sorted, their ends are sorted too,
    so every query is a single bisect.
    """

    __slots__ = ("_starts", "_ends")

    def __init__(self, starts: Tuple[datetime, ...], ends: Tuple[datetime, ...]):
        self._starts = starts
        self._ends = ends

    @classmethod
    def from_intervals(cls, intervals: Iterable[Interval]) -> "Timeline":
        valid = sorted((s, e) for s, e in intervals if e > s)
        merged: list = []
        for start, end in valid:
            if merged and start <= merged[-1][1]:
                last_start, last_end = merged[-1]
                merged[-1] = (last_start, max(last_end, end))
            else:
                merged.append((start, end))
        return cls(tuple(s for s, _ in merged), tuple(e for _, e in merged))

    def intervals(self) -> Tuple[Interval, ...]:
        return tuple(zip(self._starts, self._ends))

    def __len__(self) -> int:
        return len(self._starts)

    def active_at(self, moment: datetime) -> bool:
        i = bisect_right(self._starts, moment) - 1
        return i >= 0 and self._ends[i] > moment

    def overlaps(self, start: datetime, end: datetime) -> bool:
        i = bisect_left(self._starts, end) - 1
        return i >= 0 and self._ends[i] > start

    def end_of_active(self, moment: datetime) -> Optional[datetime]:
        i = bisect_right(self._starts, moment) - 1
        if i >= 0 and self._ends[i] > moment:
            return self._ends[i]
        return None

    def clipped(self, horizon: datetime) -> "Timeline":
        """Timeline as it was known at `horizon`: later starts dropped, open ends cut."""
        cut = bisect_left(self._starts, horizon)
        ends = tuple(min(e, horizon) for e in self._ends[:cut])
        return Timeline(self._starts[:cut], ends)
