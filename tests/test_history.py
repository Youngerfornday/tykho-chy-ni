import unittest
from datetime import date, datetime, time, timedelta, timezone

from forecast.history import merge_sources, parse_rows
from forecast.regions import canonical_region
from forecast.windows import local_at

UTC = timezone.utc


def iso(dt):
    return dt.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S+00:00")


def row(region, start, end, key="oblast"):
    return {key: region, "started_at": iso(start), "finished_at": iso(end) if end else ""}


class CanonicalRegionTest(unittest.TestCase):
    def test_aliases_and_rejections(self):
        self.assertEqual(canonical_region("Київ"), "м. Київ")
        self.assertEqual(canonical_region(" Львівська  область "), "Львівська область")
        self.assertIsNone(canonical_region("Луганська область"))
        self.assertIsNone(canonical_region(""))


class ParseRowsTest(unittest.TestCase):
    def test_filters_normalizes_and_closes_open_rows(self):
        since = datetime(2026, 9, 1, tzinfo=UTC)
        cutoff = datetime(2026, 9, 10, tzinfo=UTC)
        rows = [
            row("Київ", datetime(2026, 9, 2, 20, tzinfo=UTC), datetime(2026, 9, 2, 21, tzinfo=UTC), "region"),
            row("Київ", datetime(2026, 8, 30, 20, tzinfo=UTC), datetime(2026, 8, 30, 21, tzinfo=UTC), "region"),
            row("Луганська область", datetime(2026, 9, 3, tzinfo=UTC), None, "region"),
            row("Одеська область", datetime(2026, 9, 9, 23, tzinfo=UTC), None, "region"),
            {"region": "Одеська область", "started_at": "garbage", "finished_at": ""},
            {"started_at": iso(datetime(2026, 9, 4, tzinfo=UTC))},
        ]
        parsed = parse_rows(rows, "region", since, cutoff)
        self.assertEqual(parsed.intervals["м. Київ"], [(datetime(2026, 9, 2, 20, tzinfo=UTC), datetime(2026, 9, 2, 21, tzinfo=UTC))])
        self.assertEqual(parsed.intervals["Одеська область"], [(datetime(2026, 9, 9, 23, tzinfo=UTC), cutoff)])
        self.assertNotIn("Луганська область", parsed.intervals)
        self.assertEqual(parsed.invalid, 2)
        self.assertEqual(parsed.latest_start, datetime(2026, 9, 9, 23, tzinfo=UTC))


def night_alert(anchor):
    start = local_at(anchor, time(23, 30))
    return start, start + timedelta(hours=1)


class MergeSourcesTest(unittest.TestCase):
    def test_low_agreement_region_keeps_official_only(self):
        since = datetime(2026, 6, 1, tzinfo=UTC)
        official_end = datetime(2026, 9, 7, 12, tzinfo=UTC)
        volunteer_end = datetime(2026, 9, 13, 4, tzinfo=UTC)
        anchors = [date(2026, 9, 6) - timedelta(days=i) for i in range(70)]
        official_rows = [row("Одеська область", *night_alert(a)) for a in anchors[::2]]
        official_rows.append(row("Львівська область", *night_alert(anchors[5])))
        volunteer_rows = [row("Одеська область", *night_alert(a), "region") for a in anchors[::2]]
        volunteer_rows += [row("Львівська область", *night_alert(a), "region") for a in anchors]
        fresh = [date(2026, 9, 10), date(2026, 9, 11)]
        volunteer_rows += [row(r, *night_alert(a), "region") for a in fresh for r in ("Одеська область", "Львівська область")]

        history = merge_sources(
            parse_rows(official_rows, "oblast", since, official_end),
            parse_rows(volunteer_rows, "region", since, volunteer_end),
            official_until=official_end,
            volunteer_until=volunteer_end,
        )

        odesa = history.regions["Одеська область"]
        lviv = history.regions["Львівська область"]
        self.assertEqual(odesa.covered_until, volunteer_end)
        self.assertTrue(odesa.timeline.overlaps(*night_alert(fresh[1])))
        self.assertEqual(lviv.covered_until, official_end)
        self.assertFalse(lviv.timeline.overlaps(*night_alert(fresh[1])))
        excluded = dict(history.excluded)
        self.assertIn("Львівська область", excluded)
        self.assertLess(excluded["Львівська область"], 0.9)
        self.assertNotIn("Одеська область", excluded)
        self.assertIn("Вінницька область", history.regions)


if __name__ == "__main__":
    unittest.main()
