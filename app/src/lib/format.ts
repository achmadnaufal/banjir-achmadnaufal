import type { Trend } from './siaga'

export function mmToCm(mm: number): number {
  return mm / 10
}

export function formatLevel(cm: number): string {
  const rounded = Math.round(cm)
  const meters = (rounded / 100).toFixed(2)
  return `${rounded} cm (${meters} m)`
}

const RELATIVE_CACHE = new Map<string, Intl.RelativeTimeFormat>()

function relative(tag: string): Intl.RelativeTimeFormat {
  let f = RELATIVE_CACHE.get(tag)
  if (!f) {
    f = new Intl.RelativeTimeFormat(tag, { numeric: 'always', style: 'short' })
    RELATIVE_CACHE.set(tag, f)
  }
  return f
}

/**
 * Relative age of a reading. Intl handles the wording and plural rules per
 * locale; only the sub-minute case is ours, because "0 minutes ago" is not
 * what anyone means by a reading that just landed.
 */
export function timeSince(from: Date, now: Date, tag: string, justNow: string): string {
  const diffMs = now.getTime() - from.getTime()
  if (diffMs < 60_000) return justNow
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return relative(tag).format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relative(tag).format(-hours, 'hour')
  return relative(tag).format(-Math.floor(hours / 24), 'day')
}

const STAMP_CACHE = new Map<string, Intl.DateTimeFormat>()

function stampFormatter(tag: string): Intl.DateTimeFormat {
  let f = STAMP_CACHE.get(tag)
  if (!f) {
    f = new Intl.DateTimeFormat(tag, {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    STAMP_CACHE.set(tag, f)
  }
  return f
}

export function formatStamp(d: Date, tag: string): string {
  const parts = stampFormatter(tag).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const day = get('day')
  const month = get('month')
  const year = get('year')
  const hour = get('hour')
  const minute = get('minute')
  return `${day} ${month} ${year}, ${hour}:${minute} WIB`
}

export function trendArrow(t: Trend): '▲' | '▼' | '■' {
  if (t === 'up') return '▲'
  if (t === 'down') return '▼'
  return '■'
}

export type DurationUnits = {
  durationDay: (n: number) => string
  durationHourMin: (h: number, m: number) => string
  durationMin: (n: number) => string
}

/**
 * Elapsed/remaining time. Intl.DurationFormat is not available widely enough
 * to rely on, so the unit wording comes from the message catalogue.
 */
export function formatDuration(ms: number, u: DurationUnits): string {
  if (ms <= 0) return u.durationMin(0)
  const totalMin = Math.floor(ms / 60_000)
  if (totalMin >= 60 * 24) return u.durationDay(Math.floor(totalMin / (60 * 24)))
  if (totalMin >= 60) return u.durationHourMin(Math.floor(totalMin / 60), totalMin % 60)
  return u.durationMin(totalMin)
}
