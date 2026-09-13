import json
import unittest
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError

from forecast.live import LiveSnapshot
from forecast.observations import CurrentState
from forecast.snapshots import RETENTION, Snapshot, load_snapshots, parse_snapshots, to_json, update_snapshots

NOW = datetime(2026, 9, 13, 21, 0, tzinfo=timezone.utc)
T = int(NOW.timestamp())


def live(active, ok=True):
    state = CurrentState(len(active), frozenset(active)) if ok else CurrentState(None, None)
    return LiveSnapshot(state, ok, "ok" if ok else "stale", None)


class ParseSnapshotsTest(unittest.TestCase):
    def test_drops_malformed_entries_and_unknown_regions(self):
        payload = [
            {"t": 100, "active": ["м. Київ", "Невідома область"]},
            {"t": "x", "active": []},
            {"active": []},
            {"t": True, "active": []},
            "junk",
            {"t": 200, "active": "м. Київ"},
            {"t": 300, "active": []},
        ]
        self.assertEqual(parse_snapshots(payload), (Snapshot(100, ("м. Київ",)), Snapshot(300, ())))

    def test_non_list_payload(self):
        self.assertEqual(parse_snapshots({"t": 1}), ())
        self.assertEqual(parse_snapshots(None), ())


class LoadSnapshotsTest(unittest.TestCase):
    URL = "https://example.test/data/snapshots.json"

    def test_not_found_starts_empty(self):
        def fetch(url):
            raise HTTPError(url, 404, "Not Found", None, None)
        self.assertEqual(load_snapshots(self.URL, NOW, fetch), ())

    def test_other_failures_warn_and_start_empty(self):
        def fetch(url):
            raise URLError("offline")
        self.assertEqual(load_snapshots(self.URL, NOW, fetch), ())
        self.assertEqual(load_snapshots(self.URL, NOW, lambda url: b"{not json"), ())

    def test_success_busts_cache_and_parses(self):
        seen = []
        def fetch(url):
            seen.append(url)
            return json.dumps([{"t": T - 60, "active": ["Сумська область"]}]).encode()
        self.assertEqual(load_snapshots(self.URL, NOW, fetch), (Snapshot(T - 60, ("Сумська область",)),))
        self.assertTrue(seen[0].startswith(self.URL + "?t="))

    def test_no_url_means_no_persistence(self):
        self.assertEqual(load_snapshots(None, NOW, lambda url: self.fail("must not fetch")), ())


class UpdateSnapshotsTest(unittest.TestCase):
    def test_appends_prunes_sorts_and_replaces_same_time(self):
        old = Snapshot(T - int(RETENTION.total_seconds()) - 1, ())
        kept = Snapshot(T - 1800, ("м. Київ",))
        same_time = Snapshot(T, ("Одеська область",))
        result = update_snapshots((kept, old, same_time), live({"Сумська область", "м. Київ"}), NOW)
        self.assertEqual(result, (kept, Snapshot(T, ("Сумська область", "м. Київ"))))

    def test_live_failure_does_not_append(self):
        kept = Snapshot(T - 1800, ())
        self.assertEqual(update_snapshots((kept,), live(set(), ok=False), NOW), (kept,))

    def test_to_json(self):
        self.assertEqual(to_json((Snapshot(5, ("м. Київ",)),)), [{"t": 5, "active": ["м. Київ"]}])


if __name__ == "__main__":
    unittest.main()
