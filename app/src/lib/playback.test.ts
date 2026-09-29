import { describe, expect, it } from 'vitest'
import { advancePlayback, type PlaybackTiming } from './playback'

const TIMING: PlaybackTiming = { hourMs: 1000, endHoldMs: 500 }

describe('advancePlayback', () => {
  it('moves continuously through the hours', () => {
    const next = advancePlayback({ position: 0, heldMs: 0 }, 250, 12, TIMING)
    expect(next).toEqual({ position: 0.25, heldMs: 0 })
  })

  it('stops exactly on the last frame, then holds before looping', () => {
    const atEnd = advancePlayback({ position: 10.9, heldMs: 0 }, 500, 12, TIMING)
    expect(atEnd).toEqual({ position: 11, heldMs: 0 })
    const holding = advancePlayback(atEnd, 300, 12, TIMING)
    expect(holding).toEqual({ position: 11, heldMs: 300 })
    const looped = advancePlayback(holding, 300, 12, TIMING)
    expect(looped).toEqual({ position: 0, heldMs: 0 })
  })

  it('does nothing without at least two frames', () => {
    const state = { position: 0, heldMs: 0 }
    expect(advancePlayback(state, 1000, 1, TIMING)).toBe(state)
  })

  it('does not mutate the previous state', () => {
    const state = Object.freeze({ position: 1, heldMs: 0 })
    expect(() => advancePlayback(state, 100, 12, TIMING)).not.toThrow()
    expect(state.position).toBe(1)
  })
})
