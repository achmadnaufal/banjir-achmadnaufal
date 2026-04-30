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
