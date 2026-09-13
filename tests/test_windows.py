import unittest
from datetime import date, datetime, timedelta

from forecast.windows import KYIV, analog_window, night_window


def kyiv(y, m, d, hh, mm=0):
    return datetime(y, m, d, hh, mm, tzinfo=KYIV)


class NightWindowTest(unittest.TestCase):
    def test_evening_before_night_targets_upcoming_night(self):
        w = night_window(kyiv(2026, 9, 13, 22, 40))
        self.assertEqual(w.anchor, date(2026, 9, 13))
        self.assertFalse(w.in_window)
        self.assertEqual(w.start, kyiv(2026, 9, 13, 23))
        self.assertEqual(w.end, kyiv(2026, 9, 14, 7))
        self.assertEqual(w.feature_time, kyiv(2026, 9, 13, 22, 40))

    def test_daytime_targets_tonight(self):
        w = night_window(kyiv(2026, 9, 13, 12, 0))
        self.assertEqual(w.anchor, date(2026, 9, 13))
        self.assertEqual(w.start, kyiv(2026, 9, 13, 23))

    def test_after_midnight_belongs_to_previous_evening(self):
        w = night_window(kyiv(2026, 9, 14, 2, 15))
        self.assertEqual(w.anchor, date(2026, 9, 13))
        self.assertTrue(w.in_window)
        self.assertEqual(w.start, kyiv(2026, 9, 14, 2, 15))
        self.assertEqual(w.end, kyiv(2026, 9, 14, 7))

    def test_late_evening_inside_window_starts_now(self):
        w = night_window(kyiv(2026, 9, 13, 23, 30))
        self.assertTrue(w.in_window)
        self.assertEqual(w.start, kyiv(2026, 9, 13, 23, 30))
        self.assertEqual(w.end, kyiv(2026, 9, 14, 7))

    def test_accepts_utc_input(self):
        from datetime import timezone
        w = night_window(datetime(2026, 9, 13, 19, 40, tzinfo=timezone.utc))
        self.assertEqual(w.feature_time, kyiv(2026, 9, 13, 22, 40))

    def test_dst_fall_back_night_is_nine_hours_long(self):
        w = night_window(kyiv(2026, 10, 24, 20, 0))
        self.assertEqual(w.end - w.start, timedelta(hours=9))

    def test_rejects_naive_datetime(self):
        with self.assertRaises(ValueError):
            night_window(datetime(2026, 9, 13, 22, 40))


class AnalogWindowTest(unittest.TestCase):
    def test_same_clock_time_on_past_evening(self):
        w = analog_window(date(2026, 9, 1), kyiv(2026, 9, 13, 22, 40).timetz())
        self.assertEqual(w.feature_time, kyiv(2026, 9, 1, 22, 40))
        self.assertEqual(w.start, kyiv(2026, 9, 1, 23))
        self.assertEqual(w.end, kyiv(2026, 9, 2, 7))

    def test_small_hours_map_to_next_calendar_day(self):
        w = analog_window(date(2026, 9, 1), kyiv(2026, 9, 14, 2, 15).timetz())
        self.assertEqual(w.feature_time, kyiv(2026, 9, 2, 2, 15))
        self.assertEqual(w.start, w.feature_time)

    def test_late_split_is_one_am_or_later(self):
        evening = analog_window(date(2026, 9, 1), kyiv(2026, 9, 13, 22, 40).timetz())
        self.assertEqual(evening.late_start, kyiv(2026, 9, 2, 1))
        small_hours = analog_window(date(2026, 9, 1), kyiv(2026, 9, 14, 3, 0).timetz())
        self.assertEqual(small_hours.late_start, small_hours.start)


if __name__ == "__main__":
    unittest.main()
