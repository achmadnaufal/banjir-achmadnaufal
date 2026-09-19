import { useEffect, useRef, useState } from 'react'
import { HISTORY_REFRESH_MS, PESANGGRAHAN } from '../config/station'
import { fetchHistory } from '../lib/upstream'
import type { HistoryResponse } from '../types/upstream'

export type Range = '6h' | '12h' | '24h' | '7d' | '30d' | '60d'

const RANGE_HOURS: Record<Range, number> = {
  '6h': 6,
  '12h': 12,
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  '60d': 24 * 60,
}

const HOUR_MS = 60 * 60 * 1000

type Bounds = {
  fetchStart: Date
  fetchEnd: Date
  windowStart: Date
}

function rangeBounds(range: Range, now: Date): Bounds {
  const hours = RANGE_HOURS[range]
  const fetchEnd = now
  // Upstream only accepts whole-day boundaries; fetch the smallest whole-day
  // span that covers the window, then trim client-side.
  const fetchHours = hours <= 24 ? 24 : hours
  const fetchStart = new Date(fetchEnd.getTime() - fetchHours * HOUR_MS)
  const windowStart = new Date(fetchEnd.getTime() - hours * HOUR_MS)
  return { fetchStart, fetchEnd, windowStart }
}

export type UseHistoryState = {
  data: HistoryResponse | null
  error: Error | null
  isLoading: boolean
  refresh: () => void
}

/**
 * Passing `null` keeps the hook inert (no fetch, no interval). App uses that
 * to avoid issuing the 24h stats request twice when 24h is also the range
 * being charted — hooks can't be called conditionally, so the condition
 * moves into the argument.
 */
export function useHistory(range: Range | null): UseHistoryState {
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    if (range === null) return

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
        const { fetchStart, fetchEnd, windowStart } = rangeBounds(range, new Date())
        const result = await fetchHistory(PESANGGRAHAN.id, fetchStart, fetchEnd, { signal: ac.signal })
        if (cancelled) return
        const minMs = windowStart.getTime()
        const trimmed =
          result.points.length === 0
            ? result
            : { ...result, points: result.points.filter((p) => p.at.getTime() >= minMs) }
        setData(trimmed)
        setError(null)
      } catch (err) {
        if (cancelled || ac.signal.aborted) return
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
      }, HISTORY_REFRESH_MS)
    }

    // A hidden tab shouldn't keep pulling history in the background — the
    // 60d range is a ~640 KB response, which is a lot of a phone's data plan
    // to spend on a chart nobody is looking at.
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

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      cancelled = true
      clearPolling()
      inflight?.abort()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [range])

  return {
    data,
    error,
    // An inert hook is not "loading"; it was never asked to fetch.
    isLoading: range !== null && isLoading,
    refresh: () => refreshRef.current(),
  }
}
