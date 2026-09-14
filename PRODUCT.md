# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS with vanilla ES modules, published on GitHub Pages; data built by a stdlib-only Python job in GitHub Actions every 30 minutes (confirmed in the approved plan, 2026-09-13).

## Users

People in Ukraine checking in the evening or at night whether the coming night is likely to be quiet, for the whole country or their own region. Public audience; the page is shared by link and screenshot.

## Product Purpose

Answer "тихо чи ні?" for the night window 23:00-07:00 Kyiv time with calibrated probabilities per region, derived from alert history and the live alert state. Success: an honest, readable answer within seconds, and probabilities that match observed frequencies in backtests.

## Positioning

A statistical forecast, not an alert service. It shows its own calibration against a naive base rate and says plainly how small its edge is.

## Operating Context

Viewed at night, often on a phone, frequently while real alerts are active. Users also have the official alert map and apps open; this page must never be mistaken for them.

## Capabilities and Constraints

- Ukrainian interface (user decision).
- Default verdict is for all of Ukraine; regions are selected on the map (user decision).
- Visual language follows the dark alert-map palette (user brief), but without its name, logo, font, domain or watermark; the map carries a visible "ПРОГНОЗ · не офіційна тривога" mark and a snapshot time.
- Occupied regions with a standing alert (Luhansk, Crimea) are drawn but never forecast.
- Play-money game (owner decision 2026-09-14) on a separate page `/play/`: virtual chips only (1000 start, daily top-up), no deposits, payouts or prizes; state in the visitor's browser. Singles and accumulators, live until 07:00, fair odds 1/p without margin, accumulators priced on joint analog nights. Rules: docs/betting.md.
- Gamification rewards forecasting skill, not volume or risk, never late-night activity, never loss chasing; safety notes when a selected region is under alert (docs/gamification.md).
- The forecast page stays answer-first; the game is linked from it, never the loudest control in the hero.
- Win state uses green `#00B280` (from the alert map's own palette), only for won bets and unlocked rewards.
- Data sources: Vadimkin/ukrainian-air-raid-sirens-dataset (official + volunteer), ubilling.net.ua live status. Volunteer data is rejected per region when it disagrees with official data.

## Evidence on Hand

- Rolling backtest over 60 nights (Brier score vs recency base rate, reliability bins) is produced on every build.
- No testimonials, users, or accuracy claims beyond the backtest may be stated.

## Product Principles

1. Honesty over drama: show uncertainty, sample size, and the model's modest edge.
2. Never impersonate the official alert map; always label the forecast.
3. The answer first, the method one scroll away.
4. Stale data must look stale.

## Accessibility & Inclusion

Readable at 400px width in low light; color is never the only encoding (percent labels, table view); reduced motion respected.
