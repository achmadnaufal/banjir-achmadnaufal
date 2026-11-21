import { PESANGGRAHAN } from '../config/station'
import type { StationDefaults } from './manualFallback'

/**
 * What is known about the gate before any fetch succeeds. Shared by the page
 * and the alerts server, so both build a reading for the same station.
 */
export const STATION_DEFAULTS: StationDefaults = {
  id: PESANGGRAHAN.id,
  name: PESANGGRAHAN.name,
  location: PESANGGRAHAN.river,
  lat: PESANGGRAHAN.lat,
  lng: PESANGGRAHAN.lng,
  thresholdsCm: PESANGGRAHAN.fallbackThresholdsCm,
}
