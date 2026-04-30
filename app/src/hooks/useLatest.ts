import { useEffect, useRef, useState } from 'react'
import { PESANGGRAHAN, POLL_INTERVAL_MS } from '../config/station'
import { fetchSnapshot, findStation } from '../lib/upstream'
import type { SnapshotRow } from '../types/upstream'

const STORAGE_KEY = `banjir:lastSnapshot:${PESANGGRAHAN.id}`
const REVISIBLE_REFRESH_THRESHOLD_MS = 60_000
const BACKOFF_BASE_MS = 30_000
const BACKOFF_MAX_MS = 5 * 60_000

type StoredSnapshot = {
  observedAtIso: string
  levelCm: number
  prevLevelCm: number | null
  thresholdsCm: SnapshotRow['thresholdsCm']
  statusText: string
}

function readCachedSnapshot(): SnapshotRow | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredSnapshot
    return {
      id: PESANGGRAHAN.id,
      name: PESANGGRAHAN.name,
      location: PESANGGRAHAN.river,
      lat: PESANGGRAHAN.lat,
      lng: PESANGGRAHAN.lng,
      thresholdsCm: stored.thresholdsCm,
      observedAt: new Date(stored.observedAtIso),
      levelCm: stored.levelCm,
      prevLevelCm: stored.prevLevelCm,
      statusText: stored.statusText,
    }
  } catch {
    return null
  }
}

function writeCachedSnapshot(row: SnapshotRow) {
  if (typeof localStorage === 'undefined') return
  const stored: StoredSnapshot = {
    observedAtIso: row.observedAt.toISOString(),
    levelCm: row.levelCm,
    prevLevelCm: row.prevLevelCm,
    thresholdsCm: row.thresholdsCm,
    statusText: row.statusText,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // quota or privacy mode — ignore
  }
}

export type UseLatestState = {
  data: SnapshotRow | null
  error: Error | null
  isLoading: boolean
  lastFetchedAt: Date | null
  refresh: () => void
}

export function useLatest(): UseLatestState {
  const [data, setData] = useState<SnapshotRow | null>(() => readCachedSnapshot())
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)

  const refreshRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    let cancelled = false
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let inflight: AbortController | null = null
    let lastFetchedLocal: number | null = null

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const schedule = (ms: number) => {
      clearTimer()
      timer = setTimeout(() => {
        void run()
      }, ms)
    }

    const run = async () => {
      if (cancelled) return
      inflight?.abort()
      const ac = new AbortController()
      inflight = ac
      setIsLoading(true)
      try {
        const rows = await fetchSnapshot({ signal: ac.signal })
        const station = findStation(rows, PESANGGRAHAN.id)
        if (cancelled) return
        if (!station) throw new Error(`Station ${PESANGGRAHAN.id} not in snapshot`)
        failures = 0
        setData(station)
        setError(null)
        const now = new Date()
        lastFetchedLocal = now.getTime()
        setLastFetchedAt(now)
        writeCachedSnapshot(station)
        schedule(POLL_INTERVAL_MS)
      } catch (err) {
        if (cancelled || ac.signal.aborted) return
        failures += 1
        setError(err instanceof Error ? err : new Error(String(err)))
        const delay = Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS)
        schedule(delay)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    refreshRef.current = () => {
      void run()
    }

    const onVisibility = () => {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'visible') {
        const since = lastFetchedLocal === null ? Infinity : Date.now() - lastFetchedLocal
        if (since > REVISIBLE_REFRESH_THRESHOLD_MS) void run()
        else schedule(POLL_INTERVAL_MS)
      } else {
        clearTimer()
      }
    }

    const onOnline = () => {
      void run()
    }

    void run()

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline)
    }

    return () => {
      cancelled = true
      clearTimer()
      inflight?.abort()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline)
      }
    }
  }, [])

  return {
    data,
    error,
    isLoading,
    lastFetchedAt,
    refresh: () => refreshRef.current(),
  }
}
