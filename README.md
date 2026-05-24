# StrikeZone

Live MLB pitch data on your Even Realities G2 smart glasses — the strike zone view you can't get when you're at the park.

---

## Use Case

You're at a live game. The pitcher delivers. The umpire calls it a strike and you're not sure you agree — or you just want to know exactly what that pitch was. You glance at your glasses and see:

- A dot in a 3×3 grid showing exactly where the ball crossed the plate (catcher's perspective)
- Pitch type, velocity, spin rate, and movement
- The call (strike, ball, in play)
- Batter vs. pitcher career splits

All of this updates automatically after each pitch. No phone, no looking away from the field.

---

## Assumptions

- **Even Realities G2 glasses** paired and connected via the Even Hub iOS app
- **MLB games only** — data comes from the [MLB Stats API](https://statsapi.mlb.com), which covers all regular season and postseason games
- **Active internet connection** on the phone running Even Hub — the app fetches live game data over the network
- **Glasses are within BLE range** of your phone throughout the game
- Game data updates on a roughly 10–15 second polling interval; there is a short lag between a pitch being thrown and it appearing on your glasses

---

## Display Layout

The glasses display is split into three columns below a two-line header.

```
    NYY 3-1 BOS | Bot 6 | B:1 S:2 O:1 P:42
    B: Judge [R]          P: Sale [LHP] 42p
┌─────────┬──────────────────┬──────────────┐
│  zone   │   pitch info     │    splits    │
│  image  │                  │              │
│         │ Catcher's view   │ NYY B: Judge │
│  [dot   │ 4-Seam FF        │ BOS P: Sale  │
│   in    │ 97 mph           │              │
│   3×3   │ Called Strike    │ .238         │
│   grid] │ 2480 rpm         │ 12 HR        │
│         │ Drop ↓11"        │ 34 AB        │
│         │ Move →8"         │              │
│         │ 102→97           │              │
│         │                  │              │
│         │ double-tap: list │              │
└─────────┴──────────────────┴──────────────┘
```

**Header** — Score, inning, count (balls/strikes/outs), pitcher's pitch count on line 1. Batter and pitcher names with handedness on line 2.

**Zone (left)** — 1-bit PNG image of the 3×3 strike zone with a dot at the pitch's plate-crossing coordinates. The dot appears inside the zone for strikes, outside for balls. Catcher's perspective (left on display = right side of the plate from the batter's view).

**Pitch info (center)** — Pitch type, exit speed, result, spin rate, vertical drop, horizontal movement, and velocity delta (release speed → plate speed). On contact plays: exit velocity, launch angle, and distance replace spin/movement.

**Splits (right)** — Batter's career stats against this pitcher (batting average, home runs, at-bats).

---

## Controls

| Gesture | In game view | In game list |
|---|---|---|
| **Tap** | Refresh data | Select highlighted game |
| **Double-tap** | Open game list | — |
| **Scroll up** | Previous pitch (history) | Scroll list up |
| **Scroll down** | Return to live pitch | Scroll list down |

Scrolling through pitch history shows each pitch in the current at-bat. The header updates to show "Pitch N / Total". Scrolling back down (or tapping) returns to live.

---

## Installation

1. Build the project: `npm run pack` — produces `strikezone.ehpk`
2. Open the Even Hub simulator or connect your G2 glasses via Even Hub
3. Install `strikezone.ehpk`
4. On first launch, a game list appears automatically — scroll to your game and tap to select

If updating from a previous version, do a full uninstall before reinstalling to clear stale container state.

---

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # TypeScript + Vite build
npm run pack      # build + package as .ehpk
npx vitest run    # unit tests
```

**Stack:** TypeScript, Vite, Even Hub SDK, Vitest. Data source: MLB Stats API (public, no key required).

The zone image uses a 1-bit PNG encoder written in pure JS — no canvas, no `CompressionStream` — to work around WebKit/WKWebView limitations in the Even Hub runtime. The app probes four image sizes on first render (120×144 → 80×96 → 40×48 4-bit → 40×48 1-bit) and caches whichever size the BLE connection accepts. If all sizes fail, a text label is shown instead and the full diagnostic log is displayed in the center column.
