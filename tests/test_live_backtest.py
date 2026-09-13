import unittest
from datetime import datetime, timedelta, timezone

from forecast.backtest import brier, reliability, summarize
from forecast.live import parse_live
from forecast.regions import FORECAST_REGIONS
from forecast.windows import KYIV

NOW = datetime(2026, 9, 13, 20, 0, tzinfo=timezone.utc)


def payload(active=(), cached_at="2026-09-13 22:55:00", extra=None):
    states = {name: {"alertnow": name in active, "changed": "1970-01-01 03:00:00"} for name in FORECAST_REGIONS}
    states["Луганська область"] = {"alertnow": True}
    states.update(extra or {})
    return {"states": states, "cachedat": cached_at}


class ParseLiveTest(unittest.TestCase):
    def test_counts_only_forecast_regions(self):
        snap = parse_live(payload(active=("м. Київ", "Сумська область")), NOW)
        self.assertTrue(snap.ok)
        self.assertEqual(snap.state.activity, 2)
        self.assertEqual(snap.state.active, frozenset({"м. Київ", "Сумська область"}))
        self.assertEqual(snap.as_of, datetime(2026, 9, 13, 22, 55, tzinfo=KYIV))

    def test_stale_payload_is_rejected(self):
        snap = parse_live(payload(cached_at="2026-09-13 19:00:00"), NOW)
        self.assertFalse(snap.ok)
        self.assertIsNone(snap.state.activity)

    def test_malformed_payloads_are_rejected(self):
        for bad in (None, [], {"states": []}, {"states": {"м. Київ": {"alertnow": "yes"}}, "cachedat": "2026-09-13 22:55:00"}):
            self.assertFalse(parse_live(bad, NOW).ok)


class BacktestMetricsTest(unittest.TestCase):
    def test_brier(self):
        self.assertAlmostEqual(brier([(1.0, True), (0.0, False)]), 0.0)
        self.assertAlmostEqual(brier([(0.5, True), (0.5, False)]), 0.25)

    def test_reliability_bins(self):
        rows = reliability([(0.05, False), (0.1, True), (0.95, True), (1.0, True)], bins=5)
        self.assertEqual([r["n"] for r in rows], [2, 0, 0, 0, 2])
        self.assertAlmostEqual(rows[0]["freq"], 0.5)
        self.assertIsNone(rows[2]["mean_p"])

    def test_summary_flags_trivial_cases(self):
        predictions = [(0.9, 0.5, True, True), (0.2, 0.5, False, False), (0.7, 0.5, True, False)]
        result = summarize(predictions, nights=1)
        self.assertEqual(result["open_cases"], 2)
        self.assertTrue(result["model_beats_base"])


if __name__ == "__main__":
    unittest.main()
