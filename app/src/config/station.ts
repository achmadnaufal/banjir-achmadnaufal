export const PESANGGRAHAN = {
  id: 160,
  name: 'P.S. Pesanggrahan 1',
  river: 'Pesanggrahan',
  lat: -6.397147,
  lng: 106.771833,
  fallbackThresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 },
} as const

export const SNAPSHOT_URL = 'https://poskobanjir.dsdadki.web.id/xmldata.xml'
export const HISTORY_BASE = 'https://poskobanjir.dsdadki.web.id/Pages/GenerateDataTinggiAir.aspx'

export const FETCH_TIMEOUT_MS = 8_000
export const POLL_INTERVAL_MS = 5 * 60 * 1000
export const STALE_AFTER_MS = 20 * 60 * 1000
export const HISTORY_REFRESH_MS = 15 * 60 * 1000
