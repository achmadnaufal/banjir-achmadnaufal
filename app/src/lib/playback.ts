export type PlaybackState = {
  /** Fractional frame index: 2.5 is halfway between hour 2 and hour 3. */
  position: number
  /** Time spent paused on the last frame before looping. */
  heldMs: number
}

export type PlaybackTiming = {
  /** Wall-clock time to play one forecast hour. */
  hourMs: number
  /** Pause on the last hour so the reader can see where the forecast ends. */
  endHoldMs: number
}

export function advancePlayback(
  state: PlaybackState,
  dtMs: number,
  frameCount: number,
  timing: PlaybackTiming,
): PlaybackState {
  const last = frameCount - 1
  if (last < 1) return state
  if (state.position >= last) {
    const heldMs = state.heldMs + dtMs
    return heldMs >= timing.endHoldMs ? { position: 0, heldMs: 0 } : { position: last, heldMs }
  }
  return { position: Math.min(state.position + dtMs / timing.hourMs, last), heldMs: 0 }
}
