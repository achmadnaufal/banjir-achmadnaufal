import type { Trend } from './siaga'

export function mmToCm(mm: number): number {
  return mm / 10
}

export function formatLevel(cm: number): string {
  const rounded = Math.round(cm)
  const meters = (rounded / 100).toFixed(2)
  return `${rounded} cm (${meters} m)`
}

export function timeSince(from: Date, now: Date): string {
  const diffMs = now.getTime() - from.getTime()
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} d ago`
}

const STAMP_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatStamp(d: Date): string {
  const parts = STAMP_FORMATTER.formatToParts(d)
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

export type DurationOpts = { compact?: boolean }

export function formatDuration(ms: number, opts: DurationOpts = {}): string {
  const compact = opts.compact === true
  if (ms <= 0) return compact ? '0m' : '0 min'
  const totalMin = Math.floor(ms / 60_000)
  if (totalMin >= 60 * 24) {
    const days = Math.floor(totalMin / (60 * 24))
    return compact ? `${days}d` : `${days} d`
  }
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return compact ? `${h}h${m}m` : `${h}h ${m}m`
  }
  return compact ? `${totalMin}m` : `${totalMin} min`
}
