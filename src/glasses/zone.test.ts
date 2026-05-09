import { describe, it, expect } from 'vitest'
import { getDotPosition, renderZoneImageData } from './zone'

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

describe('renderZoneImageData', () => {
  const W = 128, H = 128

  it('returns width × height pixels', () => {
    const data = renderZoneImageData(0, 2.5, SZ_TOP, SZ_BOT, W, H)
    expect(data).toHaveLength(W * H)
  })

  it('all pixels are in range 0–15', () => {
    const data = renderZoneImageData(0, 2.5, SZ_TOP, SZ_BOT, W, H)
    expect(data.every(v => v >= 0 && v <= 15)).toBe(true)
  })

  it('has some white pixels (zone border + ball)', () => {
    const data = renderZoneImageData(0, 2.5, SZ_TOP, SZ_BOT, W, H)
    expect(data.some(v => v === 15)).toBe(true)
  })

  it('ball pixel near expected position for center pitch', () => {
    const data = renderZoneImageData(0, 2.5, SZ_TOP, SZ_BOT, W, H)
    // Center pitch (pX=0, pZ=2.5) should map near the center of the image
    const cx = Math.floor(W / 2)
    const cy = Math.floor(H / 2)
    const nearby = data.slice((cy - 5) * W + (cx - 5), (cy - 5) * W + (cx + 5))
    expect(nearby.some(v => v === 15)).toBe(true)
  })
})
