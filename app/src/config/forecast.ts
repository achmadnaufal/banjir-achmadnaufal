import { PESANGGRAHAN } from './station'

export type LatLngBounds = {
  south: number
  west: number
  north: number
  east: number
}

/**
 * Where the map opens: the gate and its catchment. Everything the page is
 * about happens here, so this stays the default view.
 */
export const FOCUS_BOUNDS: LatLngBounds = {
  south: -6.62,
  west: 106.62,
  north: -6.3,
  east: 106.92,
}

/**
 * Where rain is drawn: Banten, DKI Jakarta and Jawa Barat. Panning away from
 * the focus still shows the forecast, so a storm can be watched as it builds
 * and drifts in, the way the iOS map lets you look around the region.
 */
export const REGION_BOUNDS: LatLngBounds = {
  south: -7.85,
  west: 105.1,
  north: -5.75,
  east: 108.85,
}

/**
 * 14 × 25 = 350 points, 0.15° (~16 km) apart. 0.1° (798 points) overflows
 * the request URL (HTTP 414), so the region stays coarse and the area around
 * the gate gets its own detail grid below.
 */
export const REGION_GRID_ROWS = 14
export const REGION_GRID_COLS = 25

/**
 * Greater Jakarta (Jabodetabek) at the forecast model's own resolution.
 * Open-Meteo's default model here is ECMWF IFS, whose grid points sit ~0.07°
 * (~8 km) apart over the catchment — measured, not assumed. Open-Meteo
 * returns the nearest model point, so sampling any finer only repeats values.
 * 13 × 12 = 156 points at ~0.07°.
 */
export const DETAIL_BOUNDS: LatLngBounds = {
  south: -6.85,
  west: 106.35,
  north: -5.95,
  east: 107.25,
}
export const DETAIL_GRID_ROWS = 13
export const DETAIL_GRID_COLS = 12

/** Width of the band where detail eases into the region, in degrees. */
export const DETAIL_FADE_DEG = 0.1

/**
 * The catchment that actually lifts the gauge: the Pesanggrahan upstream of
 * the gate, south toward Bogor. The "expected upstream" number averages the
 * forecast over this box only, however large the map is.
 */
export const UPSTREAM_BOUNDS: LatLngBounds = {
  south: -6.62,
  west: 106.62,
  north: PESANGGRAHAN.lat,
  east: 106.92,
}
export const UPSTREAM_SAMPLE_ROWS = 6
export const UPSTREAM_SAMPLE_COLS = 6

/** Hourly frames shown on the map, matching the iOS Weather 12-hour scrubber. */
export const FORECAST_HOURS = 12

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

/**
 * Open-Meteo counts every location in a request against its free limits
 * (600/min, 10k/day, per viewer). 506 points hourly stays under the daily cap
 * unless a tab is left visible ~20 h; hidden tabs don't poll, and model runs
 * don't update faster than hourly anyway.
 */
export const FORECAST_REFRESH_MS = 60 * 60 * 1000

/**
 * Reuse the last response on reload for this long. Kept under the refresh
 * interval so the hourly poll always fetches fresh numbers.
 */
export const FORECAST_CACHE_MAX_AGE_MS = 50 * 60 * 1000

/** Playback: one forecast hour per 650 ms → the 12 h loop runs in ~8 s. */
export const PLAYBACK_HOUR_MS = 650
export const PLAYBACK_END_HOLD_MS = 1200

/** ~30 fps is smooth for slow-moving rain and half the battery of 60. */
export const PLAYBACK_MIN_FRAME_MS = 33

/**
 * Canvas pixels per degree for the merged field: 3.75° × 2.1° → 300 × 168 px,
 * ~3 px per detail cell before the browser's own smoothing.
 */
export const RAIN_RENDER_PX_PER_DEG = 80

/**
 * Display smoothing, as a Gaussian sigma in degrees: about half a model cell
 * (~0.07°), enough to melt the snapping blocks without inventing structure.
 */
export const RAIN_BLUR_DEG = 0.035
