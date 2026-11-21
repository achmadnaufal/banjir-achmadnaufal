export const PESANGGRAHAN = {
  id: 160,
  name: 'P.S. Pesanggrahan 1',
  river: 'Pesanggrahan',
  lat: -6.397147,
  lng: 106.771833,
  fallbackThresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 },
} as const

/** The residential complex this page serves. A proper noun — never translated, never abbreviated. */
export const COMMUNITY = 'Cinangka Paradisa Residence'

export const SNAPSHOT_URL = 'https://poskobanjir.dsdadki.web.id/xmldata.xml'
export const HISTORY_BASE = 'https://poskobanjir.dsdadki.web.id/Pages/GenerateDataTinggiAir.aspx'

/**
 * BPBD DKI republishes DSDA's hourly manual gauge readings — the numbers the
 * JAKI app shows. It is the fallback when the 10-minute sensor feed above goes
 * quiet (gate 160 vanished from xmldata.xml on 2026-11-18). The id is BPBD's
 * own, from the gate picker on bpbd.jakarta.go.id/waterlevel, not DSDA's 160.
 */
export const BPBD_READINGS_URL = 'https://bpbd.jakarta.go.id/api/charttma'
export const BPBD_POST = { id: 2, name: 'Pos Pesanggrahan' } as const
export const MANUAL_REFRESH_MS = 10 * 60 * 1000

export const FETCH_TIMEOUT_MS = 8_000
export const POLL_INTERVAL_MS = 5 * 60 * 1000
export const STALE_AFTER_MS = 20 * 60 * 1000
export const HISTORY_REFRESH_MS = 15 * 60 * 1000
