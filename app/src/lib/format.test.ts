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
    expect(timeSince(new Date(now.getTime() - 30_000), now)).toBe('baru saja')
    expect(timeSince(new Date(now.getTime() - 59_000), now)).toBe('baru saja')
  })

  it('returns minutes for under an hour', () => {
    expect(timeSince(new Date(now.getTime() - 4 * 60_000), now)).toBe('4 mnt lalu')
    expect(timeSince(new Date(now.getTime() - 59 * 60_000), now)).toBe('59 mnt lalu')
  })

  it('returns hours for under a day', () => {
    expect(timeSince(new Date(now.getTime() - 2 * 3_600_000), now)).toBe('2 jam lalu')
    expect(timeSince(new Date(now.getTime() - 23 * 3_600_000), now)).toBe('23 jam lalu')
  })

  it('returns days beyond 24h', () => {
    expect(timeSince(new Date(now.getTime() - 2 * 86_400_000), now)).toBe('2 hari lalu')
  })

  it('handles future timestamps as just now', () => {
    expect(timeSince(new Date(now.getTime() + 30_000), now)).toBe('baru saja')
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
    expect(formatDuration(0)).toBe('0 mnt')
    expect(formatDuration(-10_000)).toBe('0 mnt')
  })
  it('renders minutes only under one hour', () => {
    expect(formatDuration(45 * 60_000)).toBe('45 mnt')
  })
  it('renders Hh Mm under one day', () => {
    expect(formatDuration(80 * 60_000)).toBe('1j 20mnt')
    expect(formatDuration(3 * 3600_000)).toBe('3j 0mnt')
  })
  it('renders days for spans >= 24h', () => {
    expect(formatDuration(2 * 86_400_000)).toBe('2 hari')
    expect(formatDuration(2.5 * 86_400_000)).toBe('2 hari')
  })
  it('compact mode strips spaces', () => {
    expect(formatDuration(80 * 60_000, { compact: true })).toBe('1j20m')
    expect(formatDuration(45 * 60_000, { compact: true })).toBe('45m')
    expect(formatDuration(86_400_000, { compact: true })).toBe('1hr')
  })
})

describe('trendArrow', () => {
  it('maps up/down/flat to arrows', () => {
    expect(trendArrow('up')).toBe('▲')
    expect(trendArrow('down')).toBe('▼')
    expect(trendArrow('flat')).toBe('■')
  })
})
