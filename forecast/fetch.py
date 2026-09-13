"""Network access: dataset CSVs, dataset freshness, live status."""
from __future__ import annotations

import csv
import io
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator, Mapping, Optional

DATASET_REPO = "Vadimkin/ukrainian-air-raid-sirens-dataset"
RAW_BASE = f"https://raw.githubusercontent.com/{DATASET_REPO}/main/datasets"
OFFICIAL_URL = f"{RAW_BASE}/official_data_uk.csv"
VOLUNTEER_URL = f"{RAW_BASE}/volunteer_data_uk.csv"
VOLUNTEER_COMMITS_URL = (
    f"https://api.github.com/repos/{DATASET_REPO}/commits?path=datasets/volunteer_data_uk.csv&per_page=1"
)
LIVE_URL = "https://ubilling.net.ua/aerialalerts/"
USER_AGENT = "tykho-chy-ni/1.0 (+https://github.com/Youngerfornday/tykho-chy-ni)"

OFFICIAL_COLUMNS = frozenset({"oblast", "started_at", "finished_at"})
VOLUNTEER_COLUMNS = frozenset({"region", "started_at", "finished_at"})
RETRIES = 3
CSV_TIMEOUT = 120
API_TIMEOUT = 20
CACHE_MAX_AGE = timedelta(hours=3)


def log(message: str) -> None:
    print(f"[fetch] {message}", file=sys.stderr)


def fetch_bytes(url: str, timeout: int, headers: Optional[Mapping[str, str]] = None) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    last_error: Optional[Exception] = None
    for attempt in range(1, RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except OSError as error:
            last_error = error
            log(f"{url.split('?')[0]} attempt {attempt} failed: {error}")
            time.sleep(2 ** attempt)
    raise RuntimeError(f"giving up on {url.split('?')[0]}") from last_error


def cached_bytes(url: str, timeout: int, cache_dir: Optional[Path]) -> bytes:
    if cache_dir is None:
        return fetch_bytes(url, timeout)
    path = cache_dir / url.rsplit("/", 1)[-1]
    if path.exists() and datetime.now().timestamp() - path.stat().st_mtime < CACHE_MAX_AGE.total_seconds():
        return path.read_bytes()
    data = fetch_bytes(url, timeout)
    cache_dir.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return data


def csv_rows(data: bytes, required: frozenset) -> Iterator[dict]:
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
    missing = required - set(reader.fieldnames or ())
    if missing:
        raise ValueError(f"dataset is missing columns: {sorted(missing)}")
    return iter(reader)


def volunteer_updated_at() -> Optional[datetime]:
    token = os.environ.get("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json", **({"Authorization": f"Bearer {token}"} if token else {})}
    try:
        commits = json.loads(fetch_bytes(VOLUNTEER_COMMITS_URL, API_TIMEOUT, headers))
        stamp = commits[0]["commit"]["committer"]["date"]
        return datetime.fromisoformat(stamp.replace("Z", "+00:00")).astimezone(timezone.utc)
    except (RuntimeError, ValueError, KeyError, IndexError, TypeError) as error:
        log(f"dataset commit date unavailable: {error}")
        return None


def live_payload() -> Optional[dict]:
    try:
        return json.loads(fetch_bytes(LIVE_URL, API_TIMEOUT))
    except (RuntimeError, ValueError) as error:
        log(f"live status unavailable: {error}")
        return None
