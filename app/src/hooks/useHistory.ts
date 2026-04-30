import { useEffect, useRef, useState } from 'react'
import { HISTORY_REFRESH_MS, PESANGGRAHAN } from '../config/station'
import { fetchHistory } from '../lib/upstream'
import type { HistoryResponse } from '../types/upstream'

export type Range = '24h' | '7d'

function rangeBounds(range: Range, now: Date): { start: Date; end: Date } {
  const end = now
  const days = range === '24h' ? 1 : 7
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return { start, end }
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
        const { start, end } = rangeBounds(range, new Date())
        const result = await fetchHistory(PESANGGRAHAN.id, start, end, { signal: ac.signal })
        if (cancelled) return
        setData(result)
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
