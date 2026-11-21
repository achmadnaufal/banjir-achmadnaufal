import { useEffect, useRef, useState } from 'react'
import {
  DETAIL_BOUNDS,
  DETAIL_GRID_COLS,
  DETAIL_GRID_ROWS,
  FORECAST_CACHE_MAX_AGE_MS,
  FORECAST_HOURS,
  FORECAST_REFRESH_MS,
  FORECAST_STALE_MAX_AGE_MS,
  REGION_BOUNDS,
  REGION_GRID_COLS,
  REGION_GRID_ROWS,
} from '../config/forecast'
import { readCachedEntry, writeCachedBody, type CachedEntry, type KeyValueStore } from '../lib/forecastCache'
import { classifyForecastError, retryDelayMs, type ForecastProblem } from '../lib/forecastRetry'
import { fetchText } from '../lib/http'
import { buildForecastUrl, buildGrid, parseForecast, type RainFrame, type RainGrid } from '../lib/rainForecast'
import { UpstreamError } from '../types/upstream'

export const REGION_GRID = buildGrid(REGION_BOUNDS, REGION_GRID_ROWS, REGION_GRID_COLS)
export const DETAIL_GRID = buildGrid(DETAIL_BOUNDS, DETAIL_GRID_ROWS, DETAIL_GRID_COLS)

export type UseRainForecastState = {
  frames: RainFrame[] | null
  /** When the frames on screen were fetched; older than now if served stale. */
  fetchedAt: Date | null
  /** Why the latest refresh failed, if it did. Frames may still be showing. */
  problem: ForecastProblem | null
  isLoading: boolean
  refresh: () => void
}

function storage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

async function fetchEntry(cacheKey: string, url: string, signal: AbortSignal): Promise<CachedEntry> {
  const text = await fetchText(url, { signal })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new UpstreamError('parse', 'Rain forecast: response is not JSON')
  }
  const fetchedAt = Date.now()
  writeCachedBody(storage(), cacheKey, url, text, fetchedAt)
  return { body, fetchedAt }
}

type Loaded = { entry: CachedEntry; failure: unknown }

/**
 * Fresh cache → network → stale cache, in that order. A failed fetch with a
 * stale copy still resolves (with `failure` set) so the map keeps working
 * while a retry is pending; with no copy at all it rejects.
 */
async function loadEntry(cacheKey: string, url: string, signal: AbortSignal): Promise<Loaded> {
  const fresh = readCachedEntry(storage(), cacheKey, url, Date.now(), FORECAST_CACHE_MAX_AGE_MS)
  if (fresh) return { entry: fresh, failure: null }
  try {
    return { entry: await fetchEntry(cacheKey, url, signal), failure: null }
  } catch (err) {
    if (signal.aborted) throw err
    const stale = readCachedEntry(storage(), cacheKey, url, Date.now(), FORECAST_STALE_MAX_AGE_MS)
    if (stale) return { entry: stale, failure: err }
    throw err
  }
}

/** Hourly forecast frames for one grid; `cacheKey` names its localStorage slot. */
export function useRainForecast(cacheKey: string, grid: RainGrid): UseRainForecastState {
  const [frames, setFrames] = useState<RainFrame[] | null>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [problem, setProblem] = useState<ForecastProblem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    const url = buildForecastUrl(grid, FORECAST_HOURS)
    let cancelled = false
    let inflight: AbortController | null = null
    let intervalId: ReturnType<typeof setInterval> | null = null
    let retryId: ReturnType<typeof setTimeout> | null = null
    let attempt = 0

    const clearRetry = () => {
      if (retryId !== null) {
        clearTimeout(retryId)
        retryId = null
      }
    }

    const failed = (err: unknown) => {
      // The detailed error (with its 5 KB URL) goes to the console for
      // debugging; the reader gets a one-line reason.
      console.error(`[rain-forecast:${cacheKey}] load failed`, err)
      setProblem(classifyForecastError(err))
      clearRetry()
      retryId = setTimeout(() => {
        retryId = null
        void run()
      }, retryDelayMs(attempt))
      attempt += 1
    }

    const run = async () => {
      if (cancelled) return
      inflight?.abort()
      const ac = new AbortController()
      inflight = ac
      setIsLoading(true)
      try {
        const { entry, failure } = await loadEntry(cacheKey, url, ac.signal)
        if (cancelled) return
        setFrames(parseForecast(entry.body, grid, new Date(), FORECAST_HOURS))
        setFetchedAt(new Date(entry.fetchedAt))
        if (failure) {
          failed(failure)
        } else {
          attempt = 0
          clearRetry()
          setProblem(null)
        }
      } catch (err) {
        if (cancelled || ac.signal.aborted) return
        failed(err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    refreshRef.current = () => {
      void run()
    }

    const clearPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const startPolling = () => {
      clearPolling()
      intervalId = setInterval(() => {
        void run()
      }, FORECAST_REFRESH_MS)
    }

    // Same rule as history: a hidden tab stops polling, and catches up when
    // the reader comes back (from cache if it is still fresh).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void run()
        startPolling()
      } else {
        clearPolling()
      }
    }

    queueMicrotask(() => {
      if (!cancelled) void run()
    })
    startPolling()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      clearPolling()
      clearRetry()
      inflight?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [cacheKey, grid])

  return { frames, fetchedAt, problem, isLoading, refresh: () => refreshRef.current() }
}
