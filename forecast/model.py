"""Analog-night model: weight past nights by similarity and recency, then shrink.

p = (sum w*y + m*p_base) / (sum w + m), where w favours nights with a similar
number of regions under alert at the same clock time, recent nights, and nights
where the region itself was in the same state; p_base is the recency-weighted
rate over all covered nights.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import date
from typing import Callable, List, Optional, Sequence, Tuple

from .observations import CurrentState, NightObservation

HALF_LIFE_DAYS = 14.0
KERNEL_SCALE = 1.0
OWN_STATE_MISMATCH = 0.1
PRIOR_STRENGTH = 3.0  # tuned with HALF_LIFE, KERNEL, OWN_STATE by rolling backtest at three clock times
INTERVAL_QUANTILES = (0.1, 0.9)


@dataclass(frozen=True)
class Estimate:
    p: float
    p_base: float
    n_eff: float


@dataclass(frozen=True)
class RegionEstimate:
    p: float
    p_base: float
    n_eff: float
    lo: float
    hi: float
    active_now: Optional[bool]
    p_quiet_late: float
    p_clear_1h: Optional[float]


def shrink(weighted_hits: float, total_weight: float, prior: float, strength: float = PRIOR_STRENGTH) -> float:
    return (weighted_hits + strength * prior) / (total_weight + strength)


def effective_n(weights: Sequence[float]) -> float:
    squares = sum(w * w for w in weights)
    return (sum(weights) ** 2) / squares if squares > 0 else 0.0


def weighted_quantile(values: Sequence[float], weights: Sequence[float], q: float) -> float:
    pairs = sorted(zip(values, weights))
    total = sum(w for _, w in pairs)
    running = 0.0
    for value, weight in pairs:
        running += weight
        if weight > 0 and running >= q * total:
            return value
    return pairs[-1][0]


def recency(target: date, night: NightObservation) -> float:
    return 0.5 ** ((target - night.anchor).days / HALF_LIFE_DAYS)


def similarity(night: NightObservation, current: CurrentState) -> float:
    if current.activity is None:
        return 1.0
    return math.exp(-abs(night.activity - current.activity) / KERNEL_SCALE)


def _own_state(night: NightObservation, region: str, current: CurrentState) -> float:
    if current.active is None:
        return 1.0
    return 1.0 if (region in night.active) == (region in current.active) else OWN_STATE_MISMATCH


# (recency weight, full weight, outcome)
Sample = Tuple[float, float, bool]


def _estimate(samples: Sequence[Sample]) -> Estimate:
    rec_total = sum(r for r, _, _ in samples)
    if rec_total <= 0:
        return Estimate(float("nan"), float("nan"), 0.0)
    p_base = sum(r for r, _, y in samples if y) / rec_total
    weights = [w for _, w, _ in samples]
    hits = sum(w for _, w, y in samples if y)
    return Estimate(shrink(hits, sum(weights), p_base), p_base, effective_n(weights))


def _bootstrap(samples: Sequence[Sample], rng: random.Random, resamples: int) -> Tuple[float, float]:
    size = len(samples)
    draws: List[float] = []
    for _ in range(resamples):
        est = _estimate([samples[rng.randrange(size)] for _ in range(size)])
        if not math.isnan(est.p):
            draws.append(est.p)
    draws.sort()
    lo_q, hi_q = INTERVAL_QUANTILES
    return draws[int(lo_q * (len(draws) - 1))], draws[int(hi_q * (len(draws) - 1))]


def _samples(nights, target, current, keep: Callable, outcome: Callable, own: Callable) -> List[Sample]:
    return [
        (recency(target, n), recency(target, n) * similarity(n, current) * own(n), outcome(n))
        for n in nights
        if keep(n)
    ]


def estimate_region(
    region: str,
    nights: Sequence[NightObservation],
    target: date,
    current: CurrentState,
    rng: Optional[random.Random] = None,
    resamples: int = 0,
) -> RegionEstimate:
    own = lambda n: _own_state(n, region, current)
    covered = lambda n: region in n.covered
    main_samples = _samples(nights, target, current, covered, lambda n: region in n.alerted, own)
    main = _estimate(main_samples)
    late = _estimate(_samples(nights, target, current, covered, lambda n: region in n.quiet_late, own))
    clear_samples = _samples(
        nights, target, current, lambda n: covered(n) and region in n.active, lambda n: region in n.cleared_1h, lambda n: 1.0
    )
    clear = _estimate(clear_samples) if clear_samples else None

    lo, hi = main.p, main.p
    if rng is not None and resamples > 0 and main_samples:
        lo, hi = _bootstrap(main_samples, rng, resamples)
    active_now = None if current.active is None else region in current.active
    return RegionEstimate(
        p=main.p,
        p_base=main.p_base,
        n_eff=main.n_eff,
        lo=min(lo, main.p),
        hi=max(hi, main.p),
        active_now=active_now,
        p_quiet_late=late.p,
        p_clear_1h=None if clear is None else clear.p,
    )


def estimate_joint(
    predicate: Callable[[NightObservation], bool],
    nights: Sequence[NightObservation],
    target: date,
    current: CurrentState,
    required: Sequence[str],
) -> Estimate:
    """Probability of a multi-region event, counted directly on analog nights."""
    need = frozenset(required)
    return _estimate(_samples(nights, target, current, lambda n: need <= n.covered, predicate, lambda n: 1.0))
