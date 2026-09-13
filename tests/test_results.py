import unittest
from datetime import date, datetime, time, timedelta, timezone

from forecast.history import History, RegionHistory
from forecast.results import RESULT_NIGHTS, build_results
from forecast.snapshots import Snapshot
from forecast.timeline import Timeline
from forecast.windows import local_at

UTC = timezone.utc
ANCHOR = date(2026, 9, 13)
PREV = ANCHOR - timedelta(days=1)
NOW = datetime(2026, 9, 13, 23, 30, tzinfo=UTC)
OFFICIAL_UNTIL = datetime(2026, 9, 7, 5, tzinfo=UTC)
VOLUNTEER_UNTIL = datetime(2026, 9, 13, 4, tzinfo=UTC)
KYIV, LVIV = "м. Київ", "Львівська область"


def ep(moment):
    return int(moment.timestamp())


def history():
    kyiv = Timeline.from_intervals([
        (local_at(PREV, time(22, 30)), local_at(PREV, time(23, 30))),
        (local_at(ANCHOR, time(7, 30)), local_at(ANCHOR, time(8, 0))),
    ])
    lviv_volunteer = Timeline.from_intervals([(local_at(PREV, time(23, 40)), local_at(PREV, time(23, 55)))])
    return History(
        regions={
            KYIV: RegionHistory(kyiv, VOLUNTEER_UNTIL),
            LVIV: RegionHistory(Timeline.from_intervals([]), OFFICIAL_UNTIL),
        },
        official_until=OFFICIAL_UNTIL,
        volunteer_until=VOLUNTEER_UNTIL,
        excluded=((LVIV, 0.283),),
        volunteer_timelines={LVIV: lviv_volunteer},
    )


class BuildResultsTest(unittest.TestCase):
    def setUp(self):
        snapshots = (
            Snapshot(ep(local_at(ANCHOR, time(2, 0))), (KYIV,)),  # inside the previous night's window
            Snapshot(ep(local_at(ANCHOR + timedelta(days=1), time(6, 59, 30))), (KYIV,)),
            Snapshot(ep(local_at(ANCHOR, time(12, 0))), (KYIV,)),
        )
        self.results = build_results(history(), snapshots, NOW, ANCHOR)

    def test_envelope(self):
        self.assertEqual(self.results["version"], 1)
        self.assertEqual(self.results["generated_at"], ep(NOW))
        self.assertEqual(len(self.results["nights"]), RESULT_NIGHTS)
        self.assertIn("2026-09-13", self.results["nights"])
        self.assertIn("2026-09-04", self.results["nights"])
        night = self.results["nights"]["2026-09-13"]
        self.assertEqual(night["window_start"], ep(local_at(ANCHOR, time(23))))
        self.assertEqual(night["late_start"], ep(local_at(ANCHOR + timedelta(days=1), time(1))))
        self.assertEqual(night["window_end"], ep(local_at(ANCHOR + timedelta(days=1), time(7))))

    def test_dataset_intervals_are_clipped_to_the_window(self):
        kyiv = self.results["nights"][PREV.isoformat()]["regions"][KYIV]
        start = ep(local_at(PREV, time(23)))
        self.assertEqual(kyiv["alerts"][0], [start, ep(local_at(PREV, time(23, 30)))])
        self.assertEqual(kyiv["yes_known_until"], ep(NOW))
        self.assertEqual(kyiv["no_known_until"], ep(VOLUNTEER_UNTIL))

    def test_snapshot_points_become_short_alerts(self):
        prev_kyiv = self.results["nights"][PREV.isoformat()]["regions"][KYIV]["alerts"]
        t = ep(local_at(ANCHOR, time(2, 0)))
        self.assertIn([t, t + 60], prev_kyiv)
        tonight = self.results["nights"][ANCHOR.isoformat()]["regions"][KYIV]["alerts"]
        late = ep(local_at(ANCHOR + timedelta(days=1), time(6, 59, 30)))
        self.assertEqual(tonight, [[late, ep(local_at(ANCHOR + timedelta(days=1), time(7)))]])

    def test_rejected_volunteer_region_uses_volunteer_silence_only(self):
        loud_night = self.results["nights"][PREV.isoformat()]["regions"][LVIV]
        quiet_night = self.results["nights"][(PREV - timedelta(days=1)).isoformat()]["regions"][LVIV]
        self.assertEqual(loud_night["no_known_until"], ep(OFFICIAL_UNTIL))
        self.assertEqual(loud_night["alerts"], [])
        self.assertEqual(quiet_night["no_known_until"], ep(VOLUNTEER_UNTIL))

    def test_only_known_regions_are_listed(self):
        self.assertEqual(set(self.results["nights"]["2026-09-13"]["regions"]), {KYIV, LVIV})


if __name__ == "__main__":
    unittest.main()
