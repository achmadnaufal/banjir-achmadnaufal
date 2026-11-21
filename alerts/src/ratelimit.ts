/**
 * Token bucket per key (an IP or an endpoint), kept in memory: the service
 * is one process, and losing the counters on restart only resets them.
 */

export type RateLimiter = { take(key: string, nowMs: number): boolean }

type Bucket = { tokens: number; updatedMs: number }

/** Above this many keys, idle full buckets are dropped. */
const PRUNE_ABOVE = 5_000

export function createRateLimiter(opts: { capacity: number; refillEveryMs: number }): RateLimiter {
  const { capacity, refillEveryMs } = opts
  const perMs = capacity / refillEveryMs
  const buckets = new Map<string, Bucket>()

  const prune = (nowMs: number) => {
    for (const [key, b] of buckets) {
      if (nowMs - b.updatedMs >= refillEveryMs) buckets.delete(key)
    }
  }

  return {
    take(key, nowMs) {
      if (buckets.size > PRUNE_ABOVE) prune(nowMs)
      const prev = buckets.get(key) ?? { tokens: capacity, updatedMs: nowMs }
      const tokens = Math.min(capacity, prev.tokens + (nowMs - prev.updatedMs) * perMs)
      const allowed = tokens >= 1
      buckets.set(key, { tokens: allowed ? tokens - 1 : tokens, updatedMs: nowMs })
      return allowed
    },
  }
}
