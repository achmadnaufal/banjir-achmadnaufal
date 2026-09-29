import { PESANGGRAHAN } from './station'

export type LatLngBounds = {
  south: number
  west: number
  north: number
  east: number
}

/**
 * The area the rain map samples. The gate sits near the northern edge on
 * purpose: the rain that lifts the gauge falls upstream, to the south toward
 * Bogor, a few hours before the water arrives.
 */
export const FORECAST_BOUNDS: LatLngBounds = {
  south: -6.62,
  west: 106.62,
  north: -6.3,
  east: 106.92,
}

/** 8 × 8 = 64 sample points, one Open-Meteo request — about 4 km per cell. */
export const FORECAST_GRID_ROWS = 8
export const FORECAST_GRID_COLS = 8

/** Hourly frames shown on the map, matching the iOS Weather 12-hour scrubber. */
export const FORECAST_HOURS = 12

/** Cells south of the gate count as upstream. */
export const UPSTREAM_OF_LAT = PESANGGRAHAN.lat

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

/** Model runs update hourly at best; polling faster only spends quota. */
export const FORECAST_REFRESH_MS = 30 * 60 * 1000

export const FRAME_INTERVAL_MS = 700
