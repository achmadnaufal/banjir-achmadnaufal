/**
 * Settings from the environment (`deploy/.env` on the VPS). Errors name the
 * variable, never its value — two of them are secrets.
 */

export type Config = {
  vapidPublicKey: string
  vapidPrivateKey: string
  vapidSubject: string
  ownerToken: string
  dbPath: string
  port: number
  allowedOrigins: string[]
}

const REQUIRED = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'OWNER_TOKEN'] as const
const PAGE_ORIGIN = 'https://banjir.achmadnaufal.com'

type Env = Record<string, string | undefined>

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 8080
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a whole number between 1 and 65535')
  }
  return port
}

export function loadConfig(env: Env): Config {
  const missing = REQUIRED.filter((name) => !env[name])
  if (missing.length > 0) throw new Error(`Missing settings: ${missing.join(', ')}`)
  return {
    vapidPublicKey: env.VAPID_PUBLIC_KEY as string,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY as string,
    vapidSubject: env.VAPID_SUBJECT || PAGE_ORIGIN,
    ownerToken: env.OWNER_TOKEN as string,
    dbPath: env.DB_PATH || '/data/alerts.sqlite3',
    port: parsePort(env.PORT),
    allowedOrigins: (env.ALLOWED_ORIGINS || PAGE_ORIGIN)
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o !== ''),
  }
}
