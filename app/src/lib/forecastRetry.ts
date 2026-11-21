import { UpstreamError } from '../types/upstream'

/** What the reader is told, without exposing a 5 KB request URL. */
export type ForecastProblem = 'busy' | 'offline' | 'unavailable'

export function classifyForecastError(err: unknown): ForecastProblem {
  if (!(err instanceof UpstreamError)) return 'unavailable'
  if (err.kind === 'http' && err.status === 429) return 'busy'
  if (err.kind === 'timeout' || err.kind === 'network') return 'offline'
  return 'unavailable'
}

/**
 * Open-Meteo's tightest limit is per minute (600 locations), and one cold page
 * load asks for ~500. The first retry therefore waits just past a minute so it
 * lands in a fresh window; later ones back off for the hourly limit.
 */
const RETRY_DELAYS_MS = [65_000, 2 * 60_000, 5 * 60_000, 10 * 60_000] as const

export function retryDelayMs(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempt, 0), RETRY_DELAYS_MS.length - 1)]
}
