# StrikeZone – Session Handoff

**Date:** 2026-05-12  
**Branch:** main  
**Last commit:** `429c315` Fix Loading freeze: remove async/CompressionStream, shrink image to 60x72

---

## What the app is

Even Realities G2 smart glasses app showing live MLB pitch data. Four-container layout on the glasses:

| Container | ID | Position | Role |
|---|---|---|---|
| HDR | 1 `hdr` | x=0,y=0, 576×36 | Score / inning / count (2 lines) |
| ZONE | 2 `zone` | x=0,y=36, **60×72** | PNG strike zone image |
| INFO | 3 `info` | x=62,y=36, 256×252 | Pitch details (event capture) |
| SPLITS | 4 `splits` | x=320,y=36, 256×252 | Batter vs pitcher |

Image container is declared in `createStartUpPageContainer` — it cannot survive `rebuildPageContainer` on hardware.

---

## Current symptom

**Glasses (hardware + simulator):**
- ✅ HDR row shows score + count (proves `textContainerUpgrade` for HDR is working)
- ❌ INFO, SPLITS, and ZONE show nothing below the header

**Phone/settings app:**
- ✅ Simulator: works (ZoneSvg, pitch data, all rendering fine)
- ⚠️ Hardware: shows score header only, no pitch section — likely a game-state timing issue (between innings / no active at-bat), not a code bug. The pitch section only renders when `gameState === 'Live' && atBat && pitch`.

---

## Most likely cause of missing INFO/SPLITS/ZONE

**The user has not done a full uninstall + reinstall.**

The container layout changed in the last commit (ZONE shrank from 120×144 to 60×72; INFO moved from x=122 to x=62). `createStartUpPageContainer` is called every app start — if old containers from a previous install are still registered, the new call may be silently failing or conflicting. Because the container IDs/names are unchanged, `textContainerUpgrade` for HDR (which happened to work before) keeps working, but INFO and SPLITS may be pointing at stale container definitions.

**First thing to try next session:** uninstall the old ehpk completely, then install fresh.

If a fresh install does NOT fix INFO/SPLITS showing nothing, the issue is a real bug (see "If fresh install still fails" below).

---

## Long debugging history: strike zone image format

This took many iterations. Summary of what was tried and why each failed:

| Attempt | Format passed to `updateImageRawData` | Result |
|---|---|---|
| `canvas.toDataURL()` | `data:image/png;base64,...` string | Works in simulator; iOS WKWebView returns corrupt/empty on hardware |
| Raw 4-bit pixels | `number[]` of 0–15 greyscale values | Simulator: "failed to decode image" — firmware uses Rust image crate, needs a real image file |
| RGBA `Uint8Array` | raw pixel bytes, no image header | Same decode error |
| Pure-JS PNG encoder (uncompressed DEFLATE) | plain base64 string, no prefix | Simulator works; glasses: `sendFailed` — PNG is ~23 KB base64, exceeds BLE send limit |
| Added `data:image/png;base64,` prefix | full data URI | Simulator: "base64 decode error: Invalid symbol 58 (colon) at offset 4" — firmware base64-decodes the string directly, prefix is invalid |
| `CompressionStream('deflate-raw')` | compressed base64, ~1 KB | Hangs indefinitely in WKWebView → `displayInFlight` guard stays `true` forever → entire display freezes at "Loading..." |
| **Current:** 60×72 px image, uncompressed DEFLATE | plain base64, ~6 KB | Not yet confirmed on hardware — the "no containers" symptom appeared |

**Key facts confirmed:**
- Firmware base64-decodes string imageData before passing to Rust image decoder
- `sendFailed` at 23 KB base64 (120×144 uncompressed PNG)
- `sendFailed` was confirmed working (showed "IMG ERR: sendFailed" in SPLITS column) — so the error surfacing code in `renderPitch` IS executing
- 60×72 uncompressed PNG = ~6 KB base64; expected to be under the BLE send limit

---

## Error surfacing currently in the code

`src/main.ts` `renderPitch()`:
```typescript
const imgResult = await bridge.updateImageRawData(...)
if (imgResult !== 'success') {
  console.warn('updateImageRawData:', imgResult)
  await upgradeText(SPLITS_ID, SPLITS_NAME, `IMG ERR: ${imgResult}\n\n${splits}`)
}
```

If the image send fails, the SPLITS column on the glasses will show `IMG ERR: <code>` at the top. Possible codes: `imageException`, `imageSizeInvalid`, `imageToGray4Failed`, `sendFailed`.

`imageSizeInvalid` would confirm a stale container (old 120×144 container getting a 60×72 image).

---

## If fresh install still fails (INFO/SPLITS blank)

The issue is that `textContainerUpgrade` for INFO or SPLITS is failing silently. Add return-value checking to `renderPitch` to surface it:

```typescript
async function renderPitch(header, info, splits, imageData) {
  if (!bridge) return
  await upgradeText(HDR_ID, HDR_NAME, header)

  const infoOk = await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: INFO_ID, containerName: INFO_NAME,
    content: info, contentOffset: 0, contentLength: 0,
  }))
  if (!infoOk) {
    // Show failure in HDR so we can see it
    await upgradeText(HDR_ID, HDR_NAME, `INFO UPG FAILED\n${header}`)
    return
  }
  // ... rest of renderPitch
}
```

Also check the return value of `createStartUpPageContainer` in `startGlassesMode`:
```typescript
const result = await b.createStartUpPageContainer(...)
if (result !== 0) {
  console.error('createStartUpPageContainer failed:', result)
  // result 1=invalid, 2=oversize, 3=outOfMemory
}
```

---

## Alternative: text-based zone (nuclear option)

If the image path keeps failing, replace the ZONE image container with a text container and draw the zone using Unicode box-drawing characters. `getDotPosition()` already returns which cell (0-2 row/col) the pitch is in.

```
┌─┬─┬─┐
│·│·│·│
├─┼─●┼─┤   ← pitch in row 1, col 1
│·│·│·│
└─┴─┴─┘
```

This uses `textContainerUpgrade` (100% reliable) and is tiny data. Trade-off: loses sub-cell precision but shows correct zone location. Requires a layout change (image container → text container), so needs a fresh reinstall anyway.

---

## Relevant files

| File | Role |
|---|---|
| `src/main.ts` | Glasses entry, container layout, display logic |
| `src/glasses/zone.ts` | PNG encoder + `renderZoneCanvas` (sync, 60×72) |
| `src/glasses/display.ts` | Text render functions (header, pitch info, splits) |
| `src/glasses/game-state.ts` | State machine, API polling, notify |
| `src/settings/SettingsApp.tsx` | Phone/settings React UI |
| `src/settings/ZoneSvg.tsx` | SVG zone for phone view |
| `app.json` | `edition: "202601"` (required by validator) |

---

## Next session checklist

1. **Uninstall old ehpk, install fresh** — check if INFO/SPLITS/ZONE appear
2. If `IMG ERR: imageSizeInvalid` shows in SPLITS → stale container confirmed, reinstall is the fix
3. If INFO/SPLITS still blank after fresh install → add return-value checking to `createStartUpPageContainer` and `textContainerUpgrade`
4. If image still `sendFailed` at 60×72 → go smaller (40×48, ~2.7 KB) or implement text-based zone
5. Once image renders, remove the `IMG ERR:` debug surfacing from `renderPitch`
6. Strip the `IMG ERR:` debug line for final v1.0 release
