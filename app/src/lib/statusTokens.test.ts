import { describe, expect, it } from 'vitest'
import { STATUS_HEX, statusToken } from './statusTokens'
import type { SiagaLevel } from './siaga'

const LEVELS: SiagaLevel[] = ['normal', 'siaga3', 'siaga2', 'siaga1']

describe('statusToken', () => {
  it('maps the four bands onto the reserved good→critical status scale', () => {
    expect(LEVELS.map((l) => statusToken(l).role)).toEqual([
      'good',
      'warning',
      'serious',
      'critical',
    ])
  })

  it('uses the validated status steps', () => {
    expect(STATUS_HEX).toEqual({
      good: '#0ca30c',
      warning: '#fab219',
      serious: '#ec835a',
      critical: '#d03b3b',
    })
  })

  // Measured with the dataviz validator's contrast(): white clears 4.5 only on
  // critical (4.80); dark ink clears it on the other three (5.87 / 10.73 / 7.46).
  it('pairs each chip with an ink that clears 4.5:1 against it', () => {
    expect(LEVELS.map((l) => statusToken(l).chipInk)).toEqual([
      'dark',
      'dark',
      'dark',
      'light',
    ])
  })

  it('gives every band an icon so status is never colour alone', () => {
    for (const level of LEVELS) {
      expect(statusToken(level).icon).toBeTruthy()
    }
    // Distinct glyphs — a shared icon would put the load back on hue.
    expect(new Set(LEVELS.map((l) => statusToken(l).icon)).size).toBe(4)
  })

  it('escalates severity rank with the band', () => {
    const ranks = LEVELS.map((l) => statusToken(l).severity)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })
})
