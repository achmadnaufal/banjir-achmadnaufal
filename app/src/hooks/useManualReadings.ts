import { useEffect, useState } from 'react'
import { MANUAL_REFRESH_MS } from '../config/station'
import { fetchBpbdReadings } from '../lib/bpbd'
import { readStoredManual, writeStoredManual } from '../lib/manualCache'
import { mergeManualTables } from '../lib/manualFallback'
import type { HistoryResponse } from '../types/upstream'

const BACKOFF_BASE_MS = 30_000

export type UseManualReadingsState = {
  data: HistoryResponse | null
  error: Error | null
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

/**
 * Polls BPBD's hourly manual readings — the fallback for when the DSDA sensor
 * feed goes quiet. The reply is well under 1 KB, so it is polled whether or
 * not the sensor is live; `pickReading` decides which one is shown.
 *
 * Starts from the table saved on the last visit, and folds every poll into
 * it rather than replacing it (BPBD resets to an empty table at midnight).
 * BPBD answers 503 now and then, so a failed poll is retried after 30 s,
 * doubling up to the normal interval.
 */
export function useManualReadings(): UseManualReadingsState {
  const [state, setState] = useState<UseManualReadingsState>(() => ({
    data: readStoredManual(),
    error: null,
  }))

  useEffect(() => {
    let cancelled = false
    let failures = 0
    // The same table the initial state came from; folded into on each poll.
    let known = readStoredManual()
    let inflight: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    // A hidden tab waits for visibilitychange instead of polling.
    const schedule = (ms: number) => {
      clearTimer()
      if (isHidden()) return
      timer = setTimeout(() => {
        void run()
      }, ms)
    }

    const run = async () => {
      if (cancelled) return
      inflight?.abort()
      const ac = new AbortController()
      inflight = ac
      try {
        const now = new Date()
        const fresh = await fetchBpbdReadings(now, { signal: ac.signal })
        if (cancelled) return
        failures = 0
        known = mergeManualTables(known, fresh, now)
        writeStoredManual(known)
        setState({ data: known, error: null })
        schedule(MANUAL_REFRESH_MS)
      } catch (err) {
        if (cancelled || ac.signal.aborted) return
        failures += 1
        const error = err instanceof Error ? err : new Error(String(err))
        setState((prev) => ({ ...prev, error }))
        schedule(Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), MANUAL_REFRESH_MS))
      }
    }

    const onVisibility = () => {
      if (isHidden()) clearTimer()
      else void run()
    }

    void run()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      cancelled = true
      clearTimer()
      inflight?.abort()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [])

  return state
}
