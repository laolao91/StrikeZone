# Strike Zone Image Rendering — Design Spec

**Date:** 2026-05-23
**Status:** Approved — ready for implementation planning

---

## Overview

Re-enable the image-based strike zone visualization using the 1-bit PNG encoder already in the codebase. The encoder was written but never sent to `updateImageRawData` — all prior `sendFailed` failures used the 8-bit greyscale encoder (23 KB → 6 KB range). The 1-bit encoder produces ~3.1 KB at 120×144 and ~1.4 KB at 80×96, both meaningfully smaller than anything previously tried.

The zone image is the core feature: at a live game, between pitches, the user checks their glasses and sees exactly where the ball crossed the plate. Text alternatives are not acceptable — the glanceability of a spatial grid with a dot is the point.

---

## Target Visual

Pixel-rendered 3×3 strike zone grid, black background, white (bright green on hardware) lines and dot. Catcher's perspective. Dot positioned at the pitch's actual plate crossing coordinates (`pX`, `pZ`), clipped to image bounds for pitches far outside the zone — nearest visible approximation is acceptable. No text labels inside the zone column; no content below the image in the zone column.

The original design (May 9–12 screenshots) is the exact target. Layout: zone image left column, pitch details center, batter/pitcher splits right.

---

## Rendering Cascade

The cascade runs **once per session**, on the first pitch render. The working step is stored in a module-level variable. All subsequent renders skip straight to that step — no re-testing on every pitch.

| Step | Container size | Format | Est. base64 size |
|---|---|---|---|
| A | 120×144 | 1-bit PNG | ~3.1 KB |
| B | 80×96 | 1-bit PNG | ~1.4 KB |
| C | 80×96 | 4-bit greyscale PNG | ~1.6 KB |

### Trigger conditions

| SDK return value | Action |
|---|---|
| `success` | Store working step, render normally |
| `sendFailed` | BLE size limit hit — A→B. If B also returns `sendFailed`, ALL FAILED (C is the same dimensions as B but larger — it would also fail). |
| `imageException` | Format rejected by firmware decoder — A→C (skip B, same dimensions would also fail); B→C. |
| `imageToGray4Failed` | Format conversion failed — same routing as `imageException`. |
| `imageSizeInvalid` | Container dimensions don't match image — call `rebuildPageContainer` then retry same step once |
| All three fail | No image rendered; pitch location text label prepended to INFO; full diagnostic shown in SPLITS |

### New encoder needed: `encodePNG4bit`

Step C requires a 4-bit greyscale PNG encoder (currently only 1-bit and 8-bit exist in `zone.ts`). For our pure black/white zone image, output values are 0 (black) or 15 (white) packed two pixels per byte, MSB first. This is a standard PNG `bit_depth=4, colortype=0` file.

---

## Container Layout

The zone container dimensions change between Step A and Steps B/C. If the cascade settles on B or C, `rebuildPageContainer` fires once to resize — the resulting one-time flicker is acceptable.

| Working step | Zone container | INFO x/width | SPLITS x/width |
|---|---|---|---|
| A (120×144) | x=0, y=36, w=120, h=144 | x=122, w=226 | x=350, w=226 |
| B or C (80×96) | x=0, y=36, w=80, h=96 | x=82, w=266 | x=350, w=226 |

The zone column always starts at x=0, y=36. The image is left-aligned within the column; space below the image (y=132–288 for the 80×96 case) is transparent/black. No padding or centering of the image within the column.

---

## Diagnostic Display in SPLITS

While the cascade is running (or if all steps fail), the SPLITS column shows a running diagnostic log instead of batter/pitcher stats. The log clears back to normal splits content once a working step is found and the zone renders successfully.

### Format

```
ZONE-DBG
A:120x144 1b
 3152chr sendFailed
B:80x96 1b
 1408chr imageException
C:80x96 4b
 1537chr OK
```

### Rules

- One header line: `ZONE-DBG`
- Per attempt: step letter + dimensions + bit depth (`1b` or `4b`) on one line; actual base64 char count + SDK return string verbatim on the next line (indented one space)
- SDK error strings are used verbatim — no translation — so whatever appears on the glasses can be pasted directly into the next session
- Steps not yet attempted are omitted (log grows as each attempt completes)
- On `OK`: remaining steps are not appended; log stays visible until the *next* pitch render, at which point normal splits content replaces it
- If all three fail: log shows all three entries plus a final line `ALL FAILED`

### All-failed fallback in INFO

If all three cascade steps fail, prepend a compact pitch location label to the INFO column content (before the pitch type line):

```
Hi/L
4-Seam FF
95 mph
...
```

Using the existing `renderZoneText` label format (`Hi/L`, `Md/M`, `↑/R`, etc.) — no grid, just the two-part position string. This ensures pitch location is still surfaced even when the image is completely broken.

---

## Files Changed

| File | Change |
|---|---|
| `src/glasses/zone.ts` | Add `encodePNG4bit(pixels, width, height)` for Step C |
| `src/main.ts` | Add cascade state variable, cascade runner, `rebuildPageContainer` on layout change, diagnostic formatter for SPLITS, location-label fallback for INFO |

No changes to `display.ts`, `game-state.ts`, or test files beyond updating the zone test to cover the new encoder.

---

## Out of Scope

- Animated dot or transition effects
- Multiple image format probing beyond the three steps above
- Persisting the working step across app restarts (re-probe on each cold start is acceptable)
- Changing the zone grid drawing algorithm (thick outer border, thin inner dividers, filled circle dot — unchanged from original)
