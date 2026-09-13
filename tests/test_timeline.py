import unittest
from datetime import datetime, timedelta, timezone

from forecast.timeline import Timeline


def t(hour, minute=0, day=1):
    return datetime(2026, 9, day, hour, minute, tzinfo=timezone.utc)


class TimelineMergeTest(unittest.TestCase):
    def test_merges_overlapping_and_touching_unsorted_intervals(self):
        tl = Timeline.from_intervals([(t(5), t(6)), (t(1), t(2)), (t(2), t(3)), (t(5, 30), t(7))])
        self.assertEqual(tl.intervals(), ((t(1), t(3)), (t(5), t(7))))

    def test_drops_empty_and_inverted_intervals(self):
        tl = Timeline.from_intervals([(t(3), t(3)), (t(4), t(2)), (t(8), t(9))])
        self.assertEqual(tl.intervals(), ((t(8), t(9)),))

    def test_empty_timeline(self):
        tl = Timeline.from_intervals([])
        self.assertFalse(tl.active_at(t(1)))
        self.assertFalse(tl.overlaps(t(0), t(23)))
        self.assertIsNone(tl.end_of_active(t(1)))


class TimelineQueryTest(unittest.TestCase):
    def setUp(self):
        self.tl = Timeline.from_intervals([(t(1), t(2)), (t(5), t(7))])

    def test_active_at_is_start_inclusive_end_exclusive(self):
        self.assertTrue(self.tl.active_at(t(1)))
        self.assertTrue(self.tl.active_at(t(1, 59)))
        self.assertFalse(self.tl.active_at(t(2)))
        self.assertFalse(self.tl.active_at(t(0, 59)))
        self.assertTrue(self.tl.active_at(t(6)))

    def test_overlaps_requires_positive_intersection(self):
        self.assertTrue(self.tl.overlaps(t(1, 30), t(3)))
        self.assertTrue(self.tl.overlaps(t(0), t(9)))
        self.assertFalse(self.tl.overlaps(t(2), t(5)))
        self.assertFalse(self.tl.overlaps(t(7), t(9)))
        self.assertTrue(self.tl.overlaps(t(6, 59), t(8)))

    def test_end_of_active(self):
        self.assertEqual(self.tl.end_of_active(t(6)), t(7))
        self.assertIsNone(self.tl.end_of_active(t(3)))

    def test_clipped_hides_future(self):
        clipped = self.tl.clipped(t(6))
        self.assertEqual(clipped.intervals(), ((t(1), t(2)), (t(5), t(6))))
        self.assertFalse(clipped.overlaps(t(6), t(8)))


if __name__ == "__main__":
    unittest.main()
