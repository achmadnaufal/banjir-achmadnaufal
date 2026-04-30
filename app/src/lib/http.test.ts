import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchText } from './http'
import { UpstreamError } from '../types/upstream'

const URL = 'https://example.test/data'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchText', () => {
  it('returns body on 200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('hello', { status: 200 }))
    await expect(fetchText(URL)).resolves.toBe('hello')
  })

  it('throws UpstreamError(http) on non-2xx with status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }))
    await expect(fetchText(URL)).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    })
  })

  it('throws UpstreamError(network) on raw fetch rejection', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(fetchText(URL)).rejects.toBeInstanceOf(UpstreamError)
    await expect(fetchText(URL)).rejects.toMatchObject({ kind: 'network' })
  })

  it('throws UpstreamError(timeout) when request aborts due to timeout', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((_input, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined
        signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })
    await expect(fetchText(URL, { timeoutMs: 5 })).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('respects an externally provided abort signal', async () => {
    const ac = new AbortController()
    ac.abort()
    vi.spyOn(global, 'fetch').mockImplementation((_input, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined
      if (signal?.aborted) {
        const err = new Error('aborted')
        err.name = 'AbortError'
        return Promise.reject(err)
      }
      return Promise.resolve(new Response('ok'))
    })
    await expect(fetchText(URL, { signal: ac.signal })).rejects.toMatchObject({ kind: 'timeout' })
  })
})
