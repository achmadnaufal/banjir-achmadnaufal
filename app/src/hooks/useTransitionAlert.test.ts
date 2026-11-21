import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTransitionAlert } from './useTransitionAlert'

const COPY = { title: (band: string, level: string) => `${band} ${level}`, body: 'b' }

afterEach(() => vi.unstubAllGlobals())

describe('useTransitionAlert', () => {
  it('unlocks audio from a user tap so the chime can play later', () => {
    // Browsers start an AudioContext suspended unless a tap created or resumed it.
    const resume = vi.fn(async () => undefined)
    const created = vi.fn()
    class FakeAudioContext {
      state = 'suspended'
      resume = resume
      constructor() {
        created()
      }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const { result } = renderHook(() => useTransitionAlert(null, null, COPY))
    act(() => result.current.unlockAudio())
    act(() => result.current.unlockAudio())
    expect(created).toHaveBeenCalledTimes(1)
    expect(resume).toHaveBeenCalled()
  })
})
