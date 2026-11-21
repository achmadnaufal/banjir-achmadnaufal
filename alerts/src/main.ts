import { createServer } from 'node:http'
import { createApiHandler } from './api'
import { loadConfig, type Config } from './config'
import { buildAlertPayload } from './payload'
import { readRiver, type RiverReading } from './river'
import type { AlertKind } from './rules'
import { broadcast, createWebPushSender } from './sender'
import { openStore } from './store'
import { startWatcher } from './watcher'

/**
 *   node main.cjs                       serve the API and run the watcher
 *   node main.cjs sample alert|allClear send a sample push to owner phones only
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

function main(): void {
  const config = loadConfig(process.env)
  const [command, arg] = process.argv.slice(2)
  if (command === undefined) return serve(config)
  if (command === 'sample' && (arg === 'alert' || arg === 'allClear')) {
    sample(config, arg).catch((err: unknown) => {
      log(`sample failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    })
    return
  }
  log('usage: node main.cjs [sample alert|allClear]')
  process.exitCode = 2
}

try {
  main()
} catch (err) {
  log(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
