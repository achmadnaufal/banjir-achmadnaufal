import type { LatLngBounds } from '../config/forecast'
import { sampleField, type RainFrame, type RainGrid } from './rainForecast'

export type Field = { grid: RainGrid; mm: readonly number[] }

/** One hour with both layers' values; either side may be missing. */
export type CompositeFrame = {
  startsAt: Date
  endsAt: Date
  region: number[] | null
  detail: number[] | null
}

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/**
 * How much the detail grid counts at a point: 1 well inside its box, easing
 * to 0 over `fadeDeg` at the edges, 0 outside. The ease keeps the seam
 * between the ~8 km detail and the ~16 km region invisible.
 */
export function detailWeight(b: LatLngBounds, lat: number, lng: number, fadeDeg: number): number {
  const inset = Math.min(lat - b.south, b.north - lat, lng - b.west, b.east - lng)
  if (inset <= 0) return 0
  return smoothstep(Math.min(inset / fadeDeg, 1))
}

function blend(regionValue: number, detailValue: number, w: number): number {
  if (w === 0 || !Number.isFinite(detailValue)) return regionValue
  if (!Number.isFinite(regionValue)) return detailValue
  return regionValue + (detailValue - regionValue) * w
}

/**
 * One value field over the region's box at width × height pixels, with the
 * detail grid merged in where it exists. Merging values (not two stacked
 * transparent images) avoids the overlap rendering twice as opaque.
 */
export function composeField(
  region: Field,
  detail: Field | null,
  width: number,
  height: number,
  fadeDeg: number,
): number[] {
  const b = region.grid.bounds
  const latStep = (b.north - b.south) / height
  const lngStep = (b.east - b.west) / width
  const out = new Array<number>(width * height)
  for (let y = 0; y < height; y++) {
    const lat = b.north - (y + 0.5) * latStep
    for (let x = 0; x < width; x++) {
      const lng = b.west + (x + 0.5) * lngStep
      const regionValue = sampleField(region.grid, region.mm, lat, lng)
      const w = detail ? detailWeight(detail.grid.bounds, lat, lng, fadeDeg) : 0
      out[y * width + x] =
        detail && w > 0 ? blend(regionValue, sampleField(detail.grid, detail.mm, lat, lng), w) : regionValue
    }
  }
  return out
}

/**
 * Pair the two layers hour by hour. The region sets the timeline; detail
 * frames join by end time. If the region fetch failed, detail alone still
 * gives a timeline for the area around the gate.
 */
export function alignFrames(
  region: readonly RainFrame[] | null,
  detail: readonly RainFrame[] | null,
): CompositeFrame[] {
  const primary = region ?? detail ?? []
  const detailByEnd = new Map((detail ?? []).map((f) => [f.endsAt.getTime(), f.mm]))
  return primary.map((f) => ({
    startsAt: f.startsAt,
    endsAt: f.endsAt,
    region: region ? f.mm : null,
    detail: detailByEnd.get(f.endsAt.getTime()) ?? null,
  }))
}
