import type { Locale } from '../../app/src/i18n/locale'
import { classify, siagaMeta, trend, type SiagaLevel, type Trend } from '../../app/src/lib/siaga'
import type { ThresholdsCm } from '../../app/src/types/upstream'
import type { AlertKind } from './rules'
import type { RiverReading } from './river'

export type { Locale }

/** What the service worker turns into a notification. */
export type PushPayload = { title: string; body: string; tag: string; url: string }

const URL = '/?source=push'
const STATION = 'Pos Pesanggrahan'

type Copy = {
  trend: Record<Trend, string>
  rateUnit: string
  at: string
  allClear: string
  testTitle: string
  testBody: string
  ownerTitle: string
  ownerBody: (time: string) => string
}

const COPY: Record<Locale, Copy> = {
  id: {
    trend: { up: '▲ naik', down: '▼ turun', flat: '■ datar' },
    rateUnit: 'cm/jam',
    at: 'di',
    allClear: 'Kembali normal',
    testTitle: 'Tes peringatan banjir',
    testBody: 'Peringatan aktif di ponsel ini.',
    ownerTitle: 'Peringatan banjir tidak bisa membaca sungai',
    ownerBody: (time) => `Bacaan terakhir: ${time}`,
  },
  en: {
    trend: { up: '▲ rising', down: '▼ falling', flat: '■ steady' },
    rateUnit: 'cm/h',
    at: 'at',
    allClear: 'Back to normal',
    testTitle: 'Flood alert test',
    testBody: 'Alerts are on for this phone.',
    ownerTitle: "Flood alerts can't read the river",
    ownerBody: (time) => `Last reading: ${time}`,
  },
}

const WIB_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function wib(d: Date): string {
  return WIB_CLOCK.format(d)
}

function formatRate(rate: number, unit: string): string {
  const n = Math.round(rate)
  const signed = n > 0 ? `+${n}` : n === 0 ? '0' : String(n)
  return `${signed} ${unit}`
}

/** The lowest band threshold above the level, if any. */
function nextBand(levelCm: number, t: ThresholdsCm): { level: SiagaLevel; cm: number } | null {
  const above = [t.siaga3, t.siaga2, t.siaga1].find((cm) => cm > levelCm)
  return above === undefined ? null : { level: classify(above, t), cm: Math.round(above) }
}

function alertBody(r: RiverReading, c: Copy): string {
  const next = nextBand(r.levelCm, r.thresholdsCm)
  const parts = [
    `${STATION}, ${wib(r.observedAt)}`,
    r.ratePerHour === null ? null : formatRate(r.ratePerHour, c.rateUnit),
    next === null ? null : `${siagaMeta(next.level).label} ${c.at} ${next.cm} cm`,
  ]
  return parts.filter((p): p is string => p !== null).join(' · ')
}

export function buildAlertPayload(kind: AlertKind, r: RiverReading, locale: Locale): PushPayload {
  const c = COPY[locale]
  const cm = Math.round(r.levelCm)
  if (kind === 'allClear') {
    return { title: `${c.allClear} · ${cm} cm`, body: `${STATION}, ${wib(r.observedAt)}`, tag: 'banjir-normal', url: URL }
  }
  return {
    title: `${siagaMeta(r.band).label} · ${cm} cm ${c.trend[trend(r.prevLevelCm, r.levelCm)]}`,
    body: alertBody(r, c),
    tag: `banjir-${r.band}`,
    url: URL,
  }
}

export function buildTestPayload(locale: Locale): PushPayload {
  const c = COPY[locale]
  return { title: c.testTitle, body: c.testBody, tag: 'banjir-test', url: URL }
}

export function buildOwnerPayload(lastReadingAt: Date | null, locale: Locale): PushPayload {
  const c = COPY[locale]
  return {
    title: c.ownerTitle,
    body: c.ownerBody(lastReadingAt === null ? '—' : wib(lastReadingAt)),
    tag: 'banjir-owner',
    url: URL,
  }
}
