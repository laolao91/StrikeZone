# Feature 7 — Pitch History Strip

**Status:** Spec only — not yet implemented

---

## Problem

The phone view always shows only the most recent pitch. There is no way to review earlier pitches in the at-bat without touching the glasses (which support scrolling back via scroll-up gestures).

For someone holding a phone at the game — maybe keeping score, or explaining the at-bat to someone next to them — being able to quickly scan "what did the pitcher throw in this at-bat?" without interacting with the glasses is valuable.

The current `AtBat.pitches` array already contains the full pitch sequence. The data is there; only the UI is missing.

---

## Proposed Design

A horizontally scrollable strip of pitch chips above the pitch detail area, showing the full at-bat sequence left-to-right (earliest → latest). Tapping a chip selects that pitch and shows its details + zone in the main view below.

### Layout (ASCII mockup)

```
┌────────────────────────────────────────────────────┐
│  NYY 3–1 BOS   ↑ glasses                          │
│  Top 6th  ·  ● ● ○ ○  ● ○  ● ○                  │
│                                                    │
│  AT-BAT  ← swipe to review                        │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐              │
│  │ FF │ │ SL │ │ CH │ │ FF │ │ FF │  ← chips     │
│  │93  │ │84  │ │79  │ │94  │ │95  │  ← speed     │
│  │Ball│ │Strk│ │Strk│ │Foul│ │▶   │  ← result    │
│  └────┘ └────┘ └────┘ └────┘ └────┘              │
│          ↑ selected                                │
│                                                    │
│  [zone SVG for selected pitch]                     │
│  pitch detail for selected pitch                   │
└────────────────────────────────────────────────────┘
```

The last chip (most recent pitch) is always auto-selected when a new at-bat loads or a new pitch arrives. Tapping any earlier chip scrolls the detail view to that pitch's data. Arriving new pitches auto-advance the selection back to the latest unless the user has manually selected an earlier pitch (same logic as the glasses scroll-back).

### Chip anatomy

Each chip is a small card, roughly 52×72px:

```
┌──────┐
│  FF  │  ← pitch type code, colored by category (red/blue/green)
│ 93   │  ← end speed in mph
│ Ball │  ← result (truncated to ~4 chars: "Ball", "Strk", "Foul", "Hit!")
└──────┘
```

- **Selected chip**: accent border, slightly elevated (shadow or bg tint)
- **Latest chip**: subtle "live" pulse dot if it arrived in the last 5s (indicates recency)
- **Contact pitch**: show "⚾" instead of speed

### Result label truncation

| Full result | Chip label |
|-------------|------------|
| Ball | Ball |
| Called Strike | Strk |
| Swinging Strike | Swng |
| Foul | Foul |
| In play, out(s) | Out |
| In play, run(s) | Run! |
| In play, no out | Hit! |
| Hit By Pitch | HBP |

---

## Data Model

No API changes needed. `AtBat.pitches: Pitch[]` already contains all pitches in the at-bat in order. The component maintains a `selectedPitchIndex: number | null` in local state (null = latest).

```ts
// null means "show latest pitch"
const [selectedPitchIndex, setSelectedPitchIndex] = useState<number | null>(null)

const displayPitch = selectedPitchIndex !== null
  ? atBat.pitches[selectedPitchIndex]
  : atBat.pitches[atBat.pitches.length - 1]
```

When a new pitch arrives (pitches array grows), if `selectedPitchIndex` is null, the new pitch auto-shows. If the user has tapped back to an earlier pitch, the selection stays pinned (same as the glasses scroll-back behavior).

A "← Back to live" button or auto-dismiss after selecting the latest chip resets `selectedPitchIndex` to null.

---

## Interaction Model

| Action | Result |
|--------|--------|
| At-bat loads / new pitch arrives | Strip shows all pitches; latest auto-selected |
| Tap any chip | That pitch's zone + details shown below |
| Swipe strip left/right | Scrolls horizontally through pitch history |
| Tap latest chip | Resets to live (selectedPitchIndex = null) |
| At-bat changes (new batter) | Strip resets, selectedPitchIndex = null |

### What stays out of scope

- Syncing the phone's selected pitch to the glasses display (glasses have their own independent history scroll via up-arrow gesture; keeping them independent is simpler and avoids unexpected glasses-side updates from phone taps)
- Showing pitches across multiple at-bats (this is per-at-bat only — past at-bats are gone once the batter changes)
- Pitch-by-pitch animation / playback

---

## Implementation Notes

### Component sketch

```tsx
function PitchHistoryStrip({
  pitches,
  selectedIndex,
  onSelect,
}: {
  pitches: Pitch[]
  selectedIndex: number | null
  onSelect: (i: number | null) => void
}) {
  const activeIdx = selectedIndex ?? pitches.length - 1

  function chipLabel(result: string): string {
    if (result.startsWith('Ball')) return 'Ball'
    if (result.includes('Called')) return 'Strk'
    if (result.includes('Swinging')) return 'Swng'
    if (result.startsWith('Foul')) return 'Foul'
    if (result.includes('run')) return 'Run!'
    if (result.includes('out')) return 'Out'
    if (result.includes('no out')) return 'Hit!'
    if (result.includes('Hit By')) return 'HBP'
    return result.slice(0, 4)
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
      {pitches.map((p, i) => {
        const isActive = i === activeIdx
        const cat = pitchCategory(p.pitchCode)
        return (
          <button
            key={i}
            onClick={() => onSelect(i === pitches.length - 1 ? null : i)}
            className={`flex-none flex flex-col items-center w-14 py-2 rounded-lg border text-xs
              ${isActive ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}
          >
            <span className={`font-bold ${PITCH_CATEGORY_CLASS[cat]}`}>{p.pitchCode}</span>
            <span className="text-text-dim">
              {p.isContact ? '⚾' : `${Math.round(p.endSpeed)}`}
            </span>
            <span className="text-text-dim">{chipLabel(p.result)}</span>
          </button>
        )
      })}
    </div>
  )
}
```

### Where it goes

In `SettingsApp.tsx`, inside the `game.gameState === 'Live' && atBat && pitch` branch, above the `<ZoneSvg>`. The `selectedPitchIndex` state lives in `SettingsApp` alongside the existing live-feed state. Reset it to `null` whenever `matchupKeyRef` changes (new at-bat).

---

## Open Questions

1. **Strip height** — 72px chips on a small phone may push the zone SVG below the fold. Consider a more compact 56px chip (type code + result only, no speed) as the default, with speed on tap.
2. **Auto-scroll to latest** — When a new pitch arrives, should the strip scroll to reveal the newest chip automatically? Yes, using a `ref` on the strip container and `scrollIntoView`. Easy to add.
3. **At-bat label** — Should the strip have a header like "This at-bat — 5 pitches"? Useful context. Low-cost.
4. **Contact pitch zone** — For `isContact` pitches, the zone SVG shows where the ball crossed the plate, but the detail view switches to `ContactDetails`. The strip chip should still show the zone on tap (the pX/pZ data is present on contact pitches) — don't hide the zone just because it's a contact event.
