# Betting game: data contract and rules

Play-money prediction game on top of the overnight forecast. No real money, deposits, payouts or prizes.
State lives only in the visitor's browser (localStorage). Decisions confirmed by the owner on 2026-09-14:
browser storage, live betting until 07:00, singles and accumulators (express), 1000 chips with a daily top-up.

## Times

All times are Europe/Kyiv wall clock, serialized as UTC epoch seconds in JSON.
For night anchor `A` (the evening date): `window_start` = A 23:00, `late_start` = A+1 01:00, `window_end` = A+1 07:00.
The current line belongs to `night_window(now).anchor` (between 07:00 and 23:00 that is the coming night).

A bet placed at `placed_at` only counts events from `max(placed_at, window_start)` (quiet-late markets: `max(placed_at, late_start)`) until `window_end`.
Events before placement never count, so betting on an alert that already happened cannot win.

## Markets

| key | pick `yes` | pick `no` |
|---|---|---|
| `alarm|<region>` | any alert in the region during the bet window | none |
| `quiet_late|<region>` | no alert in the region from `max(placed_at, late_start)` to `window_end` | at least one |
| `west_quiet` | no alert in any of the 7 western regions during the bet window | at least one |
| `total_over` | more than `line` regions have an alert during the bet window | `line` or fewer |

`<region>` is a canonical name from `forecast/regions.py` `FORECAST_REGIONS`. `total_over` bets store the `line` they were placed at.

## forecast.json: `line` block

```json
"line": {
  "anchor": "2026-09-13",
  "window_start": 1789588800,
  "late_start": 1789596000,
  "window_end": 1789617600,
  "generated_at": 1789592975,
  "closes_after_seconds": 3300,
  "total_line": 12.5,
  "regions": ["Вінницька область", "..."],
  "active_now": "0010...",
  "columns": ["alarm|Вінницька область", "...", "quiet_late|Вінницька область", "...", "west_quiet", "total_over"],
  "nights": [{ "r": 0.9517, "s": 0.3679, "act": "0010-...", "y": "10-1..." }],
  "params": { "prior_strength": 3.0, "own_state_mismatch": 0.1 }
}
```

- `regions` is `FORECAST_REGIONS` order; `columns` is 24 `alarm|`, then 24 `quiet_late|` in the same order, then `west_quiet`, `total_over`.
- `active_now`: one char per region, `1` under alert at snapshot, `0` not; the whole field is `null` when live data is unavailable.
- `nights`: the analog nights used by the model (newest first). `r` recency weight, `s` similarity weight (already includes the national-activity kernel; `1` when live data is unknown), `act` per-region state at the snapshot clock time (`1`/`0`, `-` not covered), `y` per-column outcome (`1` event happened, `0` did not, `-` not covered). Numbers rounded to 4 decimals.
- `total_over` column uses the current `total_line`; `west_quiet` is `-` unless all 7 western regions are covered.

### Pricing (must match `forecast/model.py`)

For a set of legs (column index `c_i`, wanted value `v_i` in {1, 0}):

1. Keep nights where every `y[c_i]` is not `-`.
2. `hit` = every `y[c_i] == v_i`.
3. `own` = product over distinct regions referenced by region legs of (`1` if `act[region] == active_now[region]` else `own_state_mismatch`); `1` when `active_now` is null or `act` is `-`.
4. `w = r * s * own`; `p_base = sum(r * hit) / sum(r)`; `p = (sum(w * hit) + k * p_base) / (sum(w) + k)` with `k = prior_strength`.
5. Accumulators only: clamp `p` to the Frechet bounds of the single-leg prices `p_i`: `[max(0, sum(p_i) - (n - 1)), min(p_i)]`. Own-state weights multiply across regions, so the raw joint estimate can otherwise exceed a single leg (`forecast/line.py` `coherent_price`).
6. Odds = `1 / p` rounded to 2 decimals, clamped to `[1.01, 50]` for singles and `[1.01, 100]` for accumulators.

A single leg is priced by the same formula, so single odds and a one-leg accumulator agree.
A selection is suspended when its `p < 0.015` or `p > 0.985`. An accumulator is impossible when its `p < 0.005`.

## results.json

```json
{
  "version": 1,
  "generated_at": 1789600000,
  "nights": {
    "2026-09-13": {
      "window_start": 1789588800, "late_start": 1789596000, "window_end": 1789617600,
      "regions": {
        "м. Київ": { "yes_known_until": 1789600000, "no_known_until": 1789560000, "alerts": [[1789590000, 1789592400]] }
      }
    }
  }
}
```

- Last 10 nights, including the current one.
- `alerts`: intervals overlapping `[window_start, window_end]`, clipped to it. Sources: trusted dataset intervals, plus live snapshots (a region seen under alert at snapshot time `t` adds `[t, t + 60]`).
- `no_known_until`: until when the absence of alerts is certain. Equals the region's dataset coverage (`covered_until`). For regions whose volunteer data is rejected, it is the volunteer coverage when the volunteer data shows no alert in the night window (it over-reports there, so its silence is reliable), otherwise the official coverage.
- `yes_known_until`: generation time (alerts observed so far are final evidence).

## Settlement (client)

`TOLERANCE = 900` seconds. For a leg with bet window `[b, window_end]`:

- An alert interval overlapping the window is proof that the event happened: `alarm yes` wins, `alarm no` loses, `quiet_late yes` loses, `west_quiet yes` loses, `total_over` over wins once the count of regions with proof exceeds `line`.
- Absence is proven only when `no_known_until >= window_end - TOLERANCE` for every region the leg needs (`total_over`: all 24).
- A leg still open 10 days after `window_end` is void.
- Single: won pays `stake * odds`, lost pays 0, void refunds stake.
- Accumulator: lost if any leg lost; won when all legs won; void if any leg void and none lost (stake refunded).

## Live snapshots persistence

The scheduled build downloads the currently deployed `data/snapshots.json`, appends the current live state `{ "t": epoch, "active": [regions] }` when live data is ok, drops entries older than 11 days, and publishes it again. A 404 starts an empty list; any other failure logs a warning and continues with an empty list (snapshots only speed up `yes` settlement).

## Wallet (localStorage `tcn.wallet.v1`)

```json
{ "version": 1, "balance": 1000, "bonusDay": "2026-09-14", "bets": [
  { "id": "b-...", "placedAt": 1789593000, "anchor": "2026-09-13", "kind": "single", "stake": 100, "odds": 2.1,
    "legs": [{ "key": "alarm|м. Київ", "pick": "yes", "line": null, "odds": 2.1 }],
    "status": "pending", "settledAt": null, "payout": 0 }
] }
```

- Start balance 1000. Daily top-up: on the first visit of a Kyiv calendar day, if balance is below 1000 it is raised to 1000.
- Stake is an integer from 10 to the current balance. Accumulators take 2-6 legs from the same night, one pick per market.
- The line is closed when `now - generated_at > closes_after_seconds` or `now >= window_end`.
- If odds change between adding a selection and placing, the slip shows the change and requires accepting the new odds.
