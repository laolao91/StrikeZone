import { describe, it, expect } from 'vitest'
import { getDotPosition, renderZoneGrid } from './zone'

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

describe('renderZoneGrid', () => {
  it('renders 7 rows for in-zone pitch', () => {
    const pos = getDotPosition(0, 2.5, SZ_TOP, SZ_BOT)
    const rows = renderZoneGrid(pos)
    expect(rows).toHaveLength(7)
  })

  it('places dot in center of top row for zone (0,1)', () => {
    const pos = getDotPosition(0, 3.3, SZ_TOP, SZ_BOT)
    const rows = renderZoneGrid(pos)
    expect(rows[1]).toBe('| |●| |')
  })

  it('places dot in bottom-right cell for zone (2,2)', () => {
    const pos = getDotPosition(0.6, 1.7, SZ_TOP, SZ_BOT)
    const rows = renderZoneGrid(pos)
    expect(rows[5]).toBe('| | |●|')
  })

  it('renders 8 rows and adds dot below for low pitch', () => {
    const pos = getDotPosition(0, 0.5, SZ_TOP, SZ_BOT)
    const rows = renderZoneGrid(pos)
    expect(rows).toHaveLength(8)
    expect(rows[7]).toContain('●')
  })

  it('renders 8 rows and adds dot above for high pitch', () => {
    const pos = getDotPosition(0, 4.5, SZ_TOP, SZ_BOT)
    const rows = renderZoneGrid(pos)
    expect(rows).toHaveLength(8)
    expect(rows[0]).toContain('●')
  })
})
