import random
import unittest
from datetime import date, datetime, time, timedelta, timezone

from forecast.history import History, RegionHistory
from forecast.markets import odds
from forecast.model import (
    CurrentState,
    effective_n,
    estimate_joint,
    estimate_region,
    shrink,
    weighted_quantile,
)
from forecast.observations import NightObservation, observe_nights
from forecast.timeline import Timeline
from forecast.windows import local_at

TARGET = date(2026, 9, 13)
A, B = "Одеська область", "Львівська область"


def obs(days_ago, activity, alerted=(), active=(), covered=(A, B), quiet_late=None, cleared=()):
    alerted = frozenset(alerted)
    return NightObservation(
        anchor=TARGET - timedelta(days=days_ago),
        activity=activity,
        covered=frozenset(covered),
        active=frozenset(active),
        alerted=alerted,
        quiet_late=frozenset(covered) - alerted if quiet_late is None else frozenset(quiet_late),
        cleared_1h=frozenset(cleared),
    )


class MathTest(unittest.TestCase):
    def test_shrink(self):
        self.assertAlmostEqual(shrink(3, 3, 0.5, 3), 0.75)
        self.assertAlmostEqual(shrink(0, 0, 0.2, 3), 0.2)

    def test_effective_n(self):
        self.assertAlmostEqual(effective_n([1, 1, 1, 1]), 4)
        self.assertAlmostEqual(effective_n([1, 0, 0]), 1)
        self.assertEqual(effective_n([]), 0)

    def test_odds_are_fair_and_clamped(self):
        self.assertAlmostEqual(odds(0.5), 2.0)
        self.assertAlmostEqual(odds(1.0), 1.01)
        self.assertAlmostEqual(odds(0.0001), 50.0)

    def test_weighted_quantile(self):
        self.assertEqual(weighted_quantile([1, 2, 3, 10], [1, 1, 1, 1], 0.5), 2)
        self.assertEqual(weighted_quantile([1, 2, 3, 10], [0, 0, 0, 1], 0.1), 10)


class EstimateRegionTest(unittest.TestCase):
    def setUp(self):
        self.nights = [
            obs(i, 12 if i % 2 else 2, alerted=(A,) if i % 2 else ())
            for i in range(1, 101)
        ]

    def test_conditions_on_current_national_activity(self):
        loud = estimate_region(A, self.nights, TARGET, CurrentState(12, frozenset()))
        calm = estimate_region(A, self.nights, TARGET, CurrentState(2, frozenset()))
        self.assertGreater(loud.p, 0.85)
        self.assertLess(calm.p, 0.15)
        self.assertTrue(calm.p < loud.p_base < loud.p)

    def test_unknown_live_state_falls_back_to_recency_base_rate(self):
        est = estimate_region(A, self.nights, TARGET, CurrentState(None, None))
        self.assertAlmostEqual(est.p, est.p_base, places=2)
        self.assertIsNone(est.active_now)

    def test_uncovered_nights_are_ignored(self):
        nights = [obs(i, 5, alerted=(B,), covered=(A,) if i > 3 else (A, B)) for i in range(1, 40)]
        est = estimate_region(B, nights, TARGET, CurrentState(5, frozenset()))
        self.assertGreater(est.p, 0.5)
        self.assertLessEqual(est.n_eff, 3.0001)

    def test_own_state_matters(self):
        nights = [
            obs(i, 6, alerted=(A,) if i % 2 else (), active=(A,) if i % 2 else ())
            for i in range(1, 80)
        ]
        on = estimate_region(A, nights, TARGET, CurrentState(6, frozenset({A})))
        off = estimate_region(A, nights, TARGET, CurrentState(6, frozenset()))
        self.assertGreater(on.p, off.p + 0.3)
        self.assertTrue(on.active_now)

    def test_clear_within_hour_only_from_nights_active_at_snapshot(self):
        nights = [obs(i, 6, alerted=(A,), active=(A,), cleared=(A,) if i % 4 == 0 else ()) for i in range(1, 81)]
        est = estimate_region(A, nights, TARGET, CurrentState(6, frozenset({A})))
        self.assertAlmostEqual(est.p_clear_1h, 0.25, delta=0.08)
        none_active = estimate_region(B, nights, TARGET, CurrentState(6, frozenset({B})))
        self.assertIsNone(none_active.p_clear_1h)

    def test_bootstrap_interval_brackets_estimate(self):
        est = estimate_region(A, self.nights, TARGET, CurrentState(12, frozenset()), rng=random.Random(1), resamples=200)
        self.assertLessEqual(est.lo, est.p + 1e-9)
        self.assertGreaterEqual(est.hi, est.p - 1e-9)
        self.assertLess(est.hi - est.lo, 0.5)


class EstimateJointTest(unittest.TestCase):
    def test_joint_event_uses_night_outcomes_not_product_of_marginals(self):
        nights = [obs(i, 4, alerted=(A,) if i % 2 else (B,)) for i in range(1, 101)]
        both_quiet = estimate_joint(
            lambda n: not (n.alerted & {A, B}), nights, TARGET, CurrentState(4, frozenset()), required=(A, B)
        )
        self.assertLess(both_quiet.p, 0.05)


class ObserveNightsTest(unittest.TestCase):
    def test_extracts_state_outcomes_and_coverage(self):
        anchor = date(2026, 9, 10)
        alert = (local_at(anchor, time(22, 30)), local_at(anchor, time(23, 20)))
        late = (local_at(anchor + timedelta(days=1), time(2)), local_at(anchor + timedelta(days=1), time(3)))
        covered = datetime(2026, 9, 13, tzinfo=timezone.utc)
        history = History(
            regions={
                A: RegionHistory(Timeline.from_intervals([alert, late]), covered),
                B: RegionHistory(Timeline.from_intervals([]), datetime(2026, 9, 5, tzinfo=timezone.utc)),
            },
            official_until=datetime(2026, 9, 5, tzinfo=timezone.utc),
            volunteer_until=covered,
        )
        (night,) = observe_nights(history, time(22, 40), [anchor])
        self.assertEqual(night.activity, 1)
        self.assertEqual(night.active, frozenset({A}))
        self.assertEqual(night.alerted, frozenset({A}))
        self.assertEqual(night.covered, frozenset({A}))
        self.assertNotIn(A, night.quiet_late)
        self.assertEqual(night.cleared_1h, frozenset({A}))


if __name__ == "__main__":
    unittest.main()
