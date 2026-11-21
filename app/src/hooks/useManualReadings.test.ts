import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANUAL_REFRESH_MS } from '../config/station'
import { MANUAL_STORAGE_KEY, serializeManual } from '../lib/manualCache'
import { useManualReadings } from './useManualReadings'

const fixture = readFileSync(resolve(__dirname, '../test/fixtures/bpbd-charttma.json'), 'utf8')
const EMPTY_TABLE = JSON.stringify({ time: '', ketinggian: '', siaga1: '', siaga2: '', siaga3: '' })

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

describe('useManualReadings', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-21T19:55:00+07:00'))
    setVisibility('visible')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
    setVisibility('visible')
  })

  it('loads the hourly table on mount and saves it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(fixture, { status: 200 })))
    const { result } = renderHook(() => useManualReadings())
    await flush()
    expect(result.current.data?.points.at(-1)?.cm).toBe(200)
    expect(result.current.error).toBeNull()
    expect(localStorage.getItem(MANUAL_STORAGE_KEY)).toContain('2026-11-21T12:00:00.000Z')
  })

  it('shows the saved table on the first render, before any fetch returns', () => {
    localStorage.setItem(
      MANUAL_STORAGE_KEY,
      serializeManual({
        points: [{ at: new Date('2026-11-21T19:00:00+07:00'), cm: 200 }],
        thresholdsCm: null,
      }),
    )
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    const { result } = renderHook(() => useManualReadings())
    expect(result.current.data?.points.at(-1)?.cm).toBe(200)
  })

  it("keeps yesterday's readings when today's table comes back empty after midnight", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(fixture, { status: 200 }))
      .mockResolvedValue(new Response(EMPTY_TABLE, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useManualReadings())
    await flush()
    vi.setSystemTime(new Date('2026-11-22T00:05:00+07:00'))
    await flush(MANUAL_REFRESH_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.data?.points).toHaveLength(20)
    expect(result.current.data?.points.at(-1)?.at).toEqual(new Date('2026-11-21T19:00:00+07:00'))
  })

  it('retries a failed poll after 30 s instead of waiting the full interval', async () => {
    // BPBD answered 503 to one of the first requests during the live check.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValue(new Response(fixture, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useManualReadings())
    await flush()
    expect(result.current.data).toBeNull()
    expect(result.current.error).not.toBeNull()

    await flush(30_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.data?.points.at(-1)?.cm).toBe(200)
    expect(result.current.error).toBeNull()
  })

  it('keeps the last good table when a later poll fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(fixture, { status: 200 }))
      .mockResolvedValue(new Response('busy', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useManualReadings())
    await flush()
    await flush(MANUAL_REFRESH_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.error).not.toBeNull()
    expect(result.current.data?.points.at(-1)?.cm).toBe(200)
  })

  it('stops polling when the tab is hidden while a request is in flight', async () => {
    let release: (r: Response) => void = () => undefined
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((res) => (release = res)))
      .mockResolvedValue(new Response(fixture, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useManualReadings())
    await flush()
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    release(new Response(fixture, { status: 200 }))
    await flush()
    await flush(MANUAL_REFRESH_MS * 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
