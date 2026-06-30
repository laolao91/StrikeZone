# Feature 5 — At-Bat Count Display

**Status:** Spec only — not yet implemented

---

## Problem

The current count display is `B:{balls} S:{strikes} O:{outs}` rendered as small dim secondary text beneath the score line in `SettingsApp.tsx`:

```
NYY 3–1 BOS
Top 6  ·  B:2 S:1 O:1        ← easy to miss, abbreviations require decoding
```

The count is the single most time-sensitive piece of context for someone following a game pitch by pitch. It answers "what's at stake on this pitch?" before any other piece of data. On TV broadcasts it gets a permanent prominent overlay. In the current phone view it's treated like a footnote.

Additionally, `B:2 S:1 O:1` notation is only natural to fans already fluent in baseball — a newer fan or casual viewer at the park may not parse it instantly.

---

## Proposed Design

Replace the text count with a visual indicator row using filled/empty dots, matching the intuitive mental model broadcasters use.

### Layout (ASCII mockup)

```
┌────────────────────────────────────┐
│        NYY 3–1 BOS   ↑ glasses    │  ← score line (existing, unchanged)
│         Top 6th Inning             │  ← inning line (existing, unchanged)
│                                    │
│  BALLS  ● ● ○ ○    STRIKES  ● ○   │  ← NEW count row
│  OUTS   ● ○                        │  ← NEW outs row (separate line or inline)
└────────────────────────────────────┘
```

Or combined on one line with labels:

```
  ● ● ○ ○  balls    ● ○  strikes    ● ○  outs
```

### Dot encoding

| State   | Filled (●) | Empty (○) |
|---------|-----------|----------|
| Balls   | current balls count | 4 − balls |
| Strikes | current strikes count | 3 − strikes |
| Outs    | current outs count | 3 − outs |

Max dots: 4 balls, 3 strikes, 3 outs. Full count = `● ● ● ○  ● ● ○  ○ ○ ○`.

### Visual treatment

- Filled dot: accent color or white, slightly larger (14–16px)
- Empty dot: dim gray, same size
- Labels beneath or beside each group: small caps, `text-text-dim`
- The entire row sits between the inning line and the pitch zone SVG
- On a 2-strike count, the strike dots could pulse or turn red to signal tension — optional, can skip for v1.2

### Accessibility

Include `aria-label` on the container: `"Count: 2 balls, 1 strike, 1 out"`. Screen readers skip the visual dots and read the label instead.

---

## Implementation Notes

### Component sketch

```tsx
function CountDisplay({ balls, strikes, outs }: { balls: number; strikes: number; outs: number }) {
  function Dots({ filled, total, label }: { filled: number; total: number; label: string }) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`w-3 h-3 rounded-full ${i < filled ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-text-dim">{label}</span>
      </div>
    )
  }

  return (
    <div
      className="flex justify-center gap-6 my-3"
      aria-label={`Count: ${balls} balls, ${strikes} strikes, ${outs} outs`}
    >
      <Dots filled={balls}   total={4} label="Balls"   />
      <Dots filled={strikes} total={3} label="Strikes" />
      <Dots filled={outs}    total={3} label="Outs"    />
    </div>
  )
}
```

### Where it goes

In `SettingsApp.tsx`, inside the `game.gameState === 'Live' && atBat` branch, between the inning/score header and the `<ZoneSvg>`:

```tsx
{game.gameState === 'Live' && atBat && (
  <>
    <CountDisplay balls={atBat.balls} strikes={atBat.strikes} outs={atBat.outs} />
    <div className="text-xs text-center text-text-dim mb-1">Catcher's view</div>
    <ZoneSvg ... />
  </>
)}
```

All data (`atBat.balls`, `atBat.strikes`, `atBat.outs`) is already present in the `AtBat` type — no API changes needed.

---

## Open Questions

1. **Dot size on smaller phones** — 3px gap between 12px dots may feel cramped on a 375px-wide screen. Test at 375px before committing to sizes.
2. **2-strike highlight** — Useful tension signal, but adds complexity. Defer to v1.3 unless it's a one-liner.
3. **Half-inning indicator** — Should "Top 6th" stay as text or could a ▲/▼ arrow next to the inning number replace the word? Saves horizontal space. Out of scope for this feature.
4. **Full count label** — Some apps show "FULL COUNT" text when it's 3-2. Nice, low-cost addition — just a conditional `<span>` below the dots.
