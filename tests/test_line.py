import json
import math
import random
import unittest
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from forecast.history import History, RegionHistory
from forecast.line import CLOSES_AFTER_SECONDS, build_line, coherent_price, columns, price
from forecast.model import estimate_region
from forecast.national import national_summary
from forecast.observations import CurrentState, observe_nights
from forecast.regions import FORECAST_REGIONS, KYIV_CITY, WEST_REGIONS
from forecast.timeline import Timeline
from forecast.windows import local_at

TARGET = date(2026, 9, 13)
GENERATED = datetime(2026, 9, 13, 19, 40, tzinfo=timezone.utc)
FIXTURE = Path(__file__).parent / "fixtures" / "pricing_case.json"
UTC = timezone.utc


def synthetic_history(seed=11, nights=200):
    """Correlated nights: a shared loudness per night drives every region's chance."""
    fresh = datetime(2026, 9, 13, 4, tzinfo=UTC)
    stale = datetime(2026, 9, 7, 4, tzinfo=UTC)
    loudness = {k: random.Random(seed * 1000 + k).random() for k in range(1, nights + 1)}
    regions = {}
    for i, region in enumerate(FORECAST_REGIONS):
        rng = random.Random(seed + i)
        base = 0.04 + 0.92 * i / (len(FORECAST_REGIONS) - 1)
        intervals = []
        for k in range(1, nights + 1):
            anchor = TARGET - timedelta(days=k)
            chance = min(0.98, base * (0.4 + 1.2 * loudness[k]))
            if rng.random() < chance:
                start = local_at(anchor, time(21, 0)) + timedelta(minutes=rng.randrange(0, 600))
                intervals.append((start, start + timedelta(minutes=rng.randrange(15, 150))))
        covered = stale if region in ("Львівська область", "Волинська область") else fresh
        regions[region] = RegionHistory(Timeline.from_intervals(intervals), covered)
    return History(regions, stale, fresh)


def fixture_pieces():
    history = synthetic_history()
    anchors = [TARGET - timedelta(days=k) for k in range(1, 181)]
    nights = observe_nights(history, time(22, 40), anchors)
    return history, nights


class LineShapeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _, cls.nights = fixture_pieces()
        active = frozenset(FORECAST_REGIONS[-9:])
        cls.current = CurrentState(len(active), active)
        cls.estimates = {r: estimate_region(r, cls.nights, TARGET, cls.current) for r in FORECAST_REGIONS}
        cls.national = national_summary(cls.estimates, cls.nights, TARGET, cls.current)
        base_rates = {r: e.p_base for r, e in cls.estimates.items()}
        cls.line = build_line(cls.nights, TARGET, cls.current, GENERATED, cls.national["total_line"], base_rates)

    def test_columns_layout(self):
        cols = columns()
        self.assertEqual(len(cols), 50)
        self.assertEqual(cols[0], f"alarm|{FORECAST_REGIONS[0]}")
        self.assertEqual(cols[24], f"quiet_late|{FORECAST_REGIONS[0]}")
        self.assertEqual(cols[-2:], ["west_quiet", "total_over"])
        self.assertEqual(self.line["columns"], cols)
        self.assertEqual(self.line["regions"], list(FORECAST_REGIONS))

    def test_header_fields(self):
        line = self.line
        self.assertEqual(line["anchor"], "2026-09-13")
        self.assertEqual(line["window_start"], int(local_at(TARGET, time(23)).timestamp()))
        self.assertEqual(line["late_start"], int(local_at(TARGET + timedelta(days=1), time(1)).timestamp()))
        self.assertEqual(line["window_end"], int(local_at(TARGET + timedelta(days=1), time(7)).timestamp()))
        self.assertEqual(line["generated_at"], int(GENERATED.timestamp()))
        self.assertEqual(line["closes_after_seconds"], CLOSES_AFTER_SECONDS)
        self.assertEqual(line["total_line"], self.national["total_line"])
        self.assertEqual(len(line["active_now"]), 24)
        self.assertEqual(line["active_now"][-9:], "1" * 9)
        self.assertEqual(set(line["params"]), {"prior_strength", "own_state_mismatch"})

    def test_night_rows(self):
        self.assertEqual(len(self.line["nights"]), len(self.nights))
        lviv = FORECAST_REGIONS.index("Львівська область")
        for row in self.line["nights"]:
            self.assertEqual(len(row["y"]), 50)
            self.assertEqual(len(row["act"]), 24)
            self.assertTrue(set(row["y"]) <= set("01-"))
            self.assertTrue(set(row["act"]) <= set("01-"))
        newest = self.line["nights"][0]
        self.assertEqual(newest["act"][lviv], "-")
        self.assertEqual(newest["y"][lviv], "-")
        self.assertEqual(newest["y"][24 + lviv], "-")
        self.assertEqual(newest["y"][48], "-")
        self.assertIn(newest["y"][49], "01")

    def test_single_leg_prices_match_the_model(self):
        for region in FORECAST_REGIONS:
            est = self.estimates[region]
            self.assertAlmostEqual(price(self.line, [(f"alarm|{region}", 1)]), est.p, delta=1e-3, msg=region)
            self.assertAlmostEqual(price(self.line, [(f"quiet_late|{region}", 1)]), est.p_quiet_late, delta=1e-3, msg=region)
            self.assertAlmostEqual(price(self.line, [(f"alarm|{region}", 0)]), 1 - est.p, delta=1e-3, msg=region)
        self.assertAlmostEqual(price(self.line, [("west_quiet", 1)]), self.national["p_west_quiet"], delta=1e-3)
        self.assertAlmostEqual(price(self.line, [("total_over", 1)]), self.national["p_over"], delta=1e-3)

    def test_correlated_and_contradictory_legs(self):
        kyiv = price(self.line, [(f"alarm|{KYIV_CITY}", 1)])
        oblast = price(self.line, [("alarm|Київська область", 1)])
        both = coherent_price(self.line, [(f"alarm|{KYIV_CITY}", 1), ("alarm|Київська область", 1)])
        self.assertLessEqual(both, min(kyiv, oblast) + 1e-9)
        impossible = coherent_price(self.line, [("west_quiet", 1), (f"alarm|{WEST_REGIONS[0]}", 1)])
        self.assertAlmostEqual(impossible, 0.0)

    def test_unknown_live_state(self):
        line = build_line(self.nights, TARGET, CurrentState(None, None), GENERATED, 12.5,
                          {r: e.p_base for r, e in self.estimates.items()})
        self.assertIsNone(line["active_now"])
        self.assertTrue(all(row["s"] == 1 for row in line["nights"]))

    def test_no_covered_nights_gives_nan(self):
        line = {**self.line, "nights": [{"r": 1, "s": 1, "act": "-" * 24, "y": "-" * 50}]}
        self.assertTrue(math.isnan(price(line, [(f"alarm|{KYIV_CITY}", 1)])))


class CoherentPriceTest(unittest.TestCase):
    """The own-state factor multiplies across regions, so raw joint prices can exceed a single leg."""

    LINE = {
        "regions": ["A", "B"],
        "columns": ["alarm|A", "alarm|B", "quiet_late|A", "quiet_late|B", "west_quiet", "total_over"],
        "active_now": "00",
        "params": {"prior_strength": 3.0, "own_state_mismatch": 0.1},
        "nights": [
            {"r": 1, "s": 1, "act": "00", "y": "1100-0"},
            {"r": 1, "s": 1, "act": "01", "y": "0110-0"},
            {"r": 1, "s": 1, "act": "01", "y": "0110-0"},
        ],
    }

    def test_raw_joint_can_break_frechet_bounds(self):
        single = price(self.LINE, [("alarm|A", 1)])
        joint = price(self.LINE, [("alarm|A", 1), ("alarm|B", 1)])
        self.assertAlmostEqual(single, 1 / 3)
        self.assertAlmostEqual(joint, 2 / 4.2)
        self.assertGreater(joint, single)

    def test_coherent_price_is_clamped_to_frechet_bounds(self):
        legs = [("alarm|A", 1), ("alarm|B", 1)]
        self.assertAlmostEqual(coherent_price(self.LINE, legs), 1 / 3)
        self.assertAlmostEqual(coherent_price(self.LINE, legs[:1]), price(self.LINE, legs[:1]))

    def test_lower_bound(self):
        line = {**self.LINE, "active_now": None, "nights": [{"r": 1, "s": 1, "act": "00", "y": "1100-0"}] * 3}
        legs = [("alarm|A", 1), ("alarm|B", 1)]
        self.assertAlmostEqual(coherent_price(line, legs), 1.0)

    def test_coherence_on_realistic_line(self):
        _, nights = fixture_pieces()
        active = frozenset(FORECAST_REGIONS[::3])
        current = CurrentState(len(active), active)
        estimates = {r: estimate_region(r, nights, TARGET, current) for r in FORECAST_REGIONS}
        line = build_line(nights, TARGET, current, GENERATED, 11.5, {r: e.p_base for r, e in estimates.items()})
        for r1, r2 in zip(FORECAST_REGIONS[:-1], FORECAST_REGIONS[1:]):
            for v1 in (0, 1):
                legs = [(f"alarm|{r1}", v1), (f"quiet_late|{r2}", 1)]
                singles = [price(line, [leg]) for leg in legs]
                p = coherent_price(line, legs)
                self.assertLessEqual(p, min(singles) + 1e-12)
                self.assertGreaterEqual(p, max(0.0, sum(singles) - 1) - 1e-12)


class PricingFixtureTest(unittest.TestCase):
    def test_fixture_matches_reference_price(self):
        data = json.loads(FIXTURE.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(data["cases"]), 4)
        for case in data["cases"]:
            legs = [(key, wanted) for key, wanted in case["legs"]]
            self.assertAlmostEqual(price(data["line"], legs), case["p"], places=9, msg=case["legs"])
            self.assertAlmostEqual(coherent_price(data["line"], legs), case["p_coherent"], places=9, msg=case["legs"])


def write_fixture():
    """Regenerate tests/fixtures/pricing_case.json: python3 -m tests.test_line"""
    regions = ["Львівська область", "Волинська область", "Київська область", KYIV_CITY]
    west = regions[:2]
    history = synthetic_history(seed=3, nights=40)
    small = History({r: history.regions[r] for r in regions}, history.official_until, history.volunteer_until)
    nights = observe_nights(small, time(23, 30), [TARGET - timedelta(days=k) for k in range(1, 31)])
    current = CurrentState(2, frozenset({KYIV_CITY, "Київська область"}))
    base_rates = {r: 0.3 for r in regions}
    line = build_line(nights, TARGET, current, GENERATED, 1.5, base_rates, regions=regions, west=west)
    cases = [
        [[f"alarm|{KYIV_CITY}", 1]],
        [[f"alarm|{KYIV_CITY}", 1], ["alarm|Київська область", 1]],
        [["west_quiet", 1], ["alarm|Львівська область", 1]],
        [["total_over", 1]],
        [["alarm|Волинська область", 0], [f"quiet_late|{KYIV_CITY}", 1]],
    ]
    payload = {"line": line, "cases": [
        {"legs": legs, "p": round(price(line, [tuple(l) for l in legs]), 12),
         "p_coherent": round(coherent_price(line, [tuple(l) for l in legs]), 12)}
        for legs in cases
    ]}
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    write_fixture()
