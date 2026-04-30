import { useEffect, useRef, useState } from 'react'
import { HISTORY_REFRESH_MS, PESANGGRAHAN } from '../config/station'
import { fetchHistory } from '../lib/upstream'
import type { HistoryResponse } from '../types/upstream'

export type Range = '6h' | '12h' | '24h' | '7d'

const RANGE_HOURS: Record<Range, number> = {
  '6h': 6,
  '12h': 12,
  '24h': 24,
  '7d': 24 * 7,
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

export function useHistory(range: Range): UseHistoryState {
  const [data, setData] = useState<HistoryResponse | null>(null)
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

    queueMicrotask(() => {
      if (!cancelled) void run()
    })
    intervalId = setInterval(() => {
      void run()
    }, HISTORY_REFRESH_MS)

    return () => {
      cancelled = true
      if (intervalId !== null) clearInterval(intervalId)
      inflight?.abort()
    }
  }, [range])

  return {
    data,
    error,
    isLoading,
    refresh: () => refreshRef.current(),
  }
}
