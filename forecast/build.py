"""Build site/data/forecast.json: python3 -m forecast.build [--out PATH] [--cache-dir DIR] [--now ISO]"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, Mapping, Optional

from . import fetch
from .backtest import collect_predictions, summarize
from .history import merge_sources, parse_rows
from .live import parse_live
from .model import estimate_region
from .national import build_markets, national_summary, region_payload
from .observations import observe_nights
from .regions import FORECAST_REGIONS, PERMANENT_REGIONS, WEST_REGIONS
from .windows import KYIV, night_window

LOOKBACK_NIGHTS = 180
BACKTEST_NIGHTS = 60
BOOTSTRAP_RESAMPLES = 300
SCHEMA_VERSION = 1


def iso(moment: Optional[datetime]) -> Optional[str]:
    return None if moment is None else moment.astimezone(timezone.utc).isoformat(timespec="seconds")


def build(
    now: datetime,
    official_rows: Iterable[Mapping[str, str]],
    volunteer_rows: Iterable[Mapping[str, str]],
    volunteer_commit: Optional[datetime],
    live: Optional[dict],
) -> dict:
    since = now - timedelta(days=LOOKBACK_NIGHTS + BACKTEST_NIGHTS + 10)
    official = parse_rows(official_rows, "oblast", since, now)
    volunteer = parse_rows(volunteer_rows, "region", since, now)
    if official.latest_start is None or volunteer.latest_start is None:
        raise ValueError("a dataset has no rows in the lookback period")
    volunteer_until = min(now, max(volunteer_commit or volunteer.latest_start, volunteer.latest_start))
    history = merge_sources(official, volunteer, official.latest_start, volunteer_until)

    window = night_window(now)
    clock = window.feature_time.astimezone(KYIV).time()
    anchors = [window.anchor - timedelta(days=k) for k in range(1, LOOKBACK_NIGHTS + BACKTEST_NIGHTS + 1)]
    nights = observe_nights(history, clock, anchors)
    recent = nights[:LOOKBACK_NIGHTS]
    snapshot = parse_live(live, now)
    current = snapshot.state

    rng = random.Random(window.anchor.toordinal())
    estimates = {
        region: estimate_region(region, recent, window.anchor, current, rng, BOOTSTRAP_RESAMPLES)
        for region in FORECAST_REGIONS
    }
    national = national_summary(estimates, recent, window.anchor, current)
    backtest = summarize(collect_predictions(nights, BACKTEST_NIGHTS, LOOKBACK_NIGHTS), BACKTEST_NIGHTS)

    return {
        "version": SCHEMA_VERSION,
        "generated_at": iso(now),
        "window": {
            "anchor": window.anchor.isoformat(),
            "start": iso(window.start),
            "end": iso(window.end),
            "late_start": iso(window.late_start),
            "in_window": window.in_window,
        },
        "data": {
            "official_until": iso(history.official_until),
            "volunteer_until": iso(history.volunteer_until),
            "excluded_volunteer": [{"region": r, "agreement": a} for r, a in history.excluded],
            "invalid_rows": official.invalid + volunteer.invalid,
            "live_ok": snapshot.ok,
            "live_reason": snapshot.reason,
            "live_as_of": iso(snapshot.as_of),
            "nights_used": len(recent),
        },
        "regions": region_payload(estimates, window.in_window),
        "permanent": list(PERMANENT_REGIONS),
        "west": list(WEST_REGIONS),
        "national": national,
        "markets": build_markets(estimates, national),
        "backtest": backtest,
    }


def write_json(payload: dict, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, out)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("site/data/forecast.json"))
    parser.add_argument("--cache-dir", type=Path, default=None)
    parser.add_argument("--now", type=datetime.fromisoformat, default=None)
    args = parser.parse_args(argv)
    now = (args.now or datetime.now(timezone.utc)).astimezone(timezone.utc)

    official = fetch.csv_rows(fetch.cached_bytes(fetch.OFFICIAL_URL, fetch.CSV_TIMEOUT, args.cache_dir), fetch.OFFICIAL_COLUMNS)
    volunteer = fetch.csv_rows(fetch.cached_bytes(fetch.VOLUNTEER_URL, fetch.CSV_TIMEOUT, args.cache_dir), fetch.VOLUNTEER_COLUMNS)
    payload = build(now, official, volunteer, fetch.volunteer_updated_at(), fetch.live_payload())
    write_json(payload, args.out)

    n, bt = payload["national"], payload["backtest"]
    print(
        f"[build] {payload['generated_at']} live_ok={payload['data']['live_ok']} active={n['active_now']} "
        f"expected={n['expected_regions']} west_quiet={n['p_west_quiet']} "
        f"brier model={bt['brier_model']} base={bt['brier_base']} open model={bt['brier_model_open']} base={bt['brier_base_open']}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
