/** The slice of Storage the cache needs, so tests can pass a plain object. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>

type Entry = { url: string; fetchedAt: number; body: string }

function isEntry(v: unknown): v is Entry {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return typeof e.url === 'string' && typeof e.body === 'string' && Number.isFinite(e.fetchedAt)
}

/**
 * Last forecast response, reused on reload. Open-Meteo counts every location
 * in a request against a per-minute and per-day limit, and a page load asks
 * for ~500 locations — two quick reloads would otherwise trip HTTP 429.
 *
 * The request URL is stored with the body, so a grid change in config never
 * serves an old grid's numbers. Anything unreadable is a miss, never a crash.
 */
export function readCachedBody(
  store: KeyValueStore | null,
  key: string,
  url: string,
  nowMs: number,
  maxAgeMs: number,
): unknown | null {
  if (!store) return null
  try {
    const raw = store.getItem(key)
    if (raw === null) return null
    const entry: unknown = JSON.parse(raw)
    if (!isEntry(entry) || entry.url !== url) return null
    const age = nowMs - entry.fetchedAt
    if (age < 0 || age > maxAgeMs) return null
    return JSON.parse(entry.body)
  } catch {
    return null
  }
}

export function writeCachedBody(
  store: KeyValueStore | null,
  key: string,
  url: string,
  body: string,
  nowMs: number,
): void {
  if (!store) return
  try {
    store.setItem(key, JSON.stringify({ url, fetchedAt: nowMs, body } satisfies Entry))
  } catch {
    // Quota or private mode: the next load just fetches again.
  }
}
