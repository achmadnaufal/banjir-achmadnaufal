import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PLAYBACK_END_HOLD_MS,
  PLAYBACK_HOUR_MS,
  PLAYBACK_MIN_FRAME_MS,
} from '../config/forecast'
import { advancePlayback, type PlaybackState } from '../lib/playback'

const TIMING = { hourMs: PLAYBACK_HOUR_MS, endHoldMs: PLAYBACK_END_HOLD_MS }

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

export type RainPlayback = {
  position: number
  playing: boolean
  setPlaying: (playing: boolean) => void
  /** Jump to a position; takes over from playback like dragging the iOS scrubber. */
  seek: (position: number) => void
}

/**
 * Continuous playback over the forecast hours. Starts by itself once frames
 * arrive (unless the reader asked the OS for reduced motion), and only runs
 * while `active` — the map scrolled out of view costs no battery.
 */
export function useRainPlayback(frameCount: number, active: boolean): RainPlayback {
  const [state, setState] = useState<PlaybackState>({ position: 0, heldMs: 0 })
  const [playing, setPlaying] = useState(false)
  const autoStarted = useRef(false)

  useEffect(() => {
    if (autoStarted.current || frameCount < 2) return
    autoStarted.current = true
    if (!prefersReducedMotion()) queueMicrotask(() => setPlaying(true))
  }, [frameCount])

  useEffect(() => {
    if (!playing || !active || frameCount < 2 || typeof requestAnimationFrame !== 'function') return
    let raf = 0
    let last: number | null = null
    const tick = (now: number) => {
      if (last === null) last = now
      const dt = now - last
      if (dt >= PLAYBACK_MIN_FRAME_MS) {
        last = now
        setState((prev) => advancePlayback(prev, dt, frameCount, TIMING))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, active, frameCount])

  const seek = useCallback((position: number) => {
    setPlaying(false)
    setState({ position, heldMs: 0 })
  }, [])

  // A refetch can return fewer frames than before; never point past the end.
  const position = frameCount === 0 ? 0 : Math.min(state.position, frameCount - 1)
  return { position, playing, setPlaying, seek }
}
