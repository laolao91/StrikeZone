# Zone Image Rendering — 1-bit PNG Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-enable the image-based strike zone by sending a 1-bit PNG via `updateImageRawData`, with a three-step cascade that finds the largest image the BLE link can deliver and surfaces SDK error strings directly in the SPLITS column for debugging.

**Architecture:** Pure logic (new encoder, cascade decision, diagnostic formatter) lives in `zone.ts` and is fully unit-tested. State management and SDK calls live in `main.ts`, verified via the Even Hub simulator. On the first pitch render the cascade probes step-by-step and caches the working step; all subsequent renders skip straight to it. If the layout changes (A→B or A→C), `rebuildPageContainer` fires once.

**Tech Stack:** TypeScript, `@evenrealities/even_hub_sdk`, vitest, Even Hub simulator v0.7.2

---

## Spec Correction

Step C dimensions are **40×48** (not 80×96 as the design spec says). With the uncompressed DEFLATE approach used by all existing encoders, a 4-bit PNG at 80×96 is ~5.2 KB — larger than what already failed at 6 KB. At 40×48 the 4-bit PNG is ~1.4 KB, comparable to Step B.

| Step | Size | Format | Est. base64 | Triggered by |
|---|---|---|---|---|
| A | 120×144 | 1-bit PNG | ~3.2 KB | First try |
| B | 80×96 | 1-bit PNG | ~1.5 KB | A → `sendFailed` |
| C | 40×48 | 4-bit grey PNG | ~1.4 KB | A or B → `imageException` / `imageToGray4Failed` |

---

## File Map

| File | Change |
|---|---|
| `src/glasses/zone.ts` | Add `encodePNG4bit`; add and export `CascadeStep`, `CASCADE_CONFIG`, `renderZoneImage`, `nextCascadeStep`, `AttemptLog`, `formatZoneDiagnostic` |
| `src/glasses/zone.test.ts` | Add tests for all new exports |
| `src/main.ts` | Import `RebuildPageContainer`; add cascade state; add `buildZoneContainers`, `runCascade`; refactor `renderPitch` to use cascade |

---

### Task 1: `encodePNG4bit` encoder (TDD)

**Files:**
- Modify: `src/glasses/zone.ts`
- Modify: `src/glasses/zone.test.ts`

- [ ] **Step 1.1: Update zone.test.ts import and add failing tests**

Update the import at the top of `zone.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  getDotPosition, renderZoneText, renderZoneCanvas, renderZoneBlank,
  encodePNG4bit,
} from './zone'
```

Add this describe block at the end of `zone.test.ts`:

```typescript
describe('encodePNG4bit', () => {
  const W = 40, H = 48

  it('output is valid base64', () => {
    expect(encodePNG4bit(new Uint8Array(W * H), W, H)).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('starts with PNG signature when decoded', () => {
    const bin = atob(encodePNG4bit(new Uint8Array(W * H), W, H))
    expect(bin.charCodeAt(0)).toBe(0x89)
    expect(bin.charCodeAt(1)).toBe(0x50) // P
    expect(bin.charCodeAt(2)).toBe(0x4e) // N
    expect(bin.charCodeAt(3)).toBe(0x47) // G
  })

  it('IHDR reports bit_depth=4, colortype=0 (greyscale)', () => {
    const bin = atob(encodePNG4bit(new Uint8Array(W * H), W, H))
    // PNG layout: 8 sig + 4 len + 4 type + 4 w + 4 h + 1 bit_depth + 1 color_type = offset 24,25
    expect(bin.charCodeAt(24)).toBe(4) // bit_depth
    expect(bin.charCodeAt(25)).toBe(0) // colortype = greyscale
  })

  it('blank 40×48 base64 length is ~1.4 KB (within BLE limit)', () => {
    const b64 = encodePNG4bit(new Uint8Array(W * H), W, H)
    expect(b64.length).toBeGreaterThan(1200)
    expect(b64.length).toBeLessThan(1600)
  })

  it('length is the same regardless of pixel content (uncompressed)', () => {
    const blank = encodePNG4bit(new Uint8Array(W * H), W, H)
    const white = encodePNG4bit(new Uint8Array(W * H).fill(255), W, H)
    expect(blank.length).toBe(white.length)
  })
})
```

- [ ] **Step 1.2: Run tests, confirm failures**

```bash
cd /Users/stevenlao/Claude_Code_Sandbox/StrikeZone_v1.0
npx vitest run src/glasses/zone.test.ts 2>&1 | tail -20
```

Expected: 5 failures — `encodePNG4bit is not a function` or export not found.

- [ ] **Step 1.3: Implement `encodePNG4bit` in zone.ts**

Add immediately after the closing brace of `encodePNG1bit` (after line ~127), before the `// ── Text-based strike zone` comment:

```typescript
// 4-bit greyscale PNG: rowBytes = ceil(width/2), two pixels packed per byte (high << 4 | low).
// Non-zero pixel → 0xF (white); zero → 0x0 (black). IHDR bit_depth=4, colortype=0.
// At 40×48: raw = 48×21 = 1,008 bytes → ~1,436 base64 chars ≈ 1.4 KB.
export function encodePNG4bit(pixels: Uint8Array, width: number, height: number): string {
  const rowBytes = Math.ceil(width / 2)
  const raw = new Uint8Array(height * (1 + rowBytes))

  for (let y = 0; y < height; y++) {
    raw[y * (1 + rowBytes)] = 0  // filter byte = None
    for (let x = 0; x < width; x += 2) {
      const p0 = pixels[y * width + x] ? 0xF : 0x0
      const p1 = (x + 1 < width && pixels[y * width + x + 1]) ? 0xF : 0x0
      raw[y * (1 + rowBytes) + 1 + (x >> 1)] = (p0 << 4) | p1
    }
  }

  const blocks: number[] = []
  const BLOCK = 65535
  for (let offset = 0; offset < raw.length; offset += BLOCK) {
    const chunk = raw.subarray(offset, Math.min(offset + BLOCK, raw.length))
    const isFinal = (offset + BLOCK >= raw.length) ? 1 : 0
    const len = chunk.length
    blocks.push(isFinal, len & 0xff, (len >> 8) & 0xff, (~len) & 0xff, (~len >> 8) & 0xff)
    for (let i = 0; i < chunk.length; i++) blocks.push(chunk[i])
  }
  const adler = adler32(raw)
  const zlib = [0x78, 0x01, ...blocks, ...u32be(adler)]

  const png = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...pngChunk('IHDR', [...u32be(width), ...u32be(height), 4, 0, 0, 0, 0]),
    ...pngChunk('IDAT', zlib),
    ...pngChunk('IEND', []),
  ]

  let bin = ''
  for (const b of png) bin += String.fromCharCode(b)
  return btoa(bin)
}
```

- [ ] **Step 1.4: Run tests, confirm all pass**

```bash
npx vitest run src/glasses/zone.test.ts 2>&1 | tail -10
```

Expected: all tests pass, 0 failures.

- [ ] **Step 1.5: Commit**

```bash
git add src/glasses/zone.ts src/glasses/zone.test.ts
git commit -m "feat: add encodePNG4bit for cascade step C"
```

---

### Task 2: Cascade types, config, and `nextCascadeStep` (TDD)

**Files:**
- Modify: `src/glasses/zone.ts`
- Modify: `src/glasses/zone.test.ts`

- [ ] **Step 2.1: Add failing tests for `nextCascadeStep`**

Update the import in `zone.test.ts`:

```typescript
import {
  getDotPosition, renderZoneText, renderZoneCanvas, renderZoneBlank,
  encodePNG4bit, nextCascadeStep,
} from './zone'
```

Add after the `encodePNG4bit` describe block:

```typescript
describe('nextCascadeStep', () => {
  it('A + sendFailed → B', () => {
    expect(nextCascadeStep('A', 'sendFailed')).toBe('B')
  })

  it('B + sendFailed → failed (C is same size, larger format)', () => {
    expect(nextCascadeStep('B', 'sendFailed')).toBe('failed')
  })

  it('A + imageException → C (skip B, same dimensions)', () => {
    expect(nextCascadeStep('A', 'imageException')).toBe('C')
  })

  it('A + imageToGray4Failed → C', () => {
    expect(nextCascadeStep('A', 'imageToGray4Failed')).toBe('C')
  })

  it('B + imageException → C', () => {
    expect(nextCascadeStep('B', 'imageException')).toBe('C')
  })

  it('C + any error → failed', () => {
    expect(nextCascadeStep('C', 'sendFailed')).toBe('failed')
    expect(nextCascadeStep('C', 'imageException')).toBe('failed')
    expect(nextCascadeStep('C', 'imageToGray4Failed')).toBe('failed')
  })

  it('imageSizeInvalid → resize (caller handles rebuildPageContainer)', () => {
    expect(nextCascadeStep('A', 'imageSizeInvalid')).toBe('resize')
    expect(nextCascadeStep('B', 'imageSizeInvalid')).toBe('resize')
  })

  it('unknown error → failed', () => {
    expect(nextCascadeStep('A', 'imageException')).not.toBe('failed') // sanity
    expect(nextCascadeStep('A', 'somethingElse')).toBe('failed')
  })
})
```

- [ ] **Step 2.2: Run tests, confirm failures**

```bash
npx vitest run src/glasses/zone.test.ts 2>&1 | tail -20
```

Expected: 8 failures — `nextCascadeStep is not a function`.

- [ ] **Step 2.3: Add types, config, and `nextCascadeStep` to zone.ts**

Add after the `ZONE_LEFT / ZONE_RIGHT` constants at the top of `zone.ts` (after line 4), before `const IMG_X_MIN`:

```typescript
// ── Cascade types and config ──────────────────────────────────────────────────

export type CascadeStep = 'A' | 'B' | 'C'
export type NextStep = CascadeStep | 'failed' | 'resize'

export const CASCADE_CONFIG = {
  A: { width: 120, height: 144, bitDepth: 1 as 1 | 4 },
  B: { width:  80, height:  96, bitDepth: 1 as 1 | 4 },
  C: { width:  40, height:  48, bitDepth: 4 as 1 | 4 },
} as const

// Returns the next cascade step based on the SDK error string, or 'failed'/'resize'.
// 'resize' means the caller must call rebuildPageContainer then retry the same step.
export function nextCascadeStep(current: CascadeStep, sdkResult: string): NextStep {
  switch (sdkResult) {
    case 'sendFailed':
      // C is larger than B in 4-bit format, so if B already sendFailed, C will too.
      return current === 'A' ? 'B' : 'failed'
    case 'imageException':
    case 'imageToGray4Failed':
      // Skip B if coming from A (same dimensions as A, same format — would also fail).
      return current === 'C' ? 'failed' : 'C'
    case 'imageSizeInvalid':
      return 'resize'
    default:
      return 'failed'
  }
}
```

- [ ] **Step 2.4: Run tests, confirm all pass**

```bash
npx vitest run src/glasses/zone.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/glasses/zone.ts src/glasses/zone.test.ts
git commit -m "feat: add cascade types, config, and nextCascadeStep"
```

---

### Task 3: `renderZoneImage` and `formatZoneDiagnostic` (TDD)

**Files:**
- Modify: `src/glasses/zone.ts`
- Modify: `src/glasses/zone.test.ts`

- [ ] **Step 3.1: Add failing tests**

Update import in `zone.test.ts`:

```typescript
import {
  getDotPosition, renderZoneText, renderZoneCanvas, renderZoneBlank,
  encodePNG4bit, nextCascadeStep, renderZoneImage, formatZoneDiagnostic,
} from './zone'
```

Add after the `nextCascadeStep` describe block:

```typescript
describe('renderZoneImage', () => {
  it('step A returns valid base64 at correct length for 120×144 1-bit', () => {
    const b64 = renderZoneImage(0, 2.5, 3.5, 1.5, 'A')
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(b64.length).toBeGreaterThan(3000)
    expect(b64.length).toBeLessThan(3500)
  })

  it('step B returns valid base64 at correct length for 80×96 1-bit', () => {
    const b64 = renderZoneImage(0, 2.5, 3.5, 1.5, 'B')
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(b64.length).toBeGreaterThan(1300)
    expect(b64.length).toBeLessThan(1700)
  })

  it('step C returns valid base64 at correct length for 40×48 4-bit', () => {
    const b64 = renderZoneImage(0, 2.5, 3.5, 1.5, 'C')
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(b64.length).toBeGreaterThan(1200)
    expect(b64.length).toBeLessThan(1600)
  })

  it('step C starts with PNG and uses bit_depth=4', () => {
    const bin = atob(renderZoneImage(0, 2.5, 3.5, 1.5, 'C'))
    expect(bin.charCodeAt(24)).toBe(4) // bit_depth
  })
})

describe('formatZoneDiagnostic', () => {
  it('starts with ZONE-DBG header', () => {
    expect(formatZoneDiagnostic([], false)).toBe('ZONE-DBG')
  })

  it('formats a single sendFailed attempt correctly', () => {
    const result = formatZoneDiagnostic(
      [{ step: 'A', b64Chars: 3164, result: 'sendFailed' }],
      false,
    )
    expect(result).toBe('ZONE-DBG\nA:120x144 1b\n 3164chr sendFailed')
  })

  it('formats multiple attempts', () => {
    const result = formatZoneDiagnostic(
      [
        { step: 'A', b64Chars: 3164, result: 'sendFailed' },
        { step: 'B', b64Chars: 1500, result: 'imageException' },
      ],
      false,
    )
    expect(result).toBe(
      'ZONE-DBG\nA:120x144 1b\n 3164chr sendFailed\nB:80x96 1b\n 1500chr imageException'
    )
  })

  it('appends ALL FAILED when allFailed is true', () => {
    const result = formatZoneDiagnostic(
      [{ step: 'C', b64Chars: 1436, result: 'imageException' }],
      true,
    )
    expect(result).toContain('ALL FAILED')
  })

  it('does not append ALL FAILED when allFailed is false', () => {
    const result = formatZoneDiagnostic(
      [{ step: 'A', b64Chars: 3164, result: 'sendFailed' }],
      false,
    )
    expect(result).not.toContain('ALL FAILED')
  })
})
```

- [ ] **Step 3.2: Run tests, confirm failures**

```bash
npx vitest run src/glasses/zone.test.ts 2>&1 | tail -20
```

Expected: 9 failures — `renderZoneImage` and `formatZoneDiagnostic` not found.

- [ ] **Step 3.3: Add `renderZoneImage` to zone.ts**

Add immediately before the `// ── Strike zone PNG renderer` comment (after the `drawZonePixels` function):

```typescript
// Renders the zone image for the given cascade step — picks encoder and dimensions from CASCADE_CONFIG.
export function renderZoneImage(
  pX: number, pZ: number, szTop: number, szBot: number,
  step: CascadeStep,
): string {
  const { width, height, bitDepth } = CASCADE_CONFIG[step]
  const pixels = drawZonePixels(pX, pZ, szTop, szBot, width, height)
  return bitDepth === 1
    ? encodePNG1bit(pixels, width, height)
    : encodePNG4bit(pixels, width, height)
}
```

- [ ] **Step 3.4: Add `AttemptLog` and `formatZoneDiagnostic` to zone.ts**

Add at the bottom of `zone.ts`, after all existing exports:

```typescript
// ── Cascade diagnostic formatter ──────────────────────────────────────────────

export interface AttemptLog {
  step: CascadeStep
  b64Chars: number
  result: string
}

// Produces the SPLITS column diagnostic text during and after a cascade probe.
// Each attempt occupies two lines: "X:WxH Nb" then " NNNNchr <sdkResult>".
// Appends "ALL FAILED" on the final line when allFailed is true.
export function formatZoneDiagnostic(attempts: AttemptLog[], allFailed: boolean): string {
  const lines = ['ZONE-DBG']
  for (const a of attempts) {
    const { width, height, bitDepth } = CASCADE_CONFIG[a.step]
    lines.push(`${a.step}:${width}x${height} ${bitDepth}b`)
    lines.push(` ${a.b64Chars}chr ${a.result}`)
  }
  if (allFailed) lines.push('ALL FAILED')
  return lines.join('\n')
}
```

- [ ] **Step 3.5: Run all zone tests, confirm pass**

```bash
npx vitest run src/glasses/zone.test.ts 2>&1 | tail -10
```

Expected: all tests pass, 0 failures.

- [ ] **Step 3.6: Commit**

```bash
git add src/glasses/zone.ts src/glasses/zone.test.ts
git commit -m "feat: add renderZoneImage and formatZoneDiagnostic for cascade"
```

---

### Task 4: Wire cascade into main.ts

**Files:**
- Modify: `src/main.ts`

No unit tests — cascade calls the SDK bridge which can't be unit-tested. Verified via simulator in Task 5.

- [ ] **Step 4.1: Update imports in main.ts**

Replace the existing SDK import block:

```typescript
import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  ImageContainerProperty,
  ImageRawDataUpdate,
} from '@evenrealities/even_hub_sdk'
```

With:

```typescript
import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  ImageContainerProperty,
  ImageRawDataUpdate,
} from '@evenrealities/even_hub_sdk'
```

Replace the zone import:

```typescript
import { renderZoneCanvasRaw, renderZoneText } from './glasses/zone'
```

With:

```typescript
import {
  renderZoneText,
  renderZoneImage,
  nextCascadeStep,
  formatZoneDiagnostic,
  CASCADE_CONFIG,
} from './glasses/zone'
import type { CascadeStep, AttemptLog } from './glasses/zone'
```

- [ ] **Step 4.2: Replace layout constants with a dynamic geometry helper**

Remove the three `const` lines for `INFO_X`, `INFO_W`, `SPLITS_X`, `SPLITS_W` (currently computed once at module level). Replace with:

```typescript
// Geometry is zone-width-dependent. SPLITS is always pinned at x=350.
function zoneGeometry(zoneW: number) {
  const infoX   = zoneW + 2
  const splitsX = 350
  const infoW   = splitsX - infoX - 2   // 2px gap before splits
  const splitsW = 576 - splitsX
  return { infoX, infoW, splitsX, splitsW }
}
```

- [ ] **Step 4.3: Add cascade state variables**

Add after the `let displayInFlight = false` line:

```typescript
// ── Image cascade state ───────────────────────────────────────────────────────
// Probed once on the first pitch render; cached for the session.
let cascadeProbed  = false
let cascadeWorking: CascadeStep = 'A'
let cascadeAllFailed = false
let cascadeAttempts: AttemptLog[] = []
```

- [ ] **Step 4.4: Add `buildZoneContainers` helper**

Add before the `upgradeText` helper function:

```typescript
// Builds the CreateStartUpPageContainer or RebuildPageContainer payload for the
// given zone step. Used at startup (step A) and on re-layout (step B or C).
function zoneContainerPayload(step: CascadeStep, hdrContent: string, infoContent: string, splitsContent: string) {
  const cfg = CASCADE_CONFIG[step]
  const geo = zoneGeometry(cfg.width)
  return {
    containerTotalNum: 4,
    textObject: [
      new TextContainerProperty({
        xPosition: 0, yPosition: 0, width: 576, height: HEADER_H,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
        containerID: HDR_ID, containerName: HDR_NAME,
        content: hdrContent, isEventCapture: 0,
      }),
      new TextContainerProperty({
        xPosition: geo.infoX, yPosition: HEADER_H,
        width: geo.infoW, height: 288 - HEADER_H,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
        containerID: INFO_ID, containerName: INFO_NAME,
        content: infoContent, isEventCapture: 1,
      }),
      new TextContainerProperty({
        xPosition: geo.splitsX, yPosition: HEADER_H,
        width: geo.splitsW, height: 288 - HEADER_H,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
        containerID: SPLITS_ID, containerName: SPLITS_NAME,
        content: splitsContent, isEventCapture: 0,
      }),
    ],
    imageObject: [
      new ImageContainerProperty({
        xPosition: 0, yPosition: HEADER_H,
        width: cfg.width, height: cfg.height,
        containerID: ZONE_ID, containerName: ZONE_NAME,
      }),
    ],
  }
}
```

- [ ] **Step 4.5: Replace `renderPitch` with cascade version**

Delete the existing `renderPitch` function and replace with:

```typescript
async function renderPitch(
  header: string,
  pX: number,
  pZ: number,
  szTop: number,
  szBot: number,
  info: string,
  splits: string,
): Promise<void> {
  if (!bridge) return
  await upgradeText(HDR_ID, HDR_NAME, header)

  if (cascadeAllFailed) {
    // All image steps failed — prepend location label to info, show diagnostic in splits
    const label = renderZoneText(pX, pZ, szTop, szBot).split('\n')[0]
    await upgradeText(INFO_ID,    INFO_NAME,    `${label}\n${info}`)
    await upgradeText(SPLITS_ID,  SPLITS_NAME,  formatZoneDiagnostic(cascadeAttempts, true))
    return
  }

  if (!cascadeProbed) {
    // Pass header so runCascade can restore it after any rebuildPageContainer call
    await runCascade(header, pX, pZ, szTop, szBot, info)
    return
  }

  // Cascade already settled — just send image at the working step
  const b64 = renderZoneImage(pX, pZ, szTop, szBot, cascadeWorking)
  await bridge.updateImageRawData(new ImageRawDataUpdate({
    containerID: ZONE_ID, containerName: ZONE_NAME, imageData: b64,
  }))
  await upgradeText(INFO_ID,   INFO_NAME,   info)
  await upgradeText(SPLITS_ID, SPLITS_NAME, splits)
}
```

- [ ] **Step 4.6: Add `runCascade` function**

Add after the `renderPitch` function:

```typescript
// Runs the cascade probe on the first pitch render. Tries steps in order,
// rebuilds containers if the layout changes, and caches the working step.
// header is required so rebuildPageContainer calls can restore HDR content
// (rebuildPageContainer wipes all containers including the header).
async function runCascade(
  header: string,
  pX: number, pZ: number, szTop: number, szBot: number,
  info: string,
): Promise<void> {
  if (!bridge) return
  let step: CascadeStep = 'A'

  while (true) {
    const b64 = renderZoneImage(pX, pZ, szTop, szBot, step)
    const result = await bridge.updateImageRawData(new ImageRawDataUpdate({
      containerID: ZONE_ID, containerName: ZONE_NAME, imageData: b64,
    }))

    if (result === 'imageSizeInvalid') {
      // Stale container from old install — rebuild (passing header to restore HDR) then retry once
      await bridge.rebuildPageContainer(new RebuildPageContainer(
        zoneContainerPayload(step, header, '', '')
      ))
      const result2 = await bridge.updateImageRawData(new ImageRawDataUpdate({
        containerID: ZONE_ID, containerName: ZONE_NAME, imageData: b64,
      }))
      cascadeAttempts.push({ step, b64Chars: b64.length, result: result2 })
      if (result2 === 'success') {
        cascadeWorking = step
        cascadeProbed  = true
        await upgradeText(INFO_ID,   INFO_NAME,   info)
        await upgradeText(SPLITS_ID, SPLITS_NAME, formatZoneDiagnostic(cascadeAttempts, false))
        return
      }
      // Still failed after rebuild — advance cascade
      const next = nextCascadeStep(step, result2 === 'imageSizeInvalid' ? 'imageException' : result2)
      if (next === 'failed' || next === 'resize') break
      step = next
      continue
    }

    cascadeAttempts.push({ step, b64Chars: b64.length, result })

    if (result === 'success') {
      // If we advanced to B or C, rebuild containers for the smaller zone dimensions.
      // Pass header so HDR content survives the rebuild.
      if (step !== 'A') {
        await bridge.rebuildPageContainer(new RebuildPageContainer(
          zoneContainerPayload(step, header, '', '')
        ))
        // Re-send image to the newly sized container
        await bridge.updateImageRawData(new ImageRawDataUpdate({
          containerID: ZONE_ID, containerName: ZONE_NAME, imageData: b64,
        }))
      }
      cascadeWorking = step
      cascadeProbed  = true
      await upgradeText(INFO_ID,   INFO_NAME,   info)
      // Show diagnostic in splits for this one render so the working step is visible
      await upgradeText(SPLITS_ID, SPLITS_NAME, formatZoneDiagnostic(cascadeAttempts, false))
      return
    }

    // Show running diagnostic in splits while probing
    await upgradeText(SPLITS_ID, SPLITS_NAME, formatZoneDiagnostic(cascadeAttempts, false))

    const next = nextCascadeStep(step, result)
    if (next === 'failed' || next === 'resize') break
    step = next
  }

  // All steps exhausted
  cascadeAllFailed = true
  cascadeProbed    = true
  const label = renderZoneText(pX, pZ, szTop, szBot).split('\n')[0]
  await upgradeText(INFO_ID,   INFO_NAME,   `${label}\n${info}`)
  await upgradeText(SPLITS_ID, SPLITS_NAME, formatZoneDiagnostic(cascadeAttempts, true))
}
```

- [ ] **Step 4.7: Update `startGlassesMode` to use Step A container payload**

In `startGlassesMode`, replace the `createStartUpPageContainer` call with:

```typescript
await b.createStartUpPageContainer(new CreateStartUpPageContainer(
  zoneContainerPayload('A', 'StrikeZone', '', '')
))
```

- [ ] **Step 4.8: Update `_refreshDisplay` to pass pitch coordinates to `renderPitch`**

Find the two `renderPitch` call sites in `_refreshDisplay` (one for contact, one for regular pitch). Replace the existing `renderPitch(header, zonePixels, zoneLabel, info, splits)` signature.

Current call (contact):
```typescript
await renderPitch(
  renderPitchHeader(game, atBat),
  zonePixels,
  zoneLabel,
  renderContactInfo(atBat, pitch),
  splits,
)
```

Replace both calls with the new signature `renderPitch(header, pX, pZ, szTop, szBot, info, splits)`:

```typescript
// Contact play
await renderPitch(
  renderPitchHeader(game, atBat),
  pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot,
  renderContactInfo(atBat, pitch),
  splits,
)

// Regular pitch
await renderPitch(
  renderPitchHeader(game, atBat),
  pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot,
  renderPitchInfo(atBat, pitch, pitchIndex, atBat.pitches.length),
  splits,
)
```

Also remove the now-unused `zonePixels` and `zoneLabel` local variables:

```typescript
// Delete these two lines:
const zonePixels  = renderZoneCanvasRaw(pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot, ZONE_W, ZONE_H)
const zoneLabel   = renderZoneText(pitch.pX, pitch.pZ, pitch.szTop, pitch.szBot)
```

- [ ] **Step 4.9: Remove unused constants**

Remove the now-unused module-level constants `ZONE_W` and `ZONE_H`. The zone dimensions are now fully owned by `CASCADE_CONFIG`.

- [ ] **Step 4.10: Build to verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 4.11: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire image cascade into main.ts — try PNG steps A/B/C, diagnostic in SPLITS"
```

---

### Task 5: Simulator verification

**Prerequisites:** Even Hub simulator v0.7.2 installed, ehpk build tools available.

- [ ] **Step 5.1: Build and pack**

```bash
npm run build && even-hub-cli pack
```

Expected: `strikezone.ehpk` (or `strikezone_v1.0.ehpk`) rebuilt with no errors.

- [ ] **Step 5.2: Fully uninstall old version from simulator**

In the simulator, uninstall the existing StrikeZone app. A full uninstall is required to clear the stale container 2 type (previously registered as image in one session, text in another — the fresh install ensures it starts as an image container in Step A).

- [ ] **Step 5.3: Install fresh ehpk and start a game**

Install the newly built ehpk. Select a live or replayed game. Wait for the first pitch render.

- [ ] **Step 5.4: Read the SPLITS column and determine result**

**If the zone image renders (dot visible in the 3×3 grid):**
- The SPLITS column will show the cascade diagnostic for the first pitch, then normal splits on subsequent pitches
- Note which step worked (A, B, or C) from the diagnostic line that shows `OK` or no line at all (if A worked silently)
- Done — image rendering is working

**If the SPLITS column shows `ZONE-DBG`:**
- Read and record the full diagnostic text (step letter, dimensions, bit depth, char count, error code)
- Post the diagnostic text in the next session for analysis
- If `ALL FAILED` is shown, all three steps failed — post the full log

**If the display freezes or shows no content:**
- Check the simulator console for errors
- If `TextContainerUpgrade failed: container 2 is not a text container` appears, the uninstall was incomplete — fully uninstall and reinstall

- [ ] **Step 5.5: Commit final state**

```bash
git add -A
git status  # confirm only expected files changed
git commit -m "chore: verified zone image cascade in simulator"
```
