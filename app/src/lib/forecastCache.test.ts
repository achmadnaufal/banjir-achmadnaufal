import { describe, expect, it } from 'vitest'
import { readCachedBody, writeCachedBody, type KeyValueStore } from './forecastCache'

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  }
}

const URL_A = 'https://api.open-meteo.com/v1/forecast?a'
const MAX_AGE = 1000

describe('forecast cache', () => {
  it('returns a fresh body for the same URL', () => {
    const store = memoryStore()
    writeCachedBody(store, 'k', URL_A, '[1,2]', 5000)
    expect(readCachedBody(store, 'k', URL_A, 5500, MAX_AGE)).toEqual([1, 2])
  })

  it('ignores stale entries', () => {
    const store = memoryStore()
    writeCachedBody(store, 'k', URL_A, '[1]', 5000)
    expect(readCachedBody(store, 'k', URL_A, 6001, MAX_AGE)).toBeNull()
  })

  it('ignores entries written for a different request (config changed)', () => {
    const store = memoryStore()
    writeCachedBody(store, 'k', URL_A, '[1]', 5000)
    expect(readCachedBody(store, 'k', `${URL_A}b`, 5100, MAX_AGE)).toBeNull()
  })

  it('ignores entries from the future (clock changed)', () => {
    const store = memoryStore()
    writeCachedBody(store, 'k', URL_A, '[1]', 5000)
    expect(readCachedBody(store, 'k', URL_A, 4000, MAX_AGE)).toBeNull()
  })

  it('treats junk as a miss', () => {
    const store = memoryStore()
    store.data.set('k', 'not json')
    expect(readCachedBody(store, 'k', URL_A, 0, MAX_AGE)).toBeNull()
    store.data.set('k', JSON.stringify({ url: URL_A, fetchedAt: 0, body: 'not json' }))
    expect(readCachedBody(store, 'k', URL_A, 0, MAX_AGE)).toBeNull()
    store.data.set('k', JSON.stringify({ url: URL_A, fetchedAt: 'x', body: '[]' }))
    expect(readCachedBody(store, 'k', URL_A, 0, MAX_AGE)).toBeNull()
  })

  it('survives storage that throws (private mode, quota)', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(() => writeCachedBody(broken, 'k', URL_A, '[]', 0)).not.toThrow()
    expect(readCachedBody(broken, 'k', URL_A, 0, MAX_AGE)).toBeNull()
    expect(readCachedBody(null, 'k', URL_A, 0, MAX_AGE)).toBeNull()
  })
})
