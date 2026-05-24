import { describe, it, expect } from 'vitest'
import {
  getDotPosition, renderZoneText, renderZoneCanvas, renderZoneBlank,
  encodePNG4bit, nextCascadeStep, renderZoneImage, formatZoneDiagnostic,
} from './zone'

const SZ_TOP = 3.5
const SZ_BOT = 1.5

describe('getDotPosition', () => {
  it('maps center zone correctly (zone 4/5, row 1, col 1)', () => {
    const pos = getDotPosition(0, 2.5, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: true, row: 1, col: 1 })
  })

  it('maps top-left zone (zone 1, row 0, col 0)', () => {
    const pos = getDotPosition(-0.6, 3.3, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: true, row: 0, col: 0 })
  })

  it('maps bottom-right zone (zone 9, row 2, col 2)', () => {
    const pos = getDotPosition(0.6, 1.7, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: true, row: 2, col: 2 })
  })

  it('returns dirt for pitch well below zone', () => {
    const pos = getDotPosition(0, 0.5, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: false, vPos: 'below', hPos: 1 })
  })

  it('returns high for pitch above zone', () => {
    const pos = getDotPosition(0, 4.5, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: false, vPos: 'above', hPos: 1 })
  })

  it('returns left for pitch outside horizontal zone', () => {
    const pos = getDotPosition(-1.5, 2.5, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: false, vPos: 1, hPos: 'left' })
  })

  it('returns right for pitch outside horizontal zone', () => {
    const pos = getDotPosition(1.5, 2.5, SZ_TOP, SZ_BOT)
    expect(pos).toEqual({ inZone: false, vPos: 1, hPos: 'right' })
  })
})

describe('renderZoneText', () => {
  // Layout: label (line 0) + TOP (line 1) + [row + DIV] × 3 = 8 lines total.
  // Dot sits in the matching cell row; out-of-zone shown via label chars only.

  it('renders 8 lines for an in-zone pitch', () => {
    const lines = renderZoneText(0, 2.5, SZ_TOP, SZ_BOT).split('\n')
    expect(lines).toHaveLength(8)
  })

  it('places box-drawing borders at lines 1, 3, 5, 7', () => {
    const lines = renderZoneText(0, 2.5, SZ_TOP, SZ_BOT).split('\n')
    expect(lines[1]).toBe('┌─┬─┬─┐')
    expect(lines[3]).toBe('├─┼─┼─┤')
    expect(lines[5]).toBe('├─┼─┼─┤')
    expect(lines[7]).toBe('└─┴─┴─┘')
  })

  it('places dot at mid-center (row 1 col 1): line 4', () => {
    const lines = renderZoneText(0, 2.5, SZ_TOP, SZ_BOT).split('\n')
    expect(lines[4]).toBe('│ │●│ │')
  })

  it('shows "Md/M" label for mid-center pitch', () => {
    const lines = renderZoneText(0, 2.5, SZ_TOP, SZ_BOT).split('\n')
    expect(lines[0]).toBe('Md/M')
  })

  it('places dot at high-left (row 0 col 0): line 2', () => {
    const lines = renderZoneText(-0.6, 3.3, SZ_TOP, SZ_BOT).split('\n')
    expect(lines[2]).toBe('│●│ │ │')
  })

  it('shows "Hi/L" label for high-left pitch', () => {
    const lines = renderZoneText(-0.6, 3.3, SZ_TOP, SZ_BOT).split('\n')
    expect(lines[0]).toBe('Hi/L')
  })

  it('places dot at low-right (row 2 col 2): line 6', () => {
    const lines = renderZoneText(0.6, 1.7, SZ_TOP, SZ_BOT).split('\n')
    expect(lines[6]).toBe('│ │ │●│')
  })

  it('all non-dot grid body rows are empty "│ │ │ │"', () => {
    const lines = renderZoneText(0, 2.5, SZ_TOP, SZ_BOT).split('\n')
    // dot at line 4; non-dot body rows are 2 and 6
    expect(lines[2]).toBe('│ │ │ │')
    expect(lines[6]).toBe('│ │ │ │')
  })

  it('shows ↑ in label for pitch above zone', () => {
    const lines = renderZoneText(0, 4.5, SZ_TOP, SZ_BOT).split('\n')
    expect(lines).toHaveLength(8)
    expect(lines[0]).toContain('↑')
    expect(lines[1]).toBe('┌─┬─┬─┐')
  })

  it('shows ► in label for pitch to the right', () => {
    const lines = renderZoneText(1.5, 2.5, SZ_TOP, SZ_BOT).split('\n')
    expect(lines).toHaveLength(8)
    expect(lines[0]).toContain('►')
  })
})

describe('renderZoneCanvas / renderZoneBlank (1-bit PNG)', () => {
  const W = 60, H = 72

  it('blank zone base64 length is ~1 KB (within BLE limit)', () => {
    const b64 = renderZoneBlank(W, H)
    // 1-bit PNG at 60×72: rowBytes=8, raw=72×9=648 bytes → ~974 base64 chars
    expect(b64.length).toBeGreaterThan(900)
    expect(b64.length).toBeLessThan(1100)
  })

  it('renderZoneCanvas is same size as blank for in-zone pitch', () => {
    const canvas = renderZoneCanvas(0, 2.5, SZ_TOP, SZ_BOT, W, H)
    const blank  = renderZoneBlank(W, H)
    // 1-bit PNG size depends only on dimensions, not pixel values
    expect(canvas.length).toBe(blank.length)
  })

  it('output is valid base64 (only A-Za-z0-9+/=)', () => {
    const b64 = renderZoneBlank(W, H)
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('starts with PNG signature when decoded', () => {
    const b64 = renderZoneBlank(W, H)
    const binary = atob(b64)
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    expect(binary.charCodeAt(0)).toBe(0x89)
    expect(binary.charCodeAt(1)).toBe(0x50)  // P
    expect(binary.charCodeAt(2)).toBe(0x4e)  // N
    expect(binary.charCodeAt(3)).toBe(0x47)  // G
  })
})

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

describe('nextCascadeStep', () => {
  it('A + sendFailed → B', () => {
    expect(nextCascadeStep('A', 'sendFailed')).toBe('B')
  })

  it('B + sendFailed → C (C is 48 bytes smaller binary, may clear BLE limit)', () => {
    expect(nextCascadeStep('B', 'sendFailed')).toBe('C')
  })

  it('C + sendFailed → failed', () => {
    expect(nextCascadeStep('C', 'sendFailed')).toBe('failed')
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

  it('C + imageException or imageToGray4Failed → failed', () => {
    expect(nextCascadeStep('C', 'imageException')).toBe('failed')
    expect(nextCascadeStep('C', 'imageToGray4Failed')).toBe('failed')
  })

  it('imageSizeInvalid → resize (caller handles rebuildPageContainer)', () => {
    expect(nextCascadeStep('A', 'imageSizeInvalid')).toBe('resize')
    expect(nextCascadeStep('B', 'imageSizeInvalid')).toBe('resize')
  })

  it('unknown error → failed', () => {
    expect(nextCascadeStep('A', 'somethingElse')).toBe('failed')
  })
})

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

  it('step A starts with PNG and uses bit_depth=1', () => {
    const bin = atob(renderZoneImage(0, 2.5, 3.5, 1.5, 'A'))
    expect(bin.charCodeAt(24)).toBe(1) // bit_depth
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
    expect(result).toBe('ZONE-DBG\nC:40x48 4b\n 1436chr imageException\nALL FAILED')
  })

  it('does not append ALL FAILED when allFailed is false', () => {
    const result = formatZoneDiagnostic(
      [{ step: 'A', b64Chars: 3164, result: 'sendFailed' }],
      false,
    )
    expect(result).not.toContain('ALL FAILED')
  })
})
