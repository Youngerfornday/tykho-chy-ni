# Gamification: rules

Layer on top of the play-money betting game (docs/betting.md). Browser-only, no accounts.
Owner asked for a "wow" gamification layer on 2026-09-14 and delegated the design.

## Principles

1. Reward forecasting skill, not volume or risk. Rewards never scale with stake.
2. Never reward staying awake at night or betting everything. Nothing is tied to late-night activity; small stakes are rewarded.
3. No loss chasing: no bonus is triggered by losing.
4. Safety first: when a selected region is under alert, the slip says to take shelter first; after 00:30 the slip reminds that bets settle on their own.
5. Celebrations stay in the night-sky world: shooting star, the rooftop cat. No fireworks or explosions.

## Storage

`localStorage["tcn.profile.v1"]`:

```json
{ "version": 1, "achievements": { "first_bet": 1789593000 }, "missions": { "2026-09-13": ["early_bird"] },
  "levelRewarded": 1, "introDismissed": false }
```

Everything else (XP, level, skill, streaks, night summaries) is derived from wallet bets on every render, so it cannot drift.
Tickets gain `balanceBefore` (wallet balance right before the placement) to judge stake discipline.

## XP and levels

- Settled bet (won or lost, not void): +10 XP; won bet: additional `round(15 * log2(odds))` XP. Only the first 5 settled bets of each night count.
- Completed mission: +20 XP. Unlocked achievement: +50 XP.

| level | XP from | name |
|---|---|---|
| 1 | 0 | Новачок |
| 2 | 100 | Спостерігач |
| 3 | 300 | Аналітик |
| 4 | 700 | Синоптик |
| 5 | 1500 | Стратег |
| 6 | 3000 | Оракул |
| 7 | 6000 | Легенда ночі |

Reaching a new level credits `100 * level` chips once (`levelRewarded` tracks the highest rewarded level).

## Skill: "Ти проти лінії"

Over settled non-void bets: `actual = wins / n`, `expected = mean(1 / odds)`. Edge = `actual - expected` in percentage points.
Shown with `n`; below 10 bets the page says it is too early to judge.

## Nights and streaks

A night = settled bets sharing an anchor. Profit = payouts - stakes. A profitable night has profit > 0.
Win streak = consecutive profitable nights by anchor date (a night with no bets breaks nothing and extends nothing; consecutive means adjacent calendar anchors among nights with settled bets).

## Missions (3 per night)

Chosen deterministically from the pool by a hash of the anchor. Evaluated on placement against all bets for that anchor; reward once.

| id | title | condition | chips |
|---|---|---|---|
| early_bird | Прогноз до 23:00 | a bet placed before `window_start` | 50 |
| west_pick | Погляд на Захід | a leg on `west_quiet` or a western region | 50 |
| express2 | Зв'язані події | an express with 2+ legs | 75 |
| quiet_late | Друга половина ночі | a leg on `quiet_late` | 50 |
| cool_head | Холодна голова | a bet with stake <= 10% of `balanceBefore` | 50 |
| total | Тотал ночі | a leg on `total_over` | 50 |
| underdog | Проти течії | a bet at odds >= 3 | 75 |
| three_regions | Три області | legs on 3+ distinct regions | 75 |

## Achievements (one-time)

| id | title | condition | chips |
|---|---|---|---|
| first_bet | Перший прогноз | any bet placed | 100 |
| first_win | Перша влучність | any won bet | 100 |
| quiet_call | Тиха ніч | won bet whose picked outcome is "no alert" (alarm no, quiet_late yes, west_quiet yes) | 150 |
| express3 | Експрес-мислення | won express with 3+ legs | 300 |
| underdog_win | Проти течії | won single at odds >= 4 | 250 |
| streak3 | Три ночі поспіль | win streak >= 3 | 300 |
| sharp | Краще за лінію | >= 10 settled bets and edge >= +5 pp | 500 |
| explorer | Уся карта | legs on >= 12 distinct regions overall | 200 |
| cool_head | Холодна голова | 7 distinct nights with bets, none above 25% of `balanceBefore` | 300 |
| flawless_night | Бездоганна ніч | a closed night with 3+ settled bets, all won (skill, independent of stake) | 250 |
| week | Тиждень прогнозів | bets on 7 distinct nights | 300 |

## Events and UI

- The game lives on `/play/`; the forecast page only shows a read-only line teaser with tonight's missions and links into the game (`?market=<key>&pick=<yes|no>`, `?region=<name>`).
- Store emits `mission`, `achievement`, `levelUp` events; toasts show them (at most two at a time, never over the coupon or tab bar); the sky strip plays a shooting star on wins, achievements and level-ups (reduced motion: none).
- Screens: Лінія (missions carousel, featured markets, list or map view, macro-region filters), Купон (singles or express, stake and payout next to the action), Мої ставки (bets, night summaries, "Поділитися" PNG card led by accuracy against the line, always marked as a play-money forecast game, not an alert), Прогрес (level, skill against the line, streaks, achievements, missions).
- Stake shortcuts never offer the whole balance; the largest shortcut is 10% of the balance.
- First visit shows a dismissible three-card "Як грати" in the line screen, not a modal.
