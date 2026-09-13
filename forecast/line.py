"""Betting line: analog-night outcome matrix and its reference pricing (docs/betting.md)."""
from __future__ import annotations

import math
from datetime import date, datetime
from typing import List, Mapping, Optional, Sequence, Tuple

from . import model
from .model import recency, similarity
from .national import night_count
from .observations import CurrentState, NightObservation
from .regions import FORECAST_REGIONS, WEST_REGIONS
from .windows import fixed_window

CLOSES_AFTER_SECONDS = 55 * 60
WEIGHT_DECIMALS = 4

Leg = Tuple[str, int]


def epoch(moment: datetime) -> int:
    return int(moment.timestamp())


def columns(regions: Sequence[str] = FORECAST_REGIONS) -> List[str]:
    return [f"alarm|{r}" for r in regions] + [f"quiet_late|{r}" for r in regions] + ["west_quiet", "total_over"]


def _state_chars(night: NightObservation, regions: Sequence[str]) -> str:
    return "".join("-" if r not in night.covered else ("1" if r in night.active else "0") for r in regions)


def _outcome_chars(night: NightObservation, regions, west, total_line: float, base_rates) -> str:
    alarm = ["-" if r not in night.covered else ("1" if r in night.alerted else "0") for r in regions]
    late = ["-" if r not in night.covered else ("1" if r in night.quiet_late else "0") for r in regions]
    west_quiet = "-" if not set(west) <= night.covered else ("0" if night.alerted & set(west) else "1")
    over = "1" if night_count(night, base_rates, regions) > total_line else "0"
    return "".join(alarm + late + [west_quiet, over])


def build_line(
    nights: Sequence[NightObservation],
    target: date,
    current: CurrentState,
    generated_at: datetime,
    total_line: float,
    base_rates: Mapping[str, float],
    regions: Sequence[str] = FORECAST_REGIONS,
    west: Sequence[str] = WEST_REGIONS,
) -> dict:
    window = fixed_window(target)
    active_now: Optional[str] = None
    if current.active is not None:
        active_now = "".join("1" if r in current.active else "0" for r in regions)
    return {
        "anchor": target.isoformat(),
        "window_start": epoch(window.start),
        "late_start": epoch(window.late_start),
        "window_end": epoch(window.end),
        "generated_at": epoch(generated_at),
        "closes_after_seconds": CLOSES_AFTER_SECONDS,
        "total_line": total_line,
        "regions": list(regions),
        "active_now": active_now,
        "columns": columns(regions),
        "nights": [
            {
                "r": round(recency(target, n), WEIGHT_DECIMALS),
                "s": round(similarity(n, current), WEIGHT_DECIMALS),
                "act": _state_chars(n, regions),
                "y": _outcome_chars(n, regions, west, total_line, base_rates),
            }
            for n in nights
        ],
        "params": {"prior_strength": model.PRIOR_STRENGTH, "own_state_mismatch": model.OWN_STATE_MISMATCH},
    }


def price(line: Mapping, legs: Sequence[Leg]) -> float:
    """Reference implementation of the contract's joint pricing; NaN when no night qualifies."""
    column_index = {key: i for i, key in enumerate(line["columns"])}
    region_index = {name: i for i, name in enumerate(line["regions"])}
    wanted = [(column_index[key], "1" if value else "0") for key, value in legs]
    leg_regions = sorted({region_index[key.split("|", 1)[1]] for key, _ in legs if "|" in key})
    active = line["active_now"]
    strength = line["params"]["prior_strength"]
    mismatch = line["params"]["own_state_mismatch"]

    rec_total = rec_hits = weight_total = weight_hits = 0.0
    for night in line["nights"]:
        outcomes = night["y"]
        if any(outcomes[c] == "-" for c, _ in wanted):
            continue
        hit = all(outcomes[c] == v for c, v in wanted)
        own = 1.0
        if active is not None:
            for i in leg_regions:
                state = night["act"][i]
                if state != "-" and state != active[i]:
                    own *= mismatch
        weight = night["r"] * night["s"] * own
        rec_total += night["r"]
        weight_total += weight
        if hit:
            rec_hits += night["r"]
            weight_hits += weight
    if rec_total <= 0:
        return math.nan
    p_base = rec_hits / rec_total
    return (weight_hits + strength * p_base) / (weight_total + strength)


def coherent_price(line: Mapping, legs: Sequence[Leg]) -> float:
    """Joint price clamped to the Frechet bounds implied by the single-leg prices.

    The own-state factor multiplies across every region a combination touches, so the
    raw joint estimate can exceed a single leg's price. Clamping keeps accumulators
    consistent with the singles shown on the board while the matrix still supplies
    the correlation between legs.
    """
    raw = price(line, legs)
    if len(legs) <= 1 or math.isnan(raw):
        return raw
    singles = [price(line, [leg]) for leg in legs]
    if any(math.isnan(p) for p in singles):
        return math.nan
    upper = min(singles)
    lower = max(0.0, sum(singles) - (len(legs) - 1))
    return min(upper, max(lower, raw))
