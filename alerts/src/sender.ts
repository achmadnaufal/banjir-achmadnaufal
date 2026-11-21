import webpush from 'web-push'
import type { PushPayload } from './payload'
import type { Subscription } from './store'

export type SendResult = 'ok' | 'gone' | 'failed'

export type PushSender = (sub: Subscription, payload: PushPayload) => Promise<SendResult>

export type VapidConfig = { publicKey: string; privateKey: string; subject: string }

/** A flood warning older than this is no longer worth delivering. */
const TTL_SECONDS = 2 * 60 * 60
/** A push service that never answers would otherwise hang the whole run. */
const SEND_TIMEOUT_MS = 10_000
const DEFAULT_CONCURRENCY = 10

function statusOf(err: unknown): number | null {
  const code = (err as { statusCode?: unknown } | null)?.statusCode
  return typeof code === 'number' ? code : null
}

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return 'invalid-endpoint'
  }
}

export function createWebPushSender(vapid: VapidConfig, log: (msg: string) => void): PushSender {
  return async (sub, payload) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { vapidDetails: vapid, TTL: TTL_SECONDS, urgency: 'high', timeout: SEND_TIMEOUT_MS },
      )
      return 'ok'
    } catch (err) {
      const status = statusOf(err)
      // 404/410: the browser dropped this subscription; it will never work again.
      if (status === 404 || status === 410) return 'gone'
      const reason = err instanceof Error ? err.message : String(err)
      log(`push to ${hostOf(sub.endpoint)} failed (${status ?? 'no status'}): ${reason}`)
      return 'failed'
    }
  }
}

export type BroadcastResult = { delivered: string[]; gone: string[]; failed: string[] }

/** Sends to everyone, a few at a time; one bad endpoint never blocks the rest. */
export async function broadcast(
  subs: Subscription[],
  payloadFor: (s: Subscription) => PushPayload,
  send: PushSender,
  concurrency: number = DEFAULT_CONCURRENCY,
): Promise<BroadcastResult> {
  const outcomes: SendResult[] = new Array(subs.length)
  let next = 0
  const worker = async () => {
    while (next < subs.length) {
      const i = next++
      outcomes[i] = await send(subs[i], payloadFor(subs[i])).catch((): SendResult => 'failed')
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, subs.length) }, worker))

  const pick = (want: SendResult) => subs.filter((_, i) => outcomes[i] === want).map((s) => s.endpoint)
  return { delivered: pick('ok'), gone: pick('gone'), failed: pick('failed') }
}
