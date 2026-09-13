"""Rolling-origin backtest: forecast each past night using only earlier nights."""
from __future__ import annotations

from datetime import timedelta
from typing import Dict, List, Sequence, Tuple

from .model import estimate_region
from .observations import CurrentState, NightObservation

RELIABILITY_BINS = 5

# (predicted p, base-rate p, outcome, region was already under alert at snapshot)
Prediction = Tuple[float, float, bool, bool]


def brier(pairs: Sequence[Tuple[float, bool]]) -> float:
    return sum((p - float(y)) ** 2 for p, y in pairs) / len(pairs) if pairs else float("nan")


def reliability(pairs: Sequence[Tuple[float, bool]], bins: int = RELIABILITY_BINS) -> List[dict]:
    buckets: Dict[int, List[Tuple[float, bool]]] = {}
    for p, y in pairs:
        buckets.setdefault(min(int(p * bins), bins - 1), []).append((p, y))
    rows = []
    for i in range(bins):
        items = buckets.get(i, [])
        rows.append({
            "lo": i / bins,
            "hi": (i + 1) / bins,
            "n": len(items),
            "mean_p": round(sum(p for p, _ in items) / len(items), 4) if items else None,
            "freq": round(sum(y for _, y in items) / len(items), 4) if items else None,
        })
    return rows


def collect_predictions(nights: Sequence[NightObservation], evaluate: int, lookback: int) -> List[Prediction]:
    """`nights` must be newest first; the newest `evaluate` nights are scored."""
    predictions: List[Prediction] = []
    for index, night in enumerate(nights[:evaluate]):
        earliest = night.anchor - timedelta(days=lookback)
        past = [n for n in nights[index + 1:] if n.anchor >= earliest]
        if not past:
            continue
        current = CurrentState(night.activity, night.active)
        for region in sorted(night.covered):
            est = estimate_region(region, past, night.anchor, current)
            predictions.append((est.p, est.p_base, region in night.alerted, region in night.active))
    return predictions


def summarize(predictions: Sequence[Prediction], nights: int) -> dict:
    model = [(p, y) for p, _, y, _ in predictions]
    base = [(b, y) for _, b, y, _ in predictions]
    open_cases = [(p, b, y) for p, b, y, trivial in predictions if not trivial]
    brier_model = brier(model)
    brier_base = brier(base)
    return {
        "nights": nights,
        "cases": len(predictions),
        "brier_model": round(brier_model, 4),
        "brier_base": round(brier_base, 4),
        "brier_model_open": round(brier([(p, y) for p, _, y in open_cases]), 4),
        "brier_base_open": round(brier([(b, y) for _, b, y in open_cases]), 4),
        "open_cases": len(open_cases),
        "model_beats_base": brier_model < brier_base,
        "reliability": reliability(model),
    }
