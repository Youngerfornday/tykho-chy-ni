"""Build the site data: python3 -m forecast.build [--out PATH] [--cache-dir DIR] [--now ISO] [--snapshots-url URL]

Writes forecast.json to --out and results.json plus snapshots.json next to it.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, Mapping, Optional, Sequence, Tuple

from . import fetch
from .backtest import collect_predictions, summarize
from .history import History, merge_sources, parse_rows
from .line import build_line
from .live import LiveSnapshot, parse_live
from .model import RegionEstimate, estimate_region
from .national import build_markets, national_summary, region_payload
from .observations import NightObservation, observe_nights
from .regions import FORECAST_REGIONS, PERMANENT_REGIONS, WEST_REGIONS
from .results import build_results
from .snapshots import Snapshot, load_snapshots, to_json, update_snapshots
from .windows import KYIV, NightWindow, night_window

LOOKBACK_NIGHTS = 180
BACKTEST_NIGHTS = 60
BOOTSTRAP_RESAMPLES = 300
SCHEMA_VERSION = 1


def iso(moment: Optional[datetime]) -> Optional[str]:
    return None if moment is None else moment.astimezone(timezone.utc).isoformat(timespec="seconds")


@dataclass(frozen=True)
class Context:
    now: datetime
    history: History
    window: NightWindow
    nights: Tuple[NightObservation, ...]
    live: LiveSnapshot
    estimates: Mapping[str, RegionEstimate]
    national: dict
    invalid_rows: int

    @property
    def recent(self) -> Tuple[NightObservation, ...]:
        return self.nights[:LOOKBACK_NIGHTS]


def prepare(now, official_rows, volunteer_rows, volunteer_commit, live) -> Context:
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
    snapshot = parse_live(live, now)
    rng = random.Random(window.anchor.toordinal())
    recent = nights[:LOOKBACK_NIGHTS]
    estimates = {
        region: estimate_region(region, recent, window.anchor, snapshot.state, rng, BOOTSTRAP_RESAMPLES)
        for region in FORECAST_REGIONS
    }
    national = national_summary(estimates, recent, window.anchor, snapshot.state)
    return Context(now, history, window, nights, snapshot, estimates, national, official.invalid + volunteer.invalid)


def forecast_payload(ctx: Context) -> dict:
    window, history, snapshot = ctx.window, ctx.history, ctx.live
    backtest = summarize(collect_predictions(ctx.nights, BACKTEST_NIGHTS, LOOKBACK_NIGHTS), BACKTEST_NIGHTS)
    base_rates = {r: e.p_base for r, e in ctx.estimates.items()}
    return {
        "version": SCHEMA_VERSION,
        "generated_at": iso(ctx.now),
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
            "invalid_rows": ctx.invalid_rows,
            "live_ok": snapshot.ok,
            "live_reason": snapshot.reason,
            "live_as_of": iso(snapshot.as_of),
            "nights_used": len(ctx.recent),
        },
        "regions": region_payload(ctx.estimates, window.in_window),
        "permanent": list(PERMANENT_REGIONS),
        "west": list(WEST_REGIONS),
        "national": ctx.national,
        "markets": build_markets(ctx.estimates, ctx.national),
        "backtest": backtest,
        "line": build_line(ctx.recent, window.anchor, snapshot.state, ctx.now, ctx.national["total_line"], base_rates),
    }


def build(
    now: datetime,
    official_rows: Iterable[Mapping[str, str]],
    volunteer_rows: Iterable[Mapping[str, str]],
    volunteer_commit: Optional[datetime],
    live: Optional[dict],
) -> dict:
    return forecast_payload(prepare(now, official_rows, volunteer_rows, volunteer_commit, live))


def build_bundle(
    now: datetime,
    official_rows: Iterable[Mapping[str, str]],
    volunteer_rows: Iterable[Mapping[str, str]],
    volunteer_commit: Optional[datetime],
    live: Optional[dict],
    previous_snapshots: Sequence[Snapshot] = (),
) -> dict:
    ctx = prepare(now, official_rows, volunteer_rows, volunteer_commit, live)
    snapshots = update_snapshots(previous_snapshots, ctx.live, now)
    return {
        "forecast.json": forecast_payload(ctx),
        "results.json": build_results(ctx.history, snapshots, now, ctx.window.anchor),
        "snapshots.json": to_json(snapshots),
    }


def write_json(payload, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, out)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("site/data/forecast.json"))
    parser.add_argument("--cache-dir", type=Path, default=None)
    parser.add_argument("--now", type=datetime.fromisoformat, default=None)
    parser.add_argument("--snapshots-url", default=None)
    args = parser.parse_args(argv)
    now = (args.now or datetime.now(timezone.utc)).astimezone(timezone.utc)

    official = fetch.csv_rows(fetch.cached_bytes(fetch.OFFICIAL_URL, fetch.CSV_TIMEOUT, args.cache_dir), fetch.OFFICIAL_COLUMNS)
    volunteer = fetch.csv_rows(fetch.cached_bytes(fetch.VOLUNTEER_URL, fetch.CSV_TIMEOUT, args.cache_dir), fetch.VOLUNTEER_COLUMNS)
    previous = load_snapshots(args.snapshots_url, now)
    files = build_bundle(now, official, volunteer, fetch.volunteer_updated_at(), fetch.live_payload(), previous)
    write_json(files["forecast.json"], args.out)
    write_json(files["results.json"], args.out.parent / "results.json")
    write_json(files["snapshots.json"], args.out.parent / "snapshots.json")

    payload = files["forecast.json"]
    n, bt = payload["national"], payload["backtest"]
    print(
        f"[build] {payload['generated_at']} live_ok={payload['data']['live_ok']} active={n['active_now']} "
        f"expected={n['expected_regions']} west_quiet={n['p_west_quiet']} snapshots={len(files['snapshots.json'])} "
        f"brier model={bt['brier_model']} base={bt['brier_base']} open model={bt['brier_model_open']} base={bt['brier_base_open']}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
