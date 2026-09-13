"""Betting-board presentation of probabilities: fair decimal odds, no margin."""
from __future__ import annotations

MIN_ODDS = 1.01
MAX_ODDS = 50.0


def odds(p: float) -> float:
    """Fair decimal odds 1/p, clamped to a readable range."""
    if p <= 1.0 / MAX_ODDS:
        return MAX_ODDS
    return round(min(MAX_ODDS, max(MIN_ODDS, 1.0 / p)), 2)


def market(market_id: str, title: str, p: float, n_eff: float, note: str = "") -> dict:
    p = min(1.0, max(0.0, p))
    return {
        "id": market_id,
        "title": title,
        "note": note,
        "p": round(p, 4),
        "odds_yes": odds(p),
        "odds_no": odds(1.0 - p),
        "n_eff": round(n_eff, 1),
    }
