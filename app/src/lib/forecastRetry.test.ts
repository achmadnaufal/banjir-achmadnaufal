import { describe, expect, it } from 'vitest'
import { classifyForecastError, retryDelayMs } from './forecastRetry'
import { UpstreamError } from '../types/upstream'

describe('classifyForecastError', () => {
  it('calls an HTTP 429 "busy" — a rate limit, not an outage', () => {
    expect(classifyForecastError(new UpstreamError('http', 'HTTP 429 from …', 429))).toBe('busy')
  })

  it('calls timeouts and network failures "offline"', () => {
    expect(classifyForecastError(new UpstreamError('timeout', 'slow'))).toBe('offline')
    expect(classifyForecastError(new UpstreamError('network', 'down'))).toBe('offline')
  })

  it('calls everything else "unavailable"', () => {
    expect(classifyForecastError(new UpstreamError('http', 'HTTP 500', 500))).toBe('unavailable')
    expect(classifyForecastError(new UpstreamError('parse', 'bad json'))).toBe('unavailable')
    expect(classifyForecastError(new Error('boom'))).toBe('unavailable')
  })
})

describe('retryDelayMs', () => {
  it('waits past the per-minute window first, then backs off', () => {
    expect(retryDelayMs(0)).toBe(65_000)
    expect(retryDelayMs(1)).toBe(2 * 60_000)
    expect(retryDelayMs(2)).toBe(5 * 60_000)
    expect(retryDelayMs(3)).toBe(10 * 60_000)
  })

  it('caps the delay instead of growing forever', () => {
    expect(retryDelayMs(50)).toBe(10 * 60_000)
  })
})
