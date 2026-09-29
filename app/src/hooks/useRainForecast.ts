import { useEffect, useRef, useState } from 'react'
import {
  FORECAST_BOUNDS,
  FORECAST_GRID_COLS,
  FORECAST_GRID_ROWS,
  FORECAST_HOURS,
  FORECAST_REFRESH_MS,
} from '../config/forecast'
import { fetchText } from '../lib/http'
import { buildForecastUrl, buildGrid, parseForecast, type RainFrame } from '../lib/rainForecast'
import { UpstreamError } from '../types/upstream'

export const RAIN_GRID = buildGrid(FORECAST_BOUNDS, FORECAST_GRID_ROWS, FORECAST_GRID_COLS)
const URL = buildForecastUrl(RAIN_GRID, FORECAST_HOURS)

export type UseRainForecastState = {
  frames: RainFrame[] | null
  error: Error | null
  isLoading: boolean
  refresh: () => void
}

async function fetchFrames(signal: AbortSignal): Promise<RainFrame[]> {
  const text = await fetchText(URL, { signal })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new UpstreamError('parse', 'Rain forecast: response is not JSON')
  }
  return parseForecast(body, RAIN_GRID, new Date(), FORECAST_HOURS)
}

export function useRainForecast(): UseRainForecastState {
  const [frames, setFrames] = useState<RainFrame[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshRef = useRef<() => void>(() => undefined)

  useEffect(() => {
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
        const next = await fetchFrames(ac.signal)
        if (cancelled) return
        setFrames(next)
        setError(null)
      } catch (err) {
        if (cancelled || ac.signal.aborted) return
        console.error('[rain-forecast] fetch failed', err)
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
    // the reader comes back so the frames are not hours old.
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
  }, [])

  return { frames, error, isLoading, refresh: () => refreshRef.current() }
}
