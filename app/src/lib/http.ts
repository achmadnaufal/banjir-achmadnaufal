import { FETCH_TIMEOUT_MS } from '../config/station'
import { UpstreamError } from '../types/upstream'

export type FetchOptions = {
  timeoutMs?: number
  signal?: AbortSignal
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-cache' })
    if (!res.ok) {
      throw new UpstreamError('http', `HTTP ${res.status} from ${url}`, res.status)
    }
    return await res.text()
  } catch (err) {
    if (err instanceof UpstreamError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UpstreamError('timeout', `Request timed out after ${timeoutMs}ms: ${url}`)
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new UpstreamError('network', `Network error fetching ${url}: ${message}`)
  } finally {
    clearTimeout(timer)
  }
}
