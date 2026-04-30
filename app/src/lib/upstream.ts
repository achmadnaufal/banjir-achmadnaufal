import { HISTORY_BASE, SNAPSHOT_URL } from '../config/station'
import {
  type HistoryPoint,
  type HistoryResponse,
  type SnapshotRow,
  type ThresholdsCm,
  UpstreamError,
} from '../types/upstream'
import { fetchText } from './http'

const JAKARTA_OFFSET = '+07:00'

function text(node: Element, tag: string): string | null {
  const el = node.getElementsByTagName(tag)[0]
  return el?.textContent?.trim() ?? null
}

function num(node: Element, tag: string): number | null {
  const raw = text(node, tag)
  if (raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parseTanggal(raw: string | null): Date | null {
  if (!raw) return null
  const candidate = raw.includes('T') ? raw : raw.replace(' ', 'T') + JAKARTA_OFFSET
  const d = new Date(candidate)
  return Number.isNaN(d.getTime()) ? null : d
}

function rowFromXml(node: Element): SnapshotRow | null {
  const id = num(node, 'ID_PINTU_AIR')
  const levelMm = num(node, 'TINGGI_AIR')
  const lat = num(node, 'LATITUDE')
  const lng = num(node, 'LONGITUDE')
  const siaga1 = num(node, 'SIAGA1')
  const siaga2 = num(node, 'SIAGA2')
  const siaga3 = num(node, 'SIAGA3')
  const observedAt = parseTanggal(text(node, 'TANGGAL'))

  if (
    id === null ||
    levelMm === null ||
    lat === null ||
    lng === null ||
    siaga1 === null ||
    siaga2 === null ||
    siaga3 === null ||
    observedAt === null
  ) {
    return null
  }

  const prevMm = num(node, 'TINGGI_AIR_SEBELUMNYA')

  return {
    id,
    name: text(node, 'NAMA_PINTU_AIR') ?? '',
    location: text(node, 'LOKASI') ?? '',
    lat,
    lng,
    thresholdsCm: {
      siaga1: siaga1 / 10,
      siaga2: siaga2 / 10,
      siaga3: siaga3 / 10,
    },
    observedAt,
    levelCm: levelMm / 10,
    prevLevelCm: prevMm === null ? null : prevMm / 10,
    statusText: text(node, 'STATUS_SIAGA') ?? '',
  }
}

export function parseSnapshotXml(xmlText: string): SnapshotRow[] {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const errEl = doc.getElementsByTagName('parsererror')[0]
  if (errEl) {
    throw new UpstreamError('parse', errEl.textContent ?? 'XML parse error')
  }
  const nodes = Array.from(doc.getElementsByTagName('SP_GET_LAST_STATUS_PINTU_AIR'))
  return nodes
    .map(rowFromXml)
    .filter((row): row is SnapshotRow => row !== null)
}

export function findStation(rows: SnapshotRow[], id: number): SnapshotRow | undefined {
  return rows.find((row) => row.id === id)
}

function parsePoint(s: string): HistoryPoint | null {
  const trimmed = s.trim()
  if (!trimmed) return null
  const idx = trimmed.indexOf(',')
  if (idx === -1) return null
  const stamp = trimmed.slice(0, idx).trim()
  const valStr = trimmed.slice(idx + 1).trim()
  if (!stamp || !valStr) return null

  const [datePart, timePart] = stamp.split(' ')
  if (!datePart || !timePart) return null
  const [hh, mm, ss] = timePart.split('.')
  if (!hh || !mm || !ss) return null
  const iso = `${datePart}T${hh.padStart(2, '0')}:${mm}:${ss}${JAKARTA_OFFSET}`
  const at = new Date(iso)
  const cm = Number(valStr)
  if (Number.isNaN(at.getTime()) || !Number.isFinite(cm)) return null
  return { at, cm }
}

function parseThresholds(s: string): ThresholdsCm | null {
  const parts = s.split(';').map((p) => p.trim()).filter(Boolean).map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  return { siaga1: parts[0], siaga2: parts[1], siaga3: parts[2] }
}

export function parseHistoryBody(body: string): HistoryResponse {
  const cleaned = body.split('<')[0].trim()
  if (!cleaned) return { points: [], thresholdsCm: null }

  const segments = cleaned.split('|').map((s) => s.trim()).filter(Boolean)
  const pointsCsv = segments[0] ?? ''
  const thresholdsCsv = segments[1] ?? ''

  const points = pointsCsv
    .split(';')
    .map(parsePoint)
    .filter((p): p is HistoryPoint => p !== null)

  return {
    points,
    thresholdsCm: thresholdsCsv ? parseThresholds(thresholdsCsv) : null,
  }
}

export async function fetchSnapshot(opts: { signal?: AbortSignal } = {}): Promise<SnapshotRow[]> {
  const text = await fetchText(SNAPSHOT_URL, opts)
  return parseSnapshotXml(text)
}

const JAKARTA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function jakartaDateParts(d: Date): { year: string; month: string; day: string } {
  const parts = JAKARTA_DATE.formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return { year: get('year'), month: get('month'), day: get('day') }
}

function ddMMyyyy(d: Date): string {
  const { year, month, day } = jakartaDateParts(d)
  return `${day}-${month}-${year}`
}

export function buildHistoryUrl(id: number, start: Date, end: Date): string {
  const params = new URLSearchParams({
    IdPintuAir: String(id),
    StartDate: ddMMyyyy(start),
    EndDate: ddMMyyyy(end),
  })
  return `${HISTORY_BASE}?${params.toString()}`
}

export async function fetchHistory(
  id: number,
  start: Date,
  end: Date,
  opts: { signal?: AbortSignal } = {},
): Promise<HistoryResponse> {
  const body = await fetchText(buildHistoryUrl(id, start, end), opts)
  return parseHistoryBody(body)
}
