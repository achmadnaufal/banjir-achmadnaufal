# Closed-Page Flood Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Residents get a Web Push notification on their phone (iPhone home-screen app first) when the Pesanggrahan river is at WASPADA or higher, even with the page closed.

**Architecture:** A small Node/TypeScript service (`alerts/`) on the owner's Vultr VPS polls DSDA + BPBD every 5 min using the page's own river logic (`app/src/lib`), decides with a pure rule engine, stores subscriptions and state in SQLite, and sends Web Push. It is exposed at `banjir-api.achmadnaufal.com` through its own Cloudflare Tunnel in its own Compose project. The page gains PNG icons, a service-worker push handler and a subscribe/turn-off/test control.

**Tech Stack:** Node 22.22 (`node:sqlite`, `node:http`), TypeScript ~6.0.2, Vitest ^4.1.5, esbuild, `web-push` 3.6.7, Docker Compose + `cloudflared`, React 19 / vite-plugin-pwa (Workbox `importScripts`), `@vite-pwa/assets-generator`.

**Spec:** `docs/superpowers/specs/2026-11-21-closed-page-alerts-design.md`

## Global Constraints

- Bands use **≥**: WASPADA ≥ `siaga3` (150 cm), SIAGA ≥ `siaga2` (250 cm), BAHAYA ≥ `siaga1` (350 cm); thresholds from the data, fallback 150/250/350.
- Watcher interval **5 min**. A reading older than **2 h** never pushes. Hourly updates need the reading to be **≥ 60 min newer** (by `observedAt`) than the last pushed one. All-clear after **2 consecutive new readings** below WASPADA. Escalation pushes immediately.
- Owner alert when runs have failed for **> 1 h** or the newest reading is **> 3 h** old; repeat every **6 h** while it lasts; only to `is_owner` subscriptions.
- Healthcheck fails if the last completed run is **> 15 min** old (after a 15 min start grace).
- Store only: endpoint, p256dh, auth, locale (`en`|`id`), is_owner, created_at, last_ok_at. No IPs, names or emails at rest.
- Allowed push hosts: `web.push.apple.com`, `fcm.googleapis.com`, `updates.push.services.mozilla.com`, any host ending `.notify.windows.com`; `https:` only.
- Request body ≤ **4 KB**; subscriptions capped at **2 000**; `subscribe`/`unsubscribe` **10/min per IP** (`CF-Connecting-IP`); `test` **1/min per endpoint**.
- API host `https://banjir-api.achmadnaufal.com`; CORS origin `https://banjir.achmadnaufal.com` only (env-overridable for dev).
- API responses use the envelope `{ ok: boolean, data?: T, error?: string }`.
- VAPID subject `https://banjir.achmadnaufal.com` (no email). Secrets (`VAPID_PRIVATE_KEY`, `OWNER_TOKEN`, `TUNNEL_TOKEN`) live only in `/opt/banjir-alerts/deploy/.env` (mode 600) — never in git, never printed in output.
- VPS: Compose project `banjir-alerts`, path `/opt/banjir-alerts`, `mem_limit: 128m`, `read_only`, no published host ports, own `cloudflared` container. **Never stop/restart** `mykid-app-1`, `mykid-cloudflared-1`, `hbbs`, `hbbr`, `wg-easy`.
- Notification `tag`: `banjir-<SiagaLevel>` (e.g. `banjir-siaga3`, `banjir-normal`) — the same scheme as `useTransitionAlert`. Click URL `/?source=push`.
- Payload copy (exact; `HH:MM` in Asia/Jakarta):
  - alert/escalation title — ID `"<LABEL> · <cm> cm ▲ naik|▼ turun|■ datar"`, EN `"<LABEL> · <cm> cm ▲ rising|▼ falling|■ steady"`
  - body — ID `"Pos Pesanggrahan, HH:MM · +10 cm/jam · SIAGA di 250 cm"`, EN `"Pos Pesanggrahan, HH:MM · +10 cm/h · SIAGA at 250 cm"`; rate rounded to an integer with `+` when > 0, segment omitted when unknown; next-band segment omitted at BAHAYA.
  - all-clear — ID `"Kembali normal · <cm> cm"` / EN `"Back to normal · <cm> cm"`, body `"Pos Pesanggrahan, HH:MM"`.
  - test — ID `"Tes peringatan banjir"` / `"Peringatan aktif di ponsel ini."`; EN `"Flood alert test"` / `"Alerts are on for this phone."`
  - owner — ID `"Peringatan banjir tidak bisa membaca sungai"` / `"Bacaan terakhir: HH:MM"`; EN `"Flood alerts can't read the river"` / `"Last reading: HH:MM"` (`—` when none).
- Repo rules: TDD, immutable data, files < 400 lines, functions < 50 lines, no `console.log` in app code (the server logs through an injected `log`). Feature branch `feat/push-alerts`.

## Review Focus

1. **A phone whose subscription the server lost** (DB reset, VPS rebuilt) still shows "alerts on" → the page must re-register an existing browser subscription on every load. Test in Task 13.
2. **Server restarted mid-flood** → no duplicate push for a reading already announced. Test in Task 7 (reopen a file-backed store between runs).
3. **VPS clock is UTC** → notification times must be WIB. Test in Task 4 (UTC `now`, `observedAt` 12:00Z → `19:00`).
4. **One dead or slow push endpoint** among many → the others still get the alert, and the dead one is removed on 404/410. Test in Task 6.
5. **BPBD serving an HTML maintenance page or 503** → no push, problem recorded, the stored BPBD table kept. Test in Task 2.

---

### Task 1: Bands use ≥ on the page

**Files:**
- Modify: `app/src/lib/siaga.ts` (`classify`, `bands`)
- Test: `app/src/lib/siaga.test.ts`, `app/src/smoke.test.tsx`, `app/src/components/KeteranganLegend.test.tsx`

**Interfaces:**
- Produces: `classify(cm, t)` returns the band whose threshold `cm` **meets or exceeds**; `bands(t)[0].rangeText === '≥ 350 cm'`.

- [ ] **Step 1: Create the branch** — `git switch -c feat/push-alerts`
- [ ] **Step 2: Update the failing expectations**
  In `siaga.test.ts` change the boundary table to `[149,'normal'],[150,'siaga3'],[249,'siaga3'],[250,'siaga2'],[349,'siaga2'],[350,'siaga1']` (keep the others) and the `bands(T)` expectations' first `rangeText` to `'≥ 350 cm'` (custom: `'≥ 400 cm'`, fractional: `'≥ 350 cm'`). In `smoke.test.tsx` and `KeteranganLegend.test.tsx` replace `'> 350 cm'` with `'≥ 350 cm'` (grep for `'> '`).
- [ ] **Step 3: Run** `cd app && npx vitest run src/lib/siaga.test.ts` — Expected: FAIL at 150/250/350.
- [ ] **Step 4: Implement** — `classify` uses `>=`; `bands` row 1 text `` `≥ ${s1} cm` ``.
- [ ] **Step 5: Run** `npx vitest run && npx tsc -b && npx eslint src` — Expected: all pass except the two pre-existing date-rot failures in `smoke.test.tsx` ("defaults to English", "switches to Indonesian").
- [ ] **Step 6: Commit** — `git commit -am "fix: count a level exactly on a threshold as that band"`

### Task 2: `alerts/` package and the river reader

**Files:**
- Create: `alerts/package.json`, `alerts/tsconfig.json`, `alerts/vitest.config.ts`, `alerts/.gitignore` (`node_modules`, `dist`, `*.sqlite3`)
- Create: `app/src/lib/stationDefaults.ts` (move `STATION_DEFAULTS` out of `app/src/App.tsx`)
- Create: `alerts/src/river.ts`, Test: `alerts/src/river.test.ts`
- Modify: `app/src/App.tsx` (import `STATION_DEFAULTS`)

**Interfaces:**
- Consumes (app): `parseHistoryBody`, `buildHistoryUrl` (`lib/upstream`), `parseBpbdReadings`, `buildBpbdBody` (`lib/bpbd`), `BPBD_POST`, `BPBD_READINGS_URL`, `PESANGGRAHAN` (`config/station`), `sensorReading`, `pickReading`, `mergeManualTables`, `rateWindowMs`, `analysisAnchor`, `type Reading` (`lib/manualFallback`), `velocityCmPerHour` (`lib/analytics`), `classify`, `type SiagaLevel` (`lib/siaga`).
- Produces:
  - `export const STATION_DEFAULTS: StationDefaults` (app/src/lib/stationDefaults.ts)
  - `export type RiverReading = { levelCm: number; band: SiagaLevel; observedAt: Date; prevLevelCm: number | null; ratePerHour: number | null; source: ReadingSource; thresholdsCm: ThresholdsCm }`
  - `export type RiverRead = { reading: RiverReading | null; bpbdTable: HistoryResponse | null; ok: boolean; problems: string[] }` — `ok` = at least one source returned parseable data.
  - `export async function readRiver(fetchFn: typeof fetch, now: Date, storedTable: HistoryResponse | null): Promise<RiverRead>` — never throws.

- [ ] **Step 1: Scaffold** — `alerts/package.json`: `"type": "module"`, scripts `test: vitest run`, `typecheck: tsc --noEmit`, `build: esbuild src/main.ts --bundle --platform=node --target=node22 --outfile=dist/main.cjs` (CommonJS: `web-push` is CommonJS, so no ESM interop banner); deps `web-push@3.6.7`; devDeps `typescript@~6.0.2`, `vitest@^4.1.5`, `esbuild@^0.25.0`, `@types/node@^24`, `@types/web-push@^3.6.4`. `tsconfig.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `lib ["ES2022","DOM"]`, `types ["node"]`, `noEmit`, include `src`, `../app/src/lib`, `../app/src/config`, `../app/src/types`, `../app/src/i18n/locale.ts`. Run `cd alerts && npm install`.
- [ ] **Step 2: Move `STATION_DEFAULTS`** to `app/src/lib/stationDefaults.ts` (same value as in `App.tsx` today); `App.tsx` imports it. Run `cd app && npx vitest run` — unchanged results.
- [ ] **Step 3: Write failing tests** in `alerts/src/river.test.ts` with a fake `fetchFn` routing by URL (BPBD fixture: `../../app/src/test/fixtures/bpbd-charttma.json`; `now = 2026-11-21T19:55:00+07:00`):
  - `reads BPBD when the sensor series is silent` → `reading.levelCm === 200`, `band === 'siaga3'`, `source === 'manual'`, `prevLevelCm === 190`, `ratePerHour === 15` (17:00 170, 18:00 190, 19:00 200), `ok === true`.
  - `prefers a live sensor series` (series ending 19:50 at 230) → `source === 'sensor'`, `levelCm === 230`.
  - `merges BPBD into the stored table` (stored table with yesterday 23:00 point) → returned `bpbdTable.points` includes it and today's 20 points.
  - `keeps the stored table when BPBD sends an HTML maintenance page` → `bpbdTable` equals stored, `problems` has one `bpbd:` entry, no throw. *(Review Focus 5)*
  - `retries BPBD once after a 503` → second call succeeds, fetch called twice for BPBD.
  - `reports not ok when both sources fail` → `ok === false`, `reading` from the stored table or `null`.
  - `posts the same form the page does` → BPBD request is `POST` with body `pintuair_id=2&pintuair=Pos+Pesanggrahan`.
- [ ] **Step 4: Run** `cd alerts && npx vitest run src/river.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 5: Implement `readRiver`** — DSDA: `GET buildHistoryUrl(PESANGGRAHAN.id, now − 24 h, now)` → `parseHistoryBody`; BPBD: `POST BPBD_READINGS_URL` with `buildBpbdBody(BPBD_POST)`, one retry, → `parseBpbdReadings(text, now)` → `mergeManualTables(stored, fresh, now)`; `pickReading(sensorReading(null, history, STATION_DEFAULTS), table, STATION_DEFAULTS)`; rate = `velocityCmPerHour(points, analysisAnchor(source, observedAt, now), rateWindowMs(source))` over the chosen source's points; band = `classify(levelCm, thresholdsCm)`. Own `fetch` with an 8 s `AbortSignal.timeout`, no `cache` option.
- [ ] **Step 6: Run** `npx vitest run && npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 7: Commit** — `git add alerts app/src/lib/stationDefaults.ts app/src/App.tsx && git commit -m "feat(alerts): read the river with the page's own logic"`

### Task 3: Alert rule engine

**Files:** Create `alerts/src/rules.ts`, Test `alerts/src/rules.test.ts`

**Interfaces:**
- Consumes: `RiverReading` (Task 2), `RANK`, `type SiagaLevel`.
- Produces:
  - `export type AlertState = { lastBandAnnounced: SiagaLevel; lastPushAt: number | null; lastPushedReadingAt: number | null; lastSeenReadingAt: number | null; belowCount: number }`
  - `export const INITIAL_ALERT_STATE: AlertState` (`'normal'`, nulls, `0`)
  - `export type AlertKind = 'alert' | 'escalation' | 'allClear'`
  - `export type Decision = { push: AlertKind | null; next: AlertState }`
  - `export function decideAlert(reading: Pick<RiverReading,'band'|'observedAt'> | null, state: AlertState, now: Date): Decision`
  - constants `MAX_READING_AGE_MS = 2*60*60*1000`, `HOURLY_GAP_MS = 60*60*1000`, `ALL_CLEAR_AFTER = 2`

- [ ] **Step 1: Write failing tests** (times WIB on 2026-11-21; `r(band, 'HH:MM')` helper):
  - `stays quiet with no reading` / `with a reading older than 2 h` → `push null`, `next` equals input state.
  - `ignores a reading it has already seen` (same `observedAt` twice) → second `push null`.
  - `alerts on the first WASPADA reading` → `'alert'`; `next.lastBandAnnounced === 'siaga3'`, `lastPushedReadingAt` = reading time, `lastPushAt` = now.
  - `stays quiet on the next reading within the hour` (19:00 pushed, 19:50 new) → `null`, `lastSeenReadingAt` advanced.
  - `sends the hourly update once a reading is 60 min newer` (19:00 → 20:00) → `'alert'`.
  - `escalates immediately` (WASPADA pushed 19:00, SIAGA 19:10) → `'escalation'`.
  - `escalates once on a 249/251 wobble` (SIAGA, WASPADA, SIAGA within the hour) → pushes `[escalation, null, null]`.
  - `announces a drop within elevated bands at the hourly update` (SIAGA announced; WASPADA 30 min later → null; WASPADA 60 min after last push reading → `'alert'`, `lastBandAnnounced === 'siaga3'`).
  - `waits for two NORMAL readings before all-clear` → `[null, 'allClear']`, then `lastBandAnnounced === 'normal'`.
  - `does not flap at 150` (152, 148, 152, 148, 147 at hourly readings) → exactly `['alert', null, 'alert', null, 'allClear']`: the third reading is ≥ 60 min after the last pushed one, so it is an hourly update, not a re-alert, and it resets `belowCount` to 0. The same values every 10 min (sensor) → `['alert', null, null, null, null]`.
  - `never pushes for NORMAL when nothing was announced`.
  - `does not mutate the state it is given`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement `decideAlert`** following the spec's rule list exactly (new = `observedAt > lastSeenReadingAt`; hourly gap measured `observedAt − lastPushedReadingAt` — BPBD's posting lag varies, so measuring wall-clock push spacing would skip every other hourly reading; every pushed decision sets `lastBandAnnounced = band`, `lastPushAt = now`, `lastPushedReadingAt = observedAt`, `belowCount = 0`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(alerts): decide when a river reading earns a push`

### Task 4: Payload builder

**Files:** Create `alerts/src/payload.ts`, Test `alerts/src/payload.test.ts`

**Interfaces:**
- Consumes: `RiverReading`, `AlertKind`, `siagaMeta`, `trend`, `type SiagaLevel`.
- Produces:
  - `export type { Locale }` re-exported from `app/src/i18n/locale.ts` (`'en' | 'id'`) — one definition for page and server
  - `export type PushPayload = { title: string; body: string; tag: string; url: string }`
  - `export function buildAlertPayload(kind: AlertKind, r: RiverReading, locale: Locale): PushPayload`
  - `export function buildTestPayload(locale: Locale): PushPayload` (tag `banjir-test`)
  - `export function buildOwnerPayload(lastReadingAt: Date | null, locale: Locale): PushPayload` (tag `banjir-owner`)

- [ ] **Step 1: Write failing tests** — exact strings from Global Constraints:
  - ID alert at 200 cm, prev 190, rate 10, 19:00 → title `WASPADA · 200 cm ▲ naik`, body `Pos Pesanggrahan, 19:00 · +10 cm/jam · SIAGA di 250 cm`, tag `banjir-siaga3`, url `/?source=push`.
  - EN version → `WASPADA · 200 cm ▲ rising`, `… · +10 cm/h · SIAGA at 250 cm`.
  - falling (`▼ turun`, rate `-10`), steady (`■ datar`, rate `0`), rate `null` → no rate segment, BAHAYA → no next-band segment.
  - all-clear ID → title `Kembali normal · 140 cm`, body `Pos Pesanggrahan, 19:00`, tag `banjir-normal`.
  - **WIB from a UTC clock** — `observedAt = 2026-11-21T12:00:00Z` → `19:00` regardless of `process.env.TZ`. *(Review Focus 3)*
  - test and owner payloads (owner with `null` → `—`).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (format time with `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false })`; next band = the lowest threshold above `levelCm`). **Step 4: Run** — PASS. **Step 5: Commit** — `feat(alerts): notification text in Indonesian and English`

### Task 5: SQLite store

**Files:** Create `alerts/src/store.ts`, Test `alerts/src/store.test.ts`

**Interfaces:**
- Consumes: `AlertState`, `INITIAL_ALERT_STATE`, `Locale`, `serializeManual`, `parseStoredManual` (`app/src/lib/manualCache`).
- Produces:
  - `export type Subscription = { endpoint: string; p256dh: string; auth: string; locale: Locale; isOwner: boolean }`
  - `export type ServiceState = { alert: AlertState; bpbdTable: HistoryResponse | null; lastRunAt: number | null; lastRunOk: boolean; lastError: string | null; failingSince: number | null; lastOwnerAlertAt: number | null; lastReadingAt: number | null; lastReadingSource: ReadingSource | null }`
  - `export const INITIAL_SERVICE_STATE: ServiceState`
  - `export interface Store { getState(): ServiceState; saveState(s: ServiceState): void; upsertSubscription(s: Subscription, now: Date): void; deleteSubscription(endpoint: string): boolean; listSubscriptions(): Subscription[]; countSubscriptions(): number; hasSubscription(endpoint: string): boolean; markDelivered(endpoint: string, now: Date): void; close(): void }`
  - `export function openStore(path: string): Store` (`node:sqlite` `DatabaseSync`; `':memory:'` for tests)

- [ ] **Step 1: Write failing tests** — round-trip state incl. a BPBD table with Dates; initial state on an empty DB; upsert twice keeps one row and updates locale/owner; delete returns `true`/`false`; count; `listSubscriptions` never returns timestamps; state survives `close()` + reopen of a temp file (`os.tmpdir()`).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** — tables `subscriptions(endpoint TEXT PRIMARY KEY, p256dh, auth, locale, is_owner INTEGER, created_at INTEGER, last_ok_at INTEGER)` and `kv(key TEXT PRIMARY KEY, value TEXT)` holding the JSON state under `'state'` (BPBD table via `serializeManual`). **Step 4: Run** — PASS. **Step 5: Commit** — `feat(alerts): keep subscriptions and watcher state in SQLite`

### Task 6: Push sender and broadcast

**Files:** Create `alerts/src/sender.ts`, Test `alerts/src/sender.test.ts`

**Interfaces:**
- Consumes: `Subscription`, `PushPayload`.
- Produces:
  - `export type SendResult = 'ok' | 'gone' | 'failed'`
  - `export type PushSender = (sub: Subscription, payload: PushPayload) => Promise<SendResult>`
  - `export function createWebPushSender(vapid: { publicKey: string; privateKey: string; subject: string }, log: (msg: string) => void): PushSender` — `web-push` `sendNotification` with `{ TTL: 7200, urgency: 'high' }`; `WebPushError` 404/410 → `'gone'`; anything else → `'failed'` (logged without keys).
  - `export async function broadcast(subs: Subscription[], payloadFor: (s: Subscription) => PushPayload, send: PushSender, concurrency?: number): Promise<{ delivered: string[]; gone: string[]; failed: string[] }>` — default concurrency 10.

- [ ] **Step 1: Write failing tests** — fake `PushSender`:
  - `delivers to every subscriber with its own locale`.
  - `one throwing and one 410 endpoint don't stop the rest` → `delivered` has the healthy ones, `gone` the 410, `failed` the thrower. *(Review Focus 4)*
  - `never runs more than <concurrency> sends at once` (track in-flight max with deferred promises).
  - `createWebPushSender maps a 410 WebPushError to 'gone'` (mock `web-push` with `vi.mock`).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. **Step 5: Commit** — `feat(alerts): send pushes in parallel and drop dead endpoints`

### Task 7: Watcher run, owner alert, loop

**Files:** Create `alerts/src/watcher.ts`, Test `alerts/src/watcher.test.ts`

**Interfaces:**
- Consumes: `readRiver`, `decideAlert`, `buildAlertPayload`, `buildOwnerPayload`, `Store`, `broadcast`, `PushSender`.
- Produces:
  - `export type WatcherDeps = { store: Store; fetchFn: typeof fetch; send: PushSender; log: (msg: string) => void }`
  - `export async function runOnce(deps: WatcherDeps, now: Date): Promise<ServiceState>` — never throws; records `lastError`.
  - `export function ownerAlertDue(s: ServiceState, now: Date): boolean`
  - `export function startWatcher(deps: WatcherDeps, intervalMs?: number): { stop(): void }` — runs immediately, then every 5 min; skips a tick while a run is in progress.
  - constants `OWNER_FAILING_MS = 60*60*1000`, `OWNER_STALE_READING_MS = 3*60*60*1000`, `OWNER_REPEAT_MS = 6*60*60*1000`

- [ ] **Step 1: Write failing tests** (in-memory store, fake fetch, fake sender):
  - `pushes to all subscribers on the first WASPADA reading` and deletes `gone` endpoints, `markDelivered` for delivered.
  - `does not push the same reading twice across a restart` — file-backed store, `runOnce`, `close`, reopen, `runOnce` with the same upstream → sender called once in total. *(Review Focus 2)*
  - `records a failing run` → `lastRunOk false`, `failingSince` set; a later ok run clears it.
  - `owner alert after 61 min of failures, only to owner subscriptions, then not again for 6 h`.
  - `owner alert when the newest reading is over 3 h old even though fetches succeed`.
  - `an unexpected throw inside a run is recorded, not raised`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. **Step 5: Commit** — `feat(alerts): run the watcher and tell the owner when it goes blind`

### Task 8: Request validation and rate limiting

**Files:** Create `alerts/src/validate.ts`, `alerts/src/ratelimit.ts`; Tests alongside.

**Interfaces:**
- Produces:
  - `export function isAllowedPushEndpoint(url: string): boolean`
  - `export type SubscribeRequest = { subscription: { endpoint: string; keys: { p256dh: string; auth: string } }; locale: Locale; ownerToken: string | null }`
  - `export function parseSubscribeBody(raw: unknown): SubscribeRequest | { error: string }` — p256dh decodes (base64url) to 65 bytes, auth to 16; locale defaults to `'id'` if missing/unknown.
  - `export function parseEndpointBody(raw: unknown): { endpoint: string } | { error: string }`
  - `export type RateLimiter = { take(key: string, nowMs: number): boolean }`
  - `export function createRateLimiter(opts: { capacity: number; refillEveryMs: number }): RateLimiter` (token bucket, prunes idle keys)

- [ ] **Step 1: Write failing tests** — allowed: an Apple endpoint, an FCM endpoint, `wns2-par02p.notify.windows.com`; rejected: `http://web.push.apple.com/…`, `https://web.push.apple.com.evil.com/…`, `https://169.254.169.254/`, `https://notify.windows.com.evil.io/`; key length checks; unknown locale → `'id'`; limiter allows 10 then refuses, refills after the period.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. **Step 5: Commit** — `feat(alerts): validate push subscriptions and rate-limit callers`

### Task 9: HTTP API

**Files:** Create `alerts/src/api.ts`, Test `alerts/src/api.test.ts`

**Interfaces:**
- Consumes: `Store`, `PushSender`, `buildTestPayload`, `parseSubscribeBody`, `parseEndpointBody`, `RateLimiter`.
- Produces: `export type ApiDeps = { store: Store; send: PushSender; vapidPublicKey: string; ownerToken: string; allowedOrigins: string[]; startedAt: number; now: () => number }` and `export function createApiHandler(deps: ApiDeps): (req: IncomingMessage, res: ServerResponse) => void`.
  - `GET /healthz` → 200 `{ok:true}` if `lastRunAt` ≤ 15 min old or uptime < 15 min, else 503.
  - `GET /api/push/key` → `{ok:true,data:{publicKey}}`
  - `POST /api/push/subscribe` → 201; owner flag only when `ownerToken` matches (`crypto.timingSafeEqual`); 503 `subscriptions full` at 2 000 for a new endpoint.
  - `POST /api/push/unsubscribe` → 200 / 404.
  - `POST /api/push/test` → 202 after sending `buildTestPayload(locale)` to that one subscription; 404 if unknown; 429 if within 1 min.
  - `GET /api/push/status` → `{ok:true,data:{lastRunAt,lastRunOk,lastReadingAt,lastReadingSource,subscribers}}` (no `lastError`).
  - `OPTIONS *` → 204 with CORS for allowed origins; disallowed origin gets no CORS headers.
  - Body > 4 KB → 413; bad JSON → 400; rate-limited → 429.

- [ ] **Step 1: Write failing tests** — start the handler on `http.createServer().listen(0)` and use `fetch`: every route above, CORS preflight from the allowed origin and from `https://evil.example`, 4 KB limit, 11th subscribe in a minute from one `CF-Connecting-IP` → 429, owner token mismatch stores `isOwner false`, status never contains `lastError`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** with `node:http` only. **Step 4: Run** — PASS. **Step 5: Commit** — `feat(alerts): subscribe, unsubscribe, test and status API`

### Task 10: Config, entry point, container

**Files:** Create `alerts/src/config.ts` (+ test), `alerts/src/main.ts`, `alerts/Dockerfile`, `alerts/.dockerignore`

**Interfaces:**
- Produces: `export type Config = { vapidPublicKey; vapidPrivateKey; vapidSubject; ownerToken; dbPath; port; allowedOrigins: string[] }` and `export function loadConfig(env: NodeJS.ProcessEnv): Config` — throws naming each missing variable (never its value). Defaults: `DB_PATH=/data/alerts.sqlite3`, `PORT=8080`, `ALLOWED_ORIGINS=https://banjir.achmadnaufal.com`, `VAPID_SUBJECT=https://banjir.achmadnaufal.com`. Required: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `OWNER_TOKEN`.
- `main.ts`: `node dist/main.cjs` serves the API + starts the watcher; `node dist/main.cjs sample <alert|allClear>` sends a sample payload (current reading, or 200 cm WASPADA if none) to **owner subscriptions only** and exits — for the iPhone end-to-end test.

- [ ] **Step 1: Failing tests for `loadConfig`** (missing vars listed by name; message never contains a provided secret). **Step 2: Run** — FAIL. **Step 3: Implement** `config.ts`, then `main.ts` (wiring only; log via `console.error` with a `[banjir-alerts]` prefix — server process, not app code).
- [ ] **Step 4: Dockerfile** — `FROM node:22.22.0-slim`, non-root user (uid 10001), `/data` owned by it, copy only `dist/main.cjs`, `CMD ["node","main.cjs"]`, `EXPOSE 8080`.
- [ ] **Step 5: Local smoke** — `npm run build` then, with throwaway keys from `npx web-push generate-vapid-keys`, `DB_PATH=$(mktemp -d)/a.sqlite3 … node dist/main.cjs &`; `curl -s localhost:8080/healthz` → `{"ok":true}`; `curl -s localhost:8080/api/push/status` shows a `lastRunAt` within a minute (real upstream). Stop it.
- [ ] **Step 6: Commit** — `feat(alerts): entry point, config and container image`

### Task 11: Deploy to the VPS

**Files:** Create `alerts/deploy/compose.yaml`, `alerts/deploy/deploy.sh`, `alerts/deploy/.env.example`, `alerts/deploy/cloudflare/setup_tunnel.py` (+ `test_setup_tunnel.py`); Modify `README.md`, `DEPLOY.md`.

**Interfaces:**
- Consumes: the image from Task 10. Mirrors `~/projects/mykid/deploy/` (read it first).

- [ ] **Step 1: `compose.yaml`** — project `banjir-alerts`; `app` (build `..`, `mem_limit: 128m`, `read_only: true`, tmpfs `/tmp`, volume `banjir-alerts-data:/data`, env from `.env`, healthcheck `node -e` fetching `http://127.0.0.1:8080/healthz`, interval 60s, start_period 30s, `restart: unless-stopped`); `cloudflared` (`cloudflare/cloudflared:2026.10.7`, `TUNNEL_TOKEN` required, `mem_limit: 64m`, depends on app healthy). No `ports:`.
- [ ] **Step 2: `setup_tunnel.py`** — copy mykid's script and tests; set `HOSTNAME = "banjir-api.achmadnaufal.com"`, `TUNNEL_NAME = "banjir-alerts"`, `SERVICE = "http://app:8080"`, `ENV_PATH = "/opt/banjir-alerts/deploy/.env"`; **remove** the Access application/policy steps and their tests (the API is public). Run `python3.12 -m pytest alerts/deploy/cloudflare -q` — PASS.
- [ ] **Step 3: `deploy.sh`** — copy mykid's; `DEST=/opt/banjir-alerts`, `URL=https://banjir-api.achmadnaufal.com`, `NEIGHBOURS=(hbbs hbbr wg-easy mykid-app-1 mykid-cloudflared-1)`, tests = `cd alerts && npm test`, build `npm run build` locally, rsync `alerts/{dist,Dockerfile,.dockerignore,deploy}` excluding `deploy/.env`; health checks for `banjir-alerts-app-1` / `banjir-alerts-cloudflared-1`.
- [ ] **Step 4: Ask the owner** whether `~/.config/mykid/cf_token` may be reused for this tunnel + DNS record (it needs Tunnel edit + DNS edit on `achmadnaufal.com`); if not, the owner creates a token and saves it to `~/.config/banjir-alerts/cf_token` (mode 600). Do not create tokens yourself.
- [ ] **Step 5: Secrets** — generate VAPID keys and a 24-byte hex `OWNER_TOKEN` locally, write `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `OWNER_TOKEN` to `/opt/banjir-alerts/deploy/.env` over `ssh` stdin (`umask 077`), never echoing private values; keep `OWNER_TOKEN` in `~/.config/banjir-alerts/owner_token` (mode 600) for the owner link. `.env.example` lists names only.
- [ ] **Step 6: Run** `setup_tunnel.py --verify-only`, then `setup_tunnel.py`, then `alerts/deploy/deploy.sh` — Expected: neighbours ✓ before and after, `banjir-alerts-app-1` healthy, `curl https://banjir-api.achmadnaufal.com/healthz` → `{"ok":true}`, `/api/push/status` shows `lastRunOk: true` and a `lastReadingAt`.
- [ ] **Step 7: Docs** — README "Alerts while closed" section (architecture, `/status`, owner link), DEPLOY.md section for `alerts/deploy/deploy.sh`. **Commit** — `feat(alerts): deploy beside mykid with its own tunnel`

### Task 12: Page icons and service-worker push handler

**Files:**
- Create: `app/pwa-assets.config.ts`, generated PNGs in `app/public/` (`pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`)
- Create: `app/public/push-sw.js`, Test `app/src/sw/pushSw.test.ts`
- Modify: `app/vite.config.ts` (manifest icons, `workbox.importScripts: ['push-sw.js']`), `app/index.html` (`apple-touch-icon` → PNG), `app/package.json` (devDep `@vite-pwa/assets-generator@^1.0.0`, script `generate-pwa-assets`)

- [ ] **Step 1: Generate icons** — `minimal2023Preset` from `public/favicon.svg`; run `npm run generate-pwa-assets`; check the five PNGs exist.
- [ ] **Step 2: Write failing test** `pushSw.test.ts` — load `public/push-sw.js` into `vm.runInNewContext` with a fake `self` (`addEventListener` capture, `registration.showNotification` spy, `clients.matchAll/openWindow` spies):
  - `push shows the payload's title, body, tag, icon /pwa-192x192.png and data.url`.
  - `push with no or bad data still shows a generic notification` (iOS revokes subscriptions that push without showing one) — title `Monitor Banjir`.
  - `notificationclick focuses an open window, else opens data.url`.
- [ ] **Step 3: Run** — FAIL. **Step 4: Implement `push-sw.js`** (plain JS, `event.waitUntil` around both handlers). **Step 5: Wire** manifest icons (192/512 `any`, 512 maskable), `importScripts`, apple-touch-icon. **Step 6: Run** `npx vitest run && npm run build` and check `dist/sw.js` contains `importScripts("push-sw.js")` — PASS. **Step 7: Commit** — `feat: PNG app icons and a push handler in the service worker`

### Task 13: Push client and hook

**Files:** Create `app/src/config/alerts.ts`, `app/src/lib/pushClient.ts` (+ test), `app/src/hooks/usePushAlerts.ts` (+ test)

**Interfaces:**
- Produces:
  - `export const ALERTS_API_BASE = import.meta.env.VITE_ALERTS_API_BASE ?? 'https://banjir-api.achmadnaufal.com'`; `OWNER_TOKEN_KEY = 'banjir:ownerToken'`.
  - `export type PushSupport = 'supported' | 'needs-install' | 'unsupported'`
  - `export function detectPushSupport(env: { userAgent: string; maxTouchPoints: number; standalone: boolean; hasPushManager: boolean; hasServiceWorker: boolean }): PushSupport` — iPhone/iPad (incl. iPadOS "Macintosh" + touch) not standalone → `'needs-install'`; push APIs present → `'supported'`; else `'unsupported'`.
  - `export function urlBase64ToUint8Array(s: string): Uint8Array`
  - `export type ServiceStatus = { lastRunAt: number | null; lastRunOk: boolean; lastReadingAt: number | null; lastReadingSource: 'sensor' | 'manual' | null; subscribers: number }`
  - `export type AlertsApi = { key(): Promise<string>; subscribe(sub: PushSubscriptionJSON, locale: Locale, ownerToken: string | null): Promise<void>; unsubscribe(endpoint: string): Promise<void>; test(endpoint: string): Promise<void>; status(): Promise<ServiceStatus> }`
  - `export function createAlertsApi(base: string, fetchFn?: typeof fetch): AlertsApi` — throws `UpstreamError` on non-2xx / `ok:false`.
  - `export type PushAlertsView = 'needs-install' | 'unsupported' | 'off' | 'on' | 'denied' | 'working'`
  - `export function usePushAlerts(locale: Locale, deps?: { api?: AlertsApi; env?: …; registration?: Promise<ServiceWorkerRegistration> }): { view: PushAlertsView; error: string | null; service: ServiceStatus | null; enable(): Promise<void>; disable(): Promise<void>; sendTest(): Promise<void> }`

- [ ] **Step 1: Failing tests for `pushClient`** — support detection for iPhone Safari tab, iPhone standalone, iPadOS-as-Macintosh, desktop Chrome, old iOS without PushManager; `urlBase64ToUint8Array` round-trip of a 65-byte key; `createAlertsApi` sends JSON with the right paths and surfaces `ok:false` errors.
- [ ] **Step 2: Failing tests for `usePushAlerts`** (`renderHook`, fake registration/pushManager, fake api):
  - `enable` asks permission, subscribes with `userVisibleOnly: true` and the server key, posts with locale and stored owner token → view `'on'`.
  - **`re-registers an existing browser subscription on load`** → `api.subscribe` called without user action. *(Review Focus 1)*
  - `denied permission` → view `'denied'`.
  - `disable` unsubscribes in the browser and on the server → `'off'`.
  - `reads ?owner=<token> once, stores it, and removes it from the address bar` (`history.replaceState`).
  - `polls status every 5 min while visible`.
- [ ] **Step 3: Run** — FAIL. **Step 4: Implement.** **Step 5: Run** — PASS. **Step 6: Commit** — `feat: subscribe this phone to closed-page alerts`

### Task 14: Alerts control on the page

**Files:**
- Create: `app/src/components/PushAlerts.tsx` (+ test)
- Modify: `app/src/App.tsx` (render `PushAlerts` in place of `AlertOptIn`), `app/src/i18n/messages.ts`
- Delete: `app/src/components/AlertOptIn.tsx` and its now-unused `alerts*` copy keys

- [ ] **Step 1: Failing component tests** — one per view:
  - `needs-install` shows the iPhone steps (Share → Add to Home Screen → open from the Home Screen → Turn on alerts), no button.
  - `off` shows **Turn on alerts**; `on` shows "Alerts are on for this phone", **Send test**, **Turn off**.
  - `denied` explains re-enabling in Settings → Notifications → Monitor Banjir.
  - service line `Alert service checked 3 min ago`; a warning when `lastRunAt` is > 20 min old or `null`.
  - Indonesian copy renders when locale is `id`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** component + EN/ID copy keys (`pushInstallTitle`, `pushInstallSteps`, `pushEnable`, `pushOnTitle`, `pushOnBody`, `pushTest`, `pushTestSent`, `pushTurnOff`, `pushDenied`, `pushUnsupported`, `pushServiceChecked(min)`, `pushServiceStale`, `pushError`); update `footerAlertsNote` and `aboutAlertsBody` so they no longer say alerts need the page open. `useTransitionAlert` stays for the open page.
- [ ] **Step 4: Run** `npx vitest run && npx tsc -b && npx eslint src && npm run build` — PASS (bar the two date-rot tests). **Step 5: Commit** — `feat: turn closed-page alerts on and off from the page`

### Task 15: Release and iPhone end-to-end

- [ ] **Step 1: Whole-branch review** by a fresh reviewer (executes the tests, probes the Review Focus list); fix findings test-first.
- [ ] **Step 2: Merge** `feat/push-alerts` into `main`; push as `achmadnaufal` (one-off credential helper — see memory `reference_github_two_accounts`).
- [ ] **Step 3: Deploy the page** — owner runs `cd ~/projects/banjir-achmadnaufal/app && npm run build && wrangler pages deploy dist --project-name=banjir-achmadnaufal --branch=main`; verify the live bundle references `push-sw.js` and the PNG icons.
- [ ] **Step 4: iPhone** (owner): open `https://banjir.achmadnaufal.com/?owner=<token>` in Safari → Share → Add to Home Screen → open from the Home Screen → Turn on alerts → Send test → notification arrives with the PNG icon.
- [ ] **Step 5: Forced sample** — `ssh root@45.77.33.192 'cd /opt/banjir-alerts/deploy && docker compose exec app node main.cjs sample alert'` → owner's iPhone shows the alert text; tap opens the app. Repeat with `allClear`.
- [ ] **Step 6: Close the app fully, lock the phone, run the sample again** → it still arrives.
- [ ] **Step 7: Update memory** (`project_banjir_pesanggrahan.md`): alerts service location, owner link location, deploy command.
