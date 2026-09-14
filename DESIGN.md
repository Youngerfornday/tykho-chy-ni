---
name: Тихо чи ні?
description: A night-sky alert-forecast page and its play-money betting game, both in the alert map's own dark visual language.
colors:
  bg: "#141921"
  bg-deep: "#0f131a"
  panel: "#2A2D31"
  panel-soft: "#1c2129"
  line: "#3f4246"
  ink: "#EEE9E3"
  ink-2: "#c2c2c2"
  muted: "#989ba0"
  region: "#3B4351"
  bin-0: "#3B4351"
  bin-1: "#8A6A45"
  bin-2: "#E6B20E"
  bin-3: "#D45B50"
  bin-4: "#91322b"
  perm: "#7e2b25"
  perm-hatch: "#a53931"
  yellow: "#E6B20E"
  yellow-soft: "#E5CD40"
  red: "#D45B50"
  win-green: "#00B280"
  win-green-soft: "#3fd1a4"
  lost-soft: "#ef8a80"
typography:
  display:
    fontFamily: "Unbounded, 'Arial Black', sans-serif"
    fontSize: "clamp(2.9rem, 9vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Unbounded, 'Arial Black', sans-serif"
    fontSize: "clamp(1.5rem, 3.4vw, 2.4rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Onest, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "0.95rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
rounded:
  xs: "3px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  section: "clamp(48px, 8vw, 104px)"
components:
  button-primary:
    backgroundColor: "{colors.yellow}"
    textColor: "#141921"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.yellow-soft}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  odds-tile:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.yellow-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  odds-tile-active:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.bg}"
---

# Design System: Тихо чи ні?

## Overview

**Creative North Star: "The Alert Map's Own Language"**

The system reads like the official Ukrainian air-raid alert map the audience already has open: a dark night ground, flat oblast shapes that shift from calm grey through brown, yellow, red to dark red by chance, square legend chips, and mono digits wherever a number is being measured. It borrows that visual grammar deliberately and only that — never the map's name, logo, font, domain or watermark. A single fixed label, "ПРОГНОЗ · не офіційна тривога," is pinned onto every surface that could otherwise be mistaken for the real thing (the map watermark, the play app's sky strip). The forecast page (`site/index.html`) and the play-money betting app (`site/play/index.html`) share one token set, one panel material and one type system; the game is a second room in the same house, phone-first where the forecast page is desktop-first.

The page is built to be read fast, in the dark, often with a real alert active: the verdict is one giant headline before any chart, uncertainty is stated in the same sentence as the number, and the one accent color (yellow) is spent on odds and the primary action, not decoration. The game layers XP, missions, streaks and badges on top without ever raising the emotional volume past the forecast page's own register — rewards celebrate with a shooting star and the rooftop cat over Kyiv's skyline, never fireworks, and nothing about the celebration or its color scales with stake or risk.

**Key Characteristics:**
- Dark, cool, flat — one warm accent (yellow) and one meaning-locked accent (win green), both spent narrowly.
- Three-typeface split by function, not decoration: display for verdicts and headings, UI sans for prose, mono strictly for numbers that are "live" (odds, balance, clocks, counts).
- No cards floating on shadows: depth comes from tonal steps (`bg` → `panel` → `panel-soft`/`bg-deep`) and 1px rules, not elevation.
- Square legend chips everywhere a category or bin needs a swatch; round pills are reserved for counts and status badges.
- One motion signature per surface: the exponential ease-out on the forecast page, the split-flap odds roll and shooting-star celebration in the game — both fully disabled under reduced motion.

## Colors

A cool, near-black night palette with two accents kept scarce and single-purpose: yellow for odds/action, green locked to wins only.

### Primary
- **Alert Yellow** (`#E6B20E`, `--yellow`) / **Alert Yellow Soft** (`#E5CD40`, `--yellow-soft`): the only warm accent. Used for odds values, the primary CTA (`btn--primary`, `board__play`), active/pressed states (`aria-pressed="true"` on odds tiles, segmented controls), focus rings, the skip link, the stale-data banner, and the highest alert-probability bin (`bin-2`, `#E6B20E`, reused deliberately — see the Bin/Odds Overlap rule below).

### Secondary
- **Win Green** (`#00B280`) / **Win Green Soft** (`#3fd1a4`): reserved exclusively for won bets and unlocked rewards — the achievement badge check icon, `badge--won`, `bet__leg--won`, `night--won` profit figures, `vs__value--good`. It is not declared as a root custom property (unlike every other color); it is intentionally scoped only to `site/css/bet.css` and `site/css/play.css`, the two files that render settlement outcomes.
- **Lost/Alarm Red** (`#D45B50`, `--red`) / **Lost Soft** (`#ef8a80`): the loss/alarm counterpart — `bin-3`, `badge--lost`, `bet__leg--lost`, the live-alert indicator dot (`.live`).

### Tertiary
- **Bin Scale** (`--bin-0` `#3B4351` → `--bin-1` `#8A6A45` → `--bin-2` `#E6B20E` → `--bin-3` `#D45B50` → `--bin-4` `#91322b`): the five-step chance-of-alert scale shared by the region map fill, the 24-square hero strip, the map legend, and the game's featured-market meters. `--perm`/`--perm-hatch` (`#7e2b25`/`#a53931`) render occupied, permanently-alerted regions as a diagonal hatch, never a forecast color.

### Neutral
- **Night Ground** (`#141921`, `--bg`) / **Deep Ground** (`#0f131a`, `--bg-deep`): page background and the "sunk" surface for tables, inputs and the sky strip.
- **Panel** (`#2A2D31`, `--panel`) / **Panel Soft** (`#1c2129`, `--panel-soft`): the one elevated surface step, used for every card, tile and popover.
- **Rule** (`#3f4246`, `--line`): the single 1px border color used everywhere a division is needed.
- **Ink** (`#EEE9E3`, `--ink`) / **Ink 2** (`#c2c2c2`, `--ink-2`) / **Muted** (`#989ba0`, `--muted`): primary text, secondary text, and captions/labels respectively.

### Named Rules
**The Win-Green Rule.** `#00B280` and its soft variant appear only on a won bet, an unlocked achievement, or a profitable night. Never as a generic success color, hover state, or decoration — PRODUCT.md states this explicitly and the CSS honors it: the token isn't even promoted to `:root`.

**The Bin/Odds Overlap Rule.** `--yellow` and `--bin-2` share the same hex (`#E6B20E`) by construction: the "yellow" that means "primary action / live number" is the same yellow that means "40–70% chance of alert" on the map. The two roles never collide on one element — the map/strip only ever uses bin color as a fill, never as a button background — but a new component must not casually reuse `--bin-2` as an accent color; use `--yellow` by name for actions.

## Typography

**Display Font:** Unbounded (with Arial Black, sans-serif fallback)
**Body Font:** Onest (with Segoe UI, system-ui fallback)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, SF Mono, Menlo fallback)

**Character:** A geometric, slightly blocky display face for verdicts and headings against a restrained humanist sans for reading text; mono is never used as a UI voice, only as an instrument readout.

### Hierarchy
- **Display** (800, `clamp(2.9rem, 9vw, 6rem)`, line-height 0.96, letter-spacing -0.035em): the hero verdict only — the single largest thing on either surface.
- **Headline** (700, `clamp(1.5rem, 3.4vw, 2.4rem)`, line-height 1.1): section `h2`s, panel titles (`.panel__head h3`), screen titles in the game (`.screen__title`), wordmarks.
- **Title** (700, `~1rem–1.35rem`, line-height 1.15–1.3): card/component titles — mission titles, level name, market row titles, achievement titles.
- **Body** (400–600, 0.85rem–1rem, line-height 1.4–1.55, max ~46–78ch): lede paragraphs, disclaimers, mission hints, notes.
- **Label/Mono** (500–700, 0.7rem–2.6rem, tabular figures): odds values, chip balance, countdown clock, region map percentages, stat tiles, table numeric columns, badge counts. `body { font-variant-numeric: tabular-nums }` is set globally so any inline digit in body text also aligns.

### Named Rules
**The Mono-Is-An-Instrument Rule.** JetBrains Mono renders only live/measured numbers: odds, chip balance, the coupon total, the countdown clock, map percentages, table figures, badge/tab counts. Prose, labels and button text stay in Onest or Unbounded even when they contain a number (e.g. "Три області" is UI type, not mono).

## Layout

Both surfaces share `--gutter: max(16px, env(safe-area-inset-left), 3vw)` as the side margin and a `.wrap`/`max-width: 1280px` container on the forecast page.

**Forecast page** (`site/index.html`): a single scrolling document — full-bleed night-sky hero (min-height `min(82svh, 740px)`) with a left text column and the skyline peeking below, then a map section (`.mapframe`: canvas + sticky 320px region panel, legend below), a betting-line teaser board, and a method/calibration section. Below 720px the hero legibility wash flips from a horizontal to a vertical gradient and the 24-square strip drops from 24 to 12 columns; below 1100px the map's sticky side panel stacks under the canvas; below 860px the method grid stacks to one column.

**Play app** (`site/play/index.html`): a phone-first fixed-height flex shell (`height: 100dvh`, `overflow: hidden`) — top bar (56px), sky strip (164px, cropped to frame the rooftop cat on phones under 700px), a scrolling `.main` region, and a bottom tab bar (60px + safe-area) for four routes (Лінія, Купон, Мої ставки, Прогрес). At `min-width: 1024px` the tab bar disappears and the shell becomes three columns: a 264px level/missions rail, a flexible center column for Line/Progress, and a 400px sticky side column with its own tab strip for Coupon/Bets — the coupon's sticky footer (stake, payout, CTA) stays anchored to the bottom of whichever column it's in at every width.

## Elevation & Depth

Flat by default. Depth comes from a three-step tonal ladder (`--bg`/`--bg-deep` sunk → `--panel` resting → nothing raised further) plus 1px `--line` rules — never from box-shadow on a resting surface. The only two floating elements in the whole system get a soft shadow because they sit above content rather than in the flow: the map/table **tooltip** (`0 10px 28px rgba(0,0,0,0.45)`) and **toast** notifications (`0 14px 34px -10px rgba(0,0,0,0.75)`). A single small shadow also marks the map's probability-band marker (`0 1px 4px rgba(0,0,0,0.5)`) so it reads as a pin, not a fill.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45)`): tooltip only.
- **Toast** (`box-shadow: 0 14px 34px -10px rgba(0, 0, 0, 0.75)`): toast notifications only.

### Named Rules
**The Flat-Panel Rule.** Cards, tiles and panels never carry a shadow; a 1px `--line` border plus a tonal background step is the only separation device on a resting surface.

## Shapes

Two radius families by role: an 8–14px scale for panels/cards/controls, and a hard-square (3px) chip for every legend/category swatch (`.chip`, `.chip--mission`, `.chip--perm`, `.dot`), which reads as data notation rather than UI chrome. Round/pill shapes (`border-radius: 999px`) are reserved for counters and status: the balance pill, filter chips (`fchip`), tab/coupon count badges, achievement-unlock circles. Borders are uniformly 1px `--line` (2–3.4px on map focus/selection rings and the split-flap-adjacent probability marker). The map itself uses genuinely irregular oblast silhouettes (SVG paths) — the one place the system departs from geometric shapes, because the shape *is* the content.

## Components

### Buttons
- **Shape:** 10px radius (`--btn` / `.btn`), 52px min-height, full-width by default; `.btn--auto` for inline 44px auto-width variants.
- **Primary:** `--yellow` background, `#141921` text — the one filled action color in the system, used for "place bet," "play the line," and CTAs.
- **Ghost:** transparent with a `--line` border, `--ink` text; used for secondary actions (Мої ставки, До лінії).
- **Accept:** transparent with a `--yellow` border and `--yellow-soft` text — a distinct third state for "accept new odds" after a price moved under the user.
- **Hover/Focus:** background/border transition over 160ms with the shared `--ease-out` curve; `:focus-visible` gets a 2px `--yellow` outline with 3px offset everywhere (global rule in `tokens.css`).

### Odds tiles
The signature interactive unit, shared verbatim between the forecast board and the game (`.odds` is defined near-identically in `board.css` and `bet.css`). Flat panel-material tile (`--panel` bg, `--line` border, 8px radius); label in small caps mono-adjacent Onest, value in `--yellow-soft` JetBrains Mono. Selected state (`aria-pressed="true"`) inverts to a solid `--yellow` fill with `--bg` text — "odds tiles turning yellow as they enter the coupon" is the play app's named signature interaction. Suspended markets (`--off`) get a dashed border and muted value instead of being hidden.

### Chips / Legend
- **Style:** 14×14px square, 3px radius, solid fill — no border, no text inside; always paired with a text label.
- **Roles:** bin color (map/strip/legend), `--yellow` (mission dot "on"), `--region` (dot "off"), `--red` (live/danger dot), diagonal hatch (`--perm`/`--perm-hatch`) for occupied-territory legend rows, and an inset-ring "pulse" chip for "alert right now."

### Cards / Containers
- **Corner Style:** 12px for most cards (mission, achievement, night summary, feat/market card, level card); 10px for smaller interactive rows (leg, express block); 14px for the board table container.
- **Background:** `--panel` on `--bg`, or `--panel-soft`/`--bg-deep` when a card needs to read as "sunk" relative to a surrounding panel (calibration figure, coupon input, note--sleep).
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px `--line` always.
- **Internal Padding:** 12–20px depending on density (12–14px for compact mission/achievement cards, 16–20px for the map's region panel and level card).

### Inputs / Fields
- **Style:** `--bg-deep` fill, 1px `--line` border, 8px radius; the region `<select>` uses a custom SVG chevron rather than the native arrow to stay on-palette.
- **Focus:** border color shifts to `--yellow`; the stake input additionally sets `caret-color: var(--yellow)`.
- **Disabled/Off:** dashed border + muted text (`.odds--off`, `.seg__opt:disabled`).

### Navigation
- **Forecast page:** a single wordmark + snapshot-time bar; in-page anchors only (`#board`, `#map`).
- **Play app tab bar (phone):** 4 icon+label tabs, `role="tablist"`, active tab gets `--yellow-soft` text and a 2px `--yellow` underline; arrow-key roving focus is wired in `shell.js`. A round `--yellow` count badge appears on the Coupon tab once it has selections.
- **Play app side tabs (desktop ≥1024px):** the same Coupon/Bets pair reappears as an underlined tab strip inside the sticky 400px side column, replacing the bottom bar.

### Map (signature component)
Oblast SVG paths fill by bin color with a 700ms color transition on data refresh; a dashed `--ink` focus ring traces the focused shape, a solid `--yellow-soft` ring traces the selected one, and a pulsing `--ink` outline (2.6s ease-in-out) marks regions under alert right now. A fixed watermark group (`ПРОГНОЗ` / `не офіційна тривога` / snapshot time) is burned into the SVG itself, not overlaid in HTML, so it cannot be cropped out by a screenshot. Occupied/permanently-alerted regions render as a 45°, 7px diagonal hatch and are never clickable or colored by forecast.

### Coupon (signature component)
A two-part layout — scrollable `body` (mode switch, leg list, express note) and a sticky `footer` (stake stepper + quick-stake chips + totals + primary CTA) that never separates from the action, mirroring how a real betting slip keeps price and confirm together. Legs animate in (`leg-in`, 320ms ease-out) and show a directional "was" indicator (green up-arrow / red down-arrow) when a price moved since the leg was added.

### Toasts
Fixed top-right (top-left/right on phones), max 2 visible with the rest queued; a 3px colored bar (`::before`) encodes tone (muted=info, green=won, red=lost, yellow=bonus/info). Achievement and level-up toasts swap the bar for a 48px badge-medallion or level-emblem SVG and get a longer 7s lifetime plus a `badge-reveal` scale/rotate-in animation.

## Do's and Don'ts

### Do:
- **Do** use the five-step bin scale (`--bin-0`…`--bin-4`) for anything encoding tonight's alert probability — region fills, strip cells, legend chips, pill counts — and nothing else.
- **Do** keep `#00B280`/win-green scoped to won bets, unlocked achievements and profitable nights; it is not a general success/positive color.
- **Do** spend `--yellow`/`--yellow-soft` on odds, the primary action and active/selected states — the one warm accent, kept narrow.
- **Do** set JetBrains Mono only on live/measured numbers (odds, balance, clock, counts, map percentages); everything else stays in Onest or Unbounded.
- **Do** build every panel/card as flat material — `--panel` + 1px `--line`, no drop shadow — and reserve the two shadow tokens for the tooltip and toast overlays only.
- **Do** use square 3px-radius chips for legend/category swatches; reserve pill (999px) shapes for counters and status badges.
- **Do** disable the split-flap odds roll, the shooting-star celebration, the map pulse ring and all entrance animations under `prefers-reduced-motion: reduce` (already wired globally and per-component).
- **Do** keep the "ПРОГНОЗ · не офіційна тривога" mark visible on every surface that renders the night sky or the map, so it can never be mistaken for the real alert map or app.
- **Do** give every interactive control a ≥44px touch target (buttons, tabs, `iconbtn`, select, chip buttons) — held consistently across hero, board and play surfaces.

### Don't:
- **Don't** add fireworks, confetti or explosion effects for wins or level-ups — celebrations stay inside the night-sky world (shooting star, the rooftop cat), per `docs/gamification.md`.
- **Don't** scale reward visuals, toast lifetime, or stake affordances with stake size or risk — stake shortcuts never offer 100% of the balance; the largest shortcut is fixed at 10%.
- **Don't** add hard drop shadows, bevels or skeuomorphic gloss anywhere; the material is flat panels and 1px rules, full stop.
- **Don't** reuse the real alert map's name, logo, font, domain or watermark — the direction contracts call this a "brief-pinned world," a borrowed visual language, not a copy.
- **Don't** set Unbounded on body prose, hints or long-form copy; it is reserved for verdicts, headlines and short titles.
