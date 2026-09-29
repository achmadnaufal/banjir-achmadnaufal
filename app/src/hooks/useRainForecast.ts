import { useEffect, useRef, useState } from 'react'
import {
  DETAIL_BOUNDS,
  DETAIL_GRID_COLS,
  DETAIL_GRID_ROWS,
  FORECAST_CACHE_MAX_AGE_MS,
  FORECAST_HOURS,
  FORECAST_REFRESH_MS,
  REGION_BOUNDS,
  REGION_GRID_COLS,
  REGION_GRID_ROWS,
} from '../config/forecast'
import { readCachedBody, writeCachedBody, type KeyValueStore } from '../lib/forecastCache'
import { fetchText } from '../lib/http'
import { buildForecastUrl, buildGrid, parseForecast, type RainFrame, type RainGrid } from '../lib/rainForecast'
import { UpstreamError } from '../types/upstream'

export const REGION_GRID = buildGrid(REGION_BOUNDS, REGION_GRID_ROWS, REGION_GRID_COLS)
export const DETAIL_GRID = buildGrid(DETAIL_BOUNDS, DETAIL_GRID_ROWS, DETAIL_GRID_COLS)

export type UseRainForecastState = {
  frames: RainFrame[] | null
  error: Error | null
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

async function loadBody(cacheKey: string, url: string, signal: AbortSignal): Promise<unknown> {
  const cached = readCachedBody(storage(), cacheKey, url, Date.now(), FORECAST_CACHE_MAX_AGE_MS)
  if (cached !== null) return cached
  const text = await fetchText(url, { signal })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new UpstreamError('parse', 'Rain forecast: response is not JSON')
  }
  writeCachedBody(storage(), cacheKey, url, text, Date.now())
  return body
}

/** Hourly forecast frames for one grid; `cacheKey` names its localStorage slot. */
export function useRainForecast(cacheKey: string, grid: RainGrid): UseRainForecastState {
  const [frames, setFrames] = useState<RainFrame[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    const url = buildForecastUrl(grid, FORECAST_HOURS)
    let cancelled = false
    let inflight: AbortController | null = null
    let intervalId: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      if (cancelled) return
      inflight?.abort()
      const ac = new AbortController()
      inflight = ac
      setIsLoading(true)
      try {
        const body = await loadBody(cacheKey, url, ac.signal)
        if (cancelled) return
        setFrames(parseForecast(body, grid, new Date(), FORECAST_HOURS))
        setError(null)
      } catch (err) {
        if (cancelled || ac.signal.aborted) return
        console.error(`[rain-forecast:${cacheKey}] load failed`, err)
        setError(err instanceof Error ? err : new Error(String(err)))
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
      inflight?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [cacheKey, grid])

  return { frames, error, isLoading, refresh: () => refreshRef.current() }
}
