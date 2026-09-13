# Тихо чи ні?

Statistical forecast of whether an air-raid alert will happen tonight (23:00-07:00 Kyiv time) in each Ukrainian region.

**This is not an alert service.** Real alerts: the official alert map and the "Повітряна тривога" app.

Live page: https://youngerfornday.github.io/tykho-chy-ni/

## How it works

- History: [Vadimkin/ukrainian-air-raid-sirens-dataset](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset). Official data is authoritative; volunteer data fills the last days only for regions where both sources agree on at least 70% of the past 60 nights.
- Live state: `ubilling.net.ua/aerialalerts`.
- Model (`forecast/model.py`): past nights observed at the same clock time are weighted by similarity of the national alert count, recency (half-life 14 days) and the region's own current state, then shrunk toward the recency-weighted base rate. Intervals come from bootstrap resampling.
- Every build runs a rolling 60-night backtest and publishes the Brier score against the base rate, plus a reliability diagram.
- Odds on the page are fair `1/p`, no margin, no money.

## Betting game

A play-money prediction game sits on top of the forecast: virtual chips only, no real money, payouts or prizes, state kept in the visitor's browser. Each build publishes a `line` block (analog-night outcome matrix, so accumulators are priced from joint outcomes rather than multiplied singles), `results.json` (alerts observed per night, used to settle bets) and `snapshots.json` (live alert states carried between builds). Contract and settlement rules: [docs/betting.md](docs/betting.md).

## Run locally

```sh
python3 -m unittest discover -s tests
python3 -m forecast.build --cache-dir .cache      # writes site/data/forecast.json
python3 -m http.server -d site 8000
```

`python3 -m forecast.geo` regenerates `site/data/map.json` (committed; not part of the scheduled build).

GitHub Actions rebuilds and deploys to Pages every 30 minutes (`.github/workflows/forecast.yml`). Python stdlib only.

Fonts (Unbounded, Onest, JetBrains Mono) are self-hosted subsets from Google Fonts, licensed under the SIL Open Font License 1.1.
