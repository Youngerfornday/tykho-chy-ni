import unittest
from datetime import date, datetime, time, timedelta, timezone

from forecast.build import build, build_bundle
from forecast.regions import FORECAST_REGIONS, KYIV_CITY
from forecast.snapshots import Snapshot
from forecast.windows import local_at

NOW = datetime(2026, 9, 13, 19, 40, tzinfo=timezone.utc)  # 22:40 Kyiv


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S+00:00")


def rows_for(key, days, regions):
    rows = []
    for k in days:
        anchor = date(2026, 9, 12) - timedelta(days=k)
        start = local_at(anchor, time(22, 30))
        for region in regions:
            name = "Київ" if (key == "region" and region == KYIV_CITY) else region
            rows.append({key: name, "started_at": iso(start), "finished_at": iso(start + timedelta(hours=2))})
    return rows


class BuildTest(unittest.TestCase):
    def test_end_to_end_payload_shape(self):
        loud = [r for r in FORECAST_REGIONS if "Львів" not in r and "Закарпат" not in r]
        official = rows_for("oblast", range(6, 200, 2), loud)
        volunteer = rows_for("region", range(0, 200, 2), loud)
        live = {
            "cachedat": "2026-09-13 22:38:00",
            "states": {r: {"alertnow": r in loud[:5]} for r in FORECAST_REGIONS},
        }

        payload = build(NOW, official, volunteer, datetime(2026, 9, 13, 4, tzinfo=timezone.utc), live)

        self.assertEqual(payload["version"], 1)
        self.assertEqual(set(payload["regions"]), set(FORECAST_REGIONS))
        self.assertTrue(payload["data"]["live_ok"])
        self.assertFalse(payload["window"]["in_window"])
        for region in payload["regions"].values():
            self.assertTrue(0.0 <= region["lo"] <= region["p"] <= region["hi"] <= 1.0)
        self.assertLess(payload["regions"]["Закарпатська область"]["p"], 0.2)
        self.assertGreater(payload["regions"][KYIV_CITY]["p"], payload["regions"]["Закарпатська область"]["p"])
        self.assertTrue(all(1.01 <= m["odds_yes"] <= 50 for m in payload["markets"]))
        self.assertEqual(payload["backtest"]["nights"], 60)

    def test_bundle_has_line_results_and_snapshots(self):
        official = rows_for("oblast", range(6, 120, 2), FORECAST_REGIONS[:20])
        volunteer = rows_for("region", range(0, 120, 2), FORECAST_REGIONS[:20])
        live = {"cachedat": "2026-09-13 22:38:00", "states": {r: {"alertnow": r == KYIV_CITY} for r in FORECAST_REGIONS}}
        previous = (Snapshot(int(NOW.timestamp()) - 1800, (KYIV_CITY,)),)

        files = build_bundle(NOW, official, volunteer, datetime(2026, 9, 13, 4, tzinfo=timezone.utc), live, previous)

        self.assertEqual(set(files), {"forecast.json", "results.json", "snapshots.json"})
        forecast = files["forecast.json"]
        self.assertEqual(len(forecast["line"]["columns"]), 50)
        self.assertEqual(forecast["line"]["anchor"], forecast["window"]["anchor"])
        titles = {m["id"]: m["title"] for m in forecast["markets"]}
        self.assertRegex(titles["total_over"], r"^Тривоги у \d+\+ областях$")
        self.assertEqual(len(files["results.json"]["nights"]), 10)
        self.assertEqual([s["t"] for s in files["snapshots.json"]], [int(NOW.timestamp()) - 1800, int(NOW.timestamp())])

    def test_missing_live_data_degrades_gracefully(self):
        official = rows_for("oblast", range(6, 120, 3), FORECAST_REGIONS)
        volunteer = rows_for("region", range(0, 120, 3), FORECAST_REGIONS)
        payload = build(NOW, official, volunteer, None, None)
        self.assertFalse(payload["data"]["live_ok"])
        self.assertIsNone(payload["national"]["active_now"])

    def test_empty_dataset_fails_loudly(self):
        with self.assertRaises(ValueError):
            build(NOW, [], [], None, None)


if __name__ == "__main__":
    unittest.main()
