import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  formatLevel,
  formatStamp,
  mmToCm,
  timeSince,
  trendArrow,
} from './format'

describe('mmToCm', () => {
  it('divides by 10', () => {
    expect(mmToCm(2780)).toBe(278)
    expect(mmToCm(0)).toBe(0)
  })
})

describe('formatLevel', () => {
  it('shows cm and meters with two decimals', () => {
    expect(formatLevel(280)).toBe('280 cm (2.80 m)')
    expect(formatLevel(0)).toBe('0 cm (0.00 m)')
    expect(formatLevel(7)).toBe('7 cm (0.07 m)')
  })

  it('rounds cm to whole numbers', () => {
    expect(formatLevel(279.6)).toBe('280 cm (2.80 m)')
  })
})

describe('timeSince', () => {
  const now = new Date('2026-04-30T15:00:00+07:00')

  it('returns "just now" for under one minute', () => {
    expect(timeSince(new Date(now.getTime() - 30_000), now)).toBe('just now')
    expect(timeSince(new Date(now.getTime() - 59_000), now)).toBe('just now')
  })

  it('returns minutes for under an hour', () => {
    expect(timeSince(new Date(now.getTime() - 4 * 60_000), now)).toBe('4 min ago')
    expect(timeSince(new Date(now.getTime() - 59 * 60_000), now)).toBe('59 min ago')
  })

  it('returns hours for under a day', () => {
    expect(timeSince(new Date(now.getTime() - 2 * 3_600_000), now)).toBe('2 h ago')
    expect(timeSince(new Date(now.getTime() - 23 * 3_600_000), now)).toBe('23 h ago')
  })

  it('returns days beyond 24h', () => {
    expect(timeSince(new Date(now.getTime() - 2 * 86_400_000), now)).toBe('2 d ago')
  })

  it('handles future timestamps as just now', () => {
    expect(timeSince(new Date(now.getTime() + 30_000), now)).toBe('just now')
  })
})

describe('formatStamp', () => {
  it('renders Jakarta-time stamps with WIB suffix', () => {
    const d = new Date('2026-04-30T14:32:00+07:00')
    expect(formatStamp(d)).toMatch(/30 Apr 2026, 14:32 WIB/)
  })
})

describe('formatDuration', () => {
  it('renders "0 min" for very small or negative durations', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(-10_000)).toBe('0 min')
  })
  it('renders minutes only under one hour', () => {
    expect(formatDuration(45 * 60_000)).toBe('45 min')
  })
  it('renders Hh Mm under one day', () => {
    expect(formatDuration(80 * 60_000)).toBe('1h 20m')
    expect(formatDuration(3 * 3600_000)).toBe('3h 0m')
  })
  it('renders days for spans >= 24h', () => {
    expect(formatDuration(2 * 86_400_000)).toBe('2 d')
    expect(formatDuration(2.5 * 86_400_000)).toBe('2 d')
  })
  it('compact mode strips spaces', () => {
    expect(formatDuration(80 * 60_000, { compact: true })).toBe('1h20m')
    expect(formatDuration(45 * 60_000, { compact: true })).toBe('45m')
    expect(formatDuration(86_400_000, { compact: true })).toBe('1d')
  })
})

describe('trendArrow', () => {
  it('maps up/down/flat to arrows', () => {
    expect(trendArrow('up')).toBe('▲')
    expect(trendArrow('down')).toBe('▼')
    expect(trendArrow('flat')).toBe('■')
  })
})
