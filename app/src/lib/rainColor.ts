export type Rgba = readonly [number, number, number, number]

export type RainBand = {
  /** Lower bound of the band, in mm of rain over the hour. */
  minMm: number
  rgba: Rgba
}

/**
 * The familiar weather-radar ramp (green → yellow → red → magenta) so a reader
 * who knows the iOS map reads this one without a legend. Alpha rises with
 * intensity: drizzle should tint the map, not hide the streets under it.
 */
export const RAIN_SCALE: readonly RainBand[] = Object.freeze([
  { minMm: 0.1, rgba: [120, 200, 120, 110] },
  { minMm: 1, rgba: [40, 170, 60, 150] },
  { minMm: 2.5, rgba: [245, 205, 40, 170] },
  { minMm: 5, rgba: [245, 140, 40, 185] },
  { minMm: 10, rgba: [215, 50, 50, 200] },
  { minMm: 20, rgba: [190, 40, 170, 210] },
] as const satisfies readonly RainBand[])

/** Returns null for cells that should stay transparent (dry or missing). */
export function rainColor(mm: number): Rgba | null {
  if (!Number.isFinite(mm)) return null
  let match: Rgba | null = null
  for (const band of RAIN_SCALE) {
    if (mm >= band.minMm) match = band.rgba
  }
  return match
}
