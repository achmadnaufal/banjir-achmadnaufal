import { createServer } from 'node:http'
import { createApiHandler } from './api'
import { loadConfig, type Config } from './config'
import { buildAlertPayload } from './payload'
import { readRiver, type RiverReading } from './river'
import type { AlertKind } from './rules'
import { broadcast, createWebPushSender } from './sender'
import { openStore } from './store'
import { useClassicTlsGroups } from './tlsGroups'
import { startWatcher, watchdogDue } from './watcher'

/**
 *   node main.cjs                       serve the API and run the watcher
 *   node main.cjs sample alert|allClear send a sample push to owner phones only
 *   node main.cjs owner-newest          mark the newest subscription as the owner's
 *
 * owner-newest exists because an iPhone home-screen app can't receive the
 * ?owner= link: it has its own storage and always opens at the start URL.
 * Run it right after the owner turns alerts on, while theirs is the newest.
 */

// Server process: logs go to stderr for `docker logs`.
const log = (msg: string) => console.error(`[banjir-alerts] ${new Date().toISOString()} ${msg}`)

function serve(config: Config): void {
  const store = openStore(config.dbPath)
  const send = createWebPushSender(
    { publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey, subject: config.vapidSubject },
    log,
  )
  const watcher = startWatcher({ store, fetchFn: fetch, send, log })
  const server = createServer(
    createApiHandler({
      store,
      send,
      vapidPublicKey: config.vapidPublicKey,
      ownerToken: config.ownerToken,
      allowedOrigins: config.allowedOrigins,
      startedAt: Date.now(),
      now: Date.now,
      log,
    }),
  )
  server.listen(config.port, () => log(`listening on ${config.port}`))

  // A hung run (or loop) never completes, and restart: unless-stopped won't
  // restart a merely unhealthy container — so exit and let Docker restart us.
  const startedAt = Date.now()
  setInterval(() => {
    if (watchdogDue(store.getState().lastRunAt, startedAt, Date.now())) {
      log('watchdog: no completed run in 15 min, exiting for a restart')
      process.exit(1)
    }
  }, 60_000).unref()

  const shutdown = () => {
    log('shutting down')
    watcher.stop()
    server.close(() => {
      store.close()
      process.exit(0)
    })
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

const SAMPLE_READING: RiverReading = {
  levelCm: 200,
  band: 'siaga3',
  observedAt: new Date(),
  prevLevelCm: 190,
  ratePerHour: 10,
  source: 'manual',
  thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 },
}

async function sample(config: Config, kind: AlertKind): Promise<void> {
  const store = openStore(config.dbPath)
  const send = createWebPushSender(
    { publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey, subject: config.vapidSubject },
    log,
  )
  const now = new Date()
  const { reading } = await readRiver(fetch, now, store.getState().bpbdTable)
  const owners = store.listSubscriptions().filter((s) => s.isOwner)
  const result = await broadcast(owners, (s) => buildAlertPayload(kind, reading ?? SAMPLE_READING, s.locale), send)
  log(`sample ${kind}: sent ${result.delivered.length}, gone ${result.gone.length}, failed ${result.failed.length}`)
  store.close()
}

function markNewestAsOwner(config: Config): void {
  const store = openStore(config.dbPath)
  const newest = store.newestSubscription()
  if (newest === null) {
    log('owner-newest: no subscriptions yet')
    process.exitCode = 1
  } else {
    store.setOwner(newest.endpoint, true)
    const ageMin = Math.round((Date.now() - newest.createdAt) / 60_000)
    log(`owner-newest: marked the ${new URL(newest.endpoint).host} subscription created ${ageMin} min ago`)
  }
  store.close()
}

function main(): void {
  const config = loadConfig(process.env)
  const [command, arg] = process.argv.slice(2)
  if (command === undefined) return serve(config)
  if (command === 'owner-newest') return markNewestAsOwner(config)
  if (command === 'sample' && (arg === 'alert' || arg === 'allClear')) {
    sample(config, arg).catch((err: unknown) => {
      log(`sample failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    })
    return
  }
  log('usage: node main.cjs [sample alert|allClear | owner-newest]')
  process.exitCode = 2
}

try {
  // Before any connection is made: BPBD resets post-quantum handshakes from the VPS.
  useClassicTlsGroups()
  main()
} catch (err) {
  log(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
