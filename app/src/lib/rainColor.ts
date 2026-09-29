export type Rgba = readonly [number, number, number, number]

export type RainStop = {
  /** Rain over the hour, in mm. */
  mm: number
  rgba: Rgba
}

/**
 * The iOS Weather precipitation ramp — dark blue for light rain, purple for
 * moderate, yellow for heavy, pale yellow for extreme — blending continuously
 * between stops. Class boundaries follow the WMO rain-rate categories:
 * light < 2.5, moderate 2.5–10, heavy 10–50, extreme (violent) ≥ 50 mm/h.
 *
 * The first stop is fully transparent so drizzle fades in rather than
 * starting at a hard edge.
 */
export const RAIN_STOPS: readonly RainStop[] = Object.freeze([
  { mm: 0.1, rgba: [20, 45, 150, 0] },
  { mm: 0.5, rgba: [25, 50, 165, 130] },
  { mm: 2.5, rgba: [45, 85, 215, 165] },
  { mm: 6, rgba: [150, 70, 210, 185] },
  { mm: 10, rgba: [175, 75, 190, 195] },
  { mm: 20, rgba: [245, 200, 45, 205] },
  { mm: 50, rgba: [255, 240, 160, 215] },
  { mm: 100, rgba: [255, 252, 220, 225] },
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
