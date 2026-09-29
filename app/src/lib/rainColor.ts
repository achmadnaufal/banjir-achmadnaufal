export type Rgba = readonly [number, number, number, number]

export type RainStop = {
  /** Rain over the hour, in mm. */
  mm: number
  rgba: Rgba
}

/**
 * The iOS Weather precipitation ramp: dark blue for light rain, purple for
 * moderate, yellow for heavy, pale yellow for extreme. Colours blend
 * continuously between stops. The breakpoints follow BMKG's hourly rain
 * classes — ringan < 5, sedang 5–10, lebat 10–20, sangat lebat > 20 mm/h —
 * so the map agrees with the warnings residents already hear.
 *
 * The first stop is fully transparent so drizzle fades in rather than
 * starting at a hard edge.
 */
export const RAIN_STOPS: readonly RainStop[] = Object.freeze([
  { mm: 0.1, rgba: [20, 45, 150, 0] },
  { mm: 0.5, rgba: [25, 50, 165, 130] },
  { mm: 2, rgba: [45, 85, 215, 165] },
  { mm: 5, rgba: [150, 70, 210, 190] },
  { mm: 10, rgba: [245, 200, 45, 205] },
  { mm: 20, rgba: [255, 240, 160, 215] },
  { mm: 40, rgba: [255, 252, 220, 225] },
] as const satisfies readonly RainStop[])

const MIN_MM = RAIN_STOPS[0].mm

function mix(a: Rgba, b: Rgba, t: number): Rgba {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ]
}

/** Returns null for cells that should stay transparent (dry or missing). */
export function rainColor(mm: number): Rgba | null {
  if (!Number.isFinite(mm) || mm < MIN_MM) return null
  const upper = RAIN_STOPS.findIndex((s) => s.mm >= mm)
  if (upper === -1) return RAIN_STOPS[RAIN_STOPS.length - 1].rgba
  if (upper === 0) return RAIN_STOPS[0].rgba
  const lo = RAIN_STOPS[upper - 1]
  const hi = RAIN_STOPS[upper]
  return mix(lo.rgba, hi.rgba, (mm - lo.mm) / (hi.mm - lo.mm))
}
