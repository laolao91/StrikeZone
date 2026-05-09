import { describe, it, expect } from 'vitest'
import { formatPitchType } from './pitch-types'

describe('formatPitchType', () => {
  it('returns display label for known Statcast code', () => {
    expect(formatPitchType('FF', 'Four-Seam Fastball')).toBe('4-Seam FF')
    expect(formatPitchType('SL', 'Slider')).toBe('Slider SL')
    expect(formatPitchType('CU', 'Curveball')).toBe('Curve CU')
    expect(formatPitchType('ST', 'Sweeper')).toBe('Sweeper ST')
    expect(formatPitchType('SI', 'Sinker')).toBe('Sinker SI')
    expect(formatPitchType('CH', 'Changeup')).toBe('Change CH')
    expect(formatPitchType('FC', 'Cut Fastball')).toBe('Cutter FC')
  })

  it('falls back to description + code for unknown pitch', () => {
    expect(formatPitchType('XX', 'Mystery Pitch')).toBe('Mystery Pitch XX')
  })

  it('handles empty description gracefully', () => {
    expect(formatPitchType('FF', '')).toBe('4-Seam FF')
  })
})
