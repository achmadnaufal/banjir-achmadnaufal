import { OPEN_METEO_URL, type LatLngBounds } from '../config/forecast'
import { UpstreamError } from '../types/upstream'
import { bilinear } from './rainImage'

export type GridPoint = { lat: number; lng: number }

export type RainGrid = {
  bounds: LatLngBounds
  rows: number
  cols: number
  /** Cell centres, row-major, row 0 = northernmost (matches image rows). */
  points: readonly GridPoint[]
}

export type RainFrame = {
  startsAt: Date
  endsAt: Date
  /** Rain over the hour per cell, in grid order. NaN = model had no value. */
  mm: number[]
}

export type UpstreamSummary = {
  totalMm: number
  peak: { frameIndex: number; mm: number } | null
}

const HOUR_MS = 60 * 60 * 1000

export function buildGrid(bounds: LatLngBounds, rows: number, cols: number): RainGrid {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    throw new RangeError(`Grid needs at least 1×1 cells, got ${rows}×${cols}`)
  }
  if (bounds.north <= bounds.south || bounds.east <= bounds.west) {
    throw new RangeError('Grid bounds are empty or inverted')
  }
  const latStep = (bounds.north - bounds.south) / rows
  const lngStep = (bounds.east - bounds.west) / cols
  const points = Array.from({ length: rows * cols }, (_, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    return Object.freeze({
      lat: bounds.north - (row + 0.5) * latStep,
      lng: bounds.west + (col + 0.5) * lngStep,
    })
  })
  return Object.freeze({ bounds, rows, cols, points: Object.freeze(points) })
}

const coord = (n: number) => String(Number(n.toFixed(4)))

export function buildForecastUrl(grid: RainGrid, hours: number): string {
  const params = new URLSearchParams({
    latitude: grid.points.map((p) => coord(p.lat)).join(','),
    longitude: grid.points.map((p) => coord(p.lng)).join(','),
    hourly: 'precipitation',
    timeformat: 'unixtime',
    timezone: 'GMT',
    // Open-Meteo's first hourly value is the hour that is already running
    // (each value is the sum over the preceding hour), so ask for one extra.
    forecast_hours: String(hours + 1),
  })
  return `${OPEN_METEO_URL}?${params.toString()}`
}

type ParsedLocation = { times: number[]; mm: number[] }

function parseError(message: string): UpstreamError {
  return new UpstreamError('parse', `Rain forecast: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseLocation(value: unknown, index: number): ParsedLocation {
  const hourly = isRecord(value) ? value.hourly : undefined
  if (!isRecord(hourly) || !Array.isArray(hourly.time) || !Array.isArray(hourly.precipitation)) {
    throw parseError(`location ${index} has no hourly precipitation`)
  }
  const { time, precipitation } = hourly
  if (time.length !== precipitation.length) {
    throw parseError(`location ${index} has ${time.length} times but ${precipitation.length} values`)
  }
  if (!time.every((t) => typeof t === 'number' && Number.isFinite(t))) {
    throw parseError(`location ${index} has a non-numeric timestamp`)
  }
  const mm = precipitation.map((v) => {
    if (v === null) return Number.NaN
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw parseError(`location ${index} has a non-numeric precipitation value`)
    }
    return v
  })
  return { times: time as number[], mm }
}

/**
 * Turns an Open-Meteo multi-location response into map frames. Only hours
 * that have not finished yet are kept, oldest first, up to `maxFrames`.
 */
export function parseForecast(
  body: unknown,
  grid: RainGrid,
  now: Date,
  maxFrames: number,
): RainFrame[] {
  const list = Array.isArray(body) ? body : [body]
  if (list.length !== grid.points.length) {
    throw parseError(`expected ${grid.points.length} locations, got ${list.length}`)
  }
  const locations = list.map(parseLocation)
  const axis = locations[0].times
  const sameAxis = locations.every(
    (loc) => loc.times.length === axis.length && loc.times.every((t, i) => t === axis[i]),
  )
  if (!sameAxis) throw parseError('locations disagree on the time axis')

  const nowMs = now.getTime()
  return axis
    .map((t, i) => ({ endsAtMs: t * 1000, index: i }))
    .filter(({ endsAtMs }) => endsAtMs > nowMs)
    .slice(0, Math.max(0, maxFrames))
    .map(({ endsAtMs, index }) => ({
      startsAt: new Date(endsAtMs - HOUR_MS),
      endsAt: new Date(endsAtMs),
      mm: locations.map((loc) => loc.mm[index]),
    }))
}

/** Forecast value at any lat/lng inside the grid, interpolated between cells. */
export function sampleField(grid: RainGrid, mm: readonly number[], lat: number, lng: number): number {
  const { bounds, rows, cols } = grid
  const row = ((bounds.north - lat) / (bounds.north - bounds.south)) * rows - 0.5
  const col = ((lng - bounds.west) / (bounds.east - bounds.west)) * cols - 0.5
  return bilinear(mm, rows, cols, row, col)
}

function areaMean(grid: RainGrid, mm: readonly number[], points: readonly GridPoint[]): number {
  const values = points.map((p) => sampleField(grid, mm, p.lat, p.lng)).filter(Number.isFinite)
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Area-average rain over the upstream sample points: total and wettest hour.
 * Sampling the field (rather than counting whole cells) keeps the catchment
 * number meaningful when the map grid is coarser than the catchment itself.
 */
export function upstreamSummary(
  frames: readonly RainFrame[],
  grid: RainGrid,
  points: readonly GridPoint[],
): UpstreamSummary {
  const perFrame = frames.map((f) => areaMean(grid, f.mm, points))
  const totalMm = perFrame.reduce((sum, v) => sum + v, 0)
  const peak = perFrame.reduce<UpstreamSummary['peak']>(
    (best, mm, frameIndex) => (mm > 0 && (best === null || mm > best.mm) ? { frameIndex, mm } : best),
    null,
  )
  return { totalMm, peak }
}
