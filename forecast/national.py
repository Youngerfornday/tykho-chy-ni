"""Country-wide aggregates and the betting board built from region estimates."""
from __future__ import annotations

import math
from datetime import date
from typing import Dict, List, Mapping, Sequence

from .markets import market
from .model import RegionEstimate, estimate_joint, recency, similarity, weighted_quantile
from .observations import CurrentState, NightObservation
from .regions import FORECAST_REGIONS, KYIV_CITY, WEST_REGIONS

FRONTLINE_BASE_RATE = 0.9


def _night_count(night: NightObservation, base_rates: Mapping[str, float]) -> float:
    # ponytail: regions missing from a night (volunteer data rejected) are filled with
    # their base rate, so over/under lines are slightly smoothed for the newest nights.
    missing = sum(base_rates[r] for r in FORECAST_REGIONS if r not in night.covered)
    return len(night.alerted & night.covered) + missing


def national_summary(
    estimates: Mapping[str, RegionEstimate],
    nights: Sequence[NightObservation],
    target: date,
    current: CurrentState,
) -> dict:
    base_rates = {r: estimates[r].p_base for r in FORECAST_REGIONS}
    counts = [_night_count(n, base_rates) for n in nights]
    weights = [recency(target, n) * similarity(n, current) for n in nights]
    expected = sum(estimates[r].p for r in FORECAST_REGIONS)
    line = math.floor(expected) + 0.5
    count_by_anchor = dict(zip((n.anchor for n in nights), counts))
    over = estimate_joint(lambda n: count_by_anchor[n.anchor] > line, nights, target, current, required=())
    west = estimate_joint(lambda n: not (n.alerted & set(WEST_REGIONS)), nights, target, current, required=WEST_REGIONS)
    rear = [estimates[r].p for r in FORECAST_REGIONS if estimates[r].p_base < FRONTLINE_BASE_RATE]
    return {
        "regions_total": len(FORECAST_REGIONS),
        "active_now": current.activity,
        "expected_regions": round(expected, 1),
        "expected_lo": round(weighted_quantile(counts, weights, 0.1)),
        "expected_hi": round(weighted_quantile(counts, weights, 0.9)),
        "total_line": line,
        "p_over": round(over.p, 4),
        "p_west_quiet": round(west.p, 4),
        "west_n_eff": round(west.n_eff, 1),
        "n_eff": round(over.n_eff, 1),
        "intensity": round(sum(rear) / len(rear), 4) if rear else round(expected / len(FORECAST_REGIONS), 4),
        "frontline": [r for r in FORECAST_REGIONS if estimates[r].p_base >= FRONTLINE_BASE_RATE],
    }


def build_markets(estimates: Mapping[str, RegionEstimate], national: dict) -> List[dict]:
    kyiv = estimates[KYIV_CITY]
    board = [
        market("west_quiet", "Захід тихий до 07:00", national["p_west_quiet"], national["west_n_eff"],
               "Жодної тривоги у 7 західних областях"),
        market("total_over", f"Тривоги більш ніж у {national['total_line']:g} областях", national["p_over"],
               national["n_eff"], "Тотал областей за ніч"),
    ]
    if kyiv.active_now:
        board.append(market("kyiv_clear", "Київ: відбій протягом години", kyiv.p_clear_1h or 0.0, kyiv.n_eff,
                            "Поточна тривога закінчиться до 60 хв"))
    board += [
        market("kyiv_alarm", "Київ: тривога до ранку", kyiv.p, kyiv.n_eff, "Хоча б одна тривога у вікні"),
        market("kyiv_quiet_late", "Київ: тихо з 01:00 до 07:00", kyiv.p_quiet_late, kyiv.n_eff, "Друга половина ночі"),
        market("lviv_alarm", "Львівщина: тривога до ранку", estimates["Львівська область"].p,
               estimates["Львівська область"].n_eff, "Хоча б у частині області"),
        market("odesa_alarm", "Одещина: тривога до ранку", estimates["Одеська область"].p,
               estimates["Одеська область"].n_eff, "Хоча б у частині області"),
    ]
    return board


def region_payload(estimates: Mapping[str, RegionEstimate], in_window: bool) -> Dict[str, dict]:
    def rnd(value):
        return None if value is None or (isinstance(value, float) and math.isnan(value)) else round(value, 4)

    return {
        region: {
            "p": rnd(est.p),
            "lo": rnd(est.lo),
            "hi": rnd(est.hi),
            "p_base": rnd(est.p_base),
            "n_eff": round(est.n_eff, 1),
            "active_now": est.active_now,
            "status": "ongoing" if (in_window and est.active_now) else "forecast",
            "p_quiet_late": rnd(est.p_quiet_late),
            "p_clear_1h": rnd(est.p_clear_1h),
        }
        for region, est in estimates.items()
    }
