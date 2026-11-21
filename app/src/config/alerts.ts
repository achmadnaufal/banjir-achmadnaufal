/** The closed-page alerts service on the VPS (alerts/ in this repo). */
export const ALERTS_API_BASE: string =
  import.meta.env.VITE_ALERTS_API_BASE ?? 'https://banjir-api.achmadnaufal.com'

/** Where the owner's secret token is kept after opening the page with ?owner=. */
export const OWNER_TOKEN_KEY = 'banjir:ownerToken'

export const SERVICE_STATUS_POLL_MS = 5 * 60 * 1000
/** "Alert service checked N min ago" turns into a warning past this. */
export const SERVICE_STALE_AFTER_MS = 20 * 60 * 1000
