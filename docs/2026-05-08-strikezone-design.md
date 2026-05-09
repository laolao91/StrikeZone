# StrikeZone — G2 Plugin Design Spec

**Date:** 2026-05-08
**Status:** Approved — ready for implementation planning

---

## Overview

StrikeZone is an EvenRealities G2 smart glasses plugin that surfaces live MLB pitch-by-pitch data to fans attending games in person. The hero feature is the strike zone visualization — something visible on every broadcast but invisible from the stands. The app is manually-triggered and auto-refreshing, designed to be glanced at between pitches without distracting from the live game.

---

## App Identity

| Field | Value |
|---|---|
| App name | StrikeZone |
| Package ID | `com.strikezone.app` |
| Target | EvenRealities G2 glasses |
| SDK | `@evenrealities/even_hub_sdk` v0.0.10 |
| CLI | even-hub-cli v0.1.12 |
| Simulator | v0.7.2 |
| Stack | TypeScript + Vite + even-toolkit |

---

## Data Source

**MLB Stats API** — public, no auth required, CORS-friendly.

| Endpoint | URL |
|---|---|
| Live game feed | `https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live` |
| Today's schedule | `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD` |

**Network permission whitelist:** `https://statsapi.mlb.com`

**Key Statcast fields used:**

| Field | Used for |
|---|---|
| `pitchData.coordinates.pX` | Pitch horizontal plate location |
| `pitchData.coordinates.pZ` | Pitch vertical plate location |
| `pitchData.strikeZoneTop` / `pitchData.strikeZoneBottom` | Batter's dynamic strike zone bounds |
| `pitchData.startSpeed` | Release velocity |
| `pitchData.endSpeed` | Plate velocity (shown to user) |
| `pitchData.breaks.spinRate` | Spin rate (rpm) |
| `pitchData.breaks.breakVertical` | Vertical break (inches) |
| `pitchData.breaks.breakHorizontal` | Horizontal break (inches) |
| `pitchType.description` | Pitch type name |
| `details.description` | Pitch result |
| `batSide.code` | Batter handedness (L/R) |
| `pitchHand.code` | Pitcher handedness (L/R) |
| `launchSpeed` | Exit velocity (contact plays) |
| `launchAngle` | Launch angle (contact plays) |
| `totalDistance` | Hit distance (contact plays) |

---

## Display Layout

**Canvas:** 576×288px. Header: 576×28px. Body: 576×260px. Padding: 4px all sides. Font: single variable-width LVGL font (not monospaced). Target: ≤400 chars in body, ~38 chars per line.

### Header

Center-aligned. Format:

```
NYY 5-3 BOS | Top 3 | B:2 S:1 O:2
```

Fields: Away team, score, home team, inning half (Top/Bot), inning number, ball count, strike count, out count.

### Body — Normal Pitch View (~295 chars)

```
B: A.Judge [R]      P: C.Sale [L] 87p
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Catcher's view      4-Seam FF
┌─┬─┬─┐            88 mph
│ │●│ │            Called Strike
├─┼─┼─┤            2387 rpm
│ │ │ │            Drop ↓14"
├─┼─┼─┤            Move ←4"
│ │ │ │            96→88
└─┴─┴─┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Judge vs Sale: .250  1 HR  12 AB
```

- **Batter/pitcher row:** `B: LastName [Hand]` and `P: LastName [Hand] NNp` (pitch count). Center-aligned.
- **Strike zone grid:** 3×3 using box-drawing chars `┌─┬─┐│├┤┼┴└┘`. Catcher's perspective.
- **Zone dot:** `●` placed in the correct cell based on `px`/`pz` mapped to `szTop`/`szBot`. See zone mapping below.
- **Outside-zone pitches:** Dot rendered outside grid boundary — below the bottom row for dirt balls, left/right of the grid for way-outside pitches. No text label.
- **Pitch detail column (right side):** 7 items listed in priority order (see below).
- **Historical split:** `LastName vs LastName: .AVG  N HR  N AB`. Center-aligned at bottom. Data sourced from MLB Stats API career batter-vs-pitcher stats endpoint: `https://statsapi.mlb.com/api/v1/people/{batterId}/stats?stats=vsPlayer&opposingPlayerId={pitcherId}&group=hitting&sportId=1`. Fetched once when the at-bat matchup changes.

### Body — Ball in Play (~180 chars)

Zone grid and pitch detail replaced with contact data:

```
B: A.Judge [R]      P: C.Sale [L] 87p
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚾ HOME RUN

Exit Velocity    108 mph
Launch Angle      32°
Distance         431 ft
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Judge vs Sale: .333  2 HR  12 AB
```

Result labels: `HOME RUN`, `SINGLE`, `DOUBLE`, `TRIPLE`, `FLYOUT`, `GROUNDOUT`, `LINEOUT`. Derived from the play event description in the live feed.

---

## Strike Zone — Cell Mapping

Standard 9-zone broadcast layout (catcher's perspective):

```
Zone 1 | Zone 2 | Zone 3     (high)
Zone 4 | Zone 5 | Zone 6     (middle)
Zone 7 | Zone 8 | Zone 9     (low)
```

**Mapping:** Divide the batter's strike zone (`szTop`−`szBot`) evenly into 3 vertical bands and the horizontal zone (roughly −0.83 to +0.83 ft) into 3 horizontal bands. Map `pz` and `px` to the appropriate cell. Pitches outside both ranges render the dot outside the grid.

---

## Pitch Detail Column

Right column of the body, displayed in this order:

1. Pitch type — short label + Statcast code, e.g., `4-Seam FF`
2. Plate velocity — `88 mph` (uses `pitchData.endSpeed`)
3. Result — `Called Strike`, `Ball`, `Swinging Strike`, `Foul`
4. Spin rate — `2387 rpm`
5. Vertical break — `Drop ↓14"` (uses `pitchData.breaks.breakVertical`)
6. Horizontal break — `Move ←4"` or `Move →4"` (uses `pitchData.breaks.breakHorizontal`, sign determines arrow direction)
7. Velocity drop — `96→88` (release speed → plate speed)

### Pitch Type Abbreviations

Display format is `[Short Label] [Code]` — e.g., `4-Seam FF`. Codes are MLB Statcast standard (used by Baseball Savant, FanGraphs, and broadcast graphics). Source field: `details.type.code` and `details.type.description`.

| Statcast Code | Display Label | Full Name |
|---|---|---|
| `FF` | `4-Seam FF` | Four-Seam Fastball |
| `SI` | `Sinker SI` | Sinker (Two-Seam) |
| `FC` | `Cutter FC` | Cut Fastball |
| `FS` | `Splitter FS` | Split-Finger |
| `SL` | `Slider SL` | Slider |
| `ST` | `Sweeper ST` | Sweeper |
| `SV` | `Slurve SV` | Slurve |
| `CH` | `Change CH` | Changeup |
| `CU` | `Curve CU` | Curveball |
| `KC` | `KnCurve KC` | Knuckle-Curve |
| `KN` | `Knuckle KN` | Knuckleball |
| `EP` | `Eephus EP` | Eephus |
| `FO` | `Fork FO` | Forkball |

Any unrecognized code falls back to `[description] [code]` using the raw API values.

---

## Interaction Model

| Input | Action |
|---|---|
| Tap | Refresh — fetch latest pitch immediately |
| Double-tap | Return to game selection screen |
| Scroll up | Previous pitch in current at-bat |
| Scroll down | Latest pitch (return to live) |
| Auto-refresh | Every 10 seconds automatically |

Scroll up/down allow browsing the pitch sequence for the current at-bat. When viewing a historical pitch, the `Catcher's view` label is replaced with `Pitch 3 / 5` (index of current pitch in the at-bat). Scroll down from the latest pitch returns to live.

---

## Game Selection

### Phone (even-toolkit settings page)
- List of today's games fetched from the schedule endpoint
- Each game shows: `Away vs Home`, score (if started), inning (if in progress)
- User taps a game to select it — selection syncs to glasses via SDK settings

### Glasses (on-device list)
- Shown when no game is selected, or on double-tap from the pitch view
- Scroll up/down to navigate game list, tap to select
- Same data as phone list: team names, score, inning

### v1 Priority
Phone-first. Both surfaces available at launch.

---

## App States

| State | Display |
|---|---|
| No game selected | `Select a game in the StrikeZone app on your phone` |
| Game not started | `NYY vs BOS — Starting at 7:10 PM` |
| Game starting soon | `NYY vs BOS — Game Starting Soon` |
| Rain delay | `NYY vs BOS — Rain Delay` |
| Between pitches (stale) | Last pitch frozen; auto-refresh every 10s |
| Loading | Brief loading indicator while fetching |
| Fetch error | `Unable to load game data. Tap to retry.` |
| Final | Score + `Final` label in header |

---

## Out of Scope (v1)

- Baserunners (dropped to prioritize richer pitch data)
- Pitch arsenal breakdown (pitcher's pitch mix this game)
- Multiple simultaneous game tracking
- Pitch sequence history strip in the at-bat view (revisit if space permits)

---

## Reference Files

| Resource | Path |
|---|---|
| G2 dev reference | `EvenHub_Developer_Submissions/Point of Interest App/G2_DEV_REFERENCE.md` |
| Toolkit guide | `EvenHub_Developer_Submissions/Point of Interest App/G2_DEVELOPER_TOOLKIT_GUIDE.md` |
| SubwayLens (pattern reference) | `EvenHub_Developer_Submissions/SubwayLens_v1.5.1/` |
| Visual mockups | `EvenHub_Developer_Submissions/.superpowers/brainstorm/91176-1778278569/content/` |
| Handoff doc | `CoworkSandbox/outbox/2026-05-08_mlb-gamecast-glasses-design-handoff.md` |
