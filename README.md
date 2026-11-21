# Banjir Pesanggrahan

A focused, mobile-first PWA for the Pesanggrahan (P.S. Pesanggrahan 1, ID 160) water-gate observation post in Jakarta. Live water level + browser-based early-warning chime when the level rises into a higher siaga band.

Deployed at [`banjir.achmadnaufal.com`](https://banjir.achmadnaufal.com) on Cloudflare Pages.

Data is pulled directly from the public DSDA DKI Jakarta endpoints — no backend.

## Local development

```sh
cd app
npm install
npm run dev          # http://localhost:5173
npm run test         # vitest run
npm run test:coverage
npm run lint
npm run build
```

## Stack

- Vite 7 + React 19 + TypeScript 5.9 + Tailwind 4
- Recharts 3 for the trend chart with siaga reference areas
- `vite-plugin-pwa` (Workbox) for offline-degraded behaviour and home-screen install
- Vitest 4 + jsdom + Testing Library for unit tests (80%+ coverage on `src/lib`)

## Data sources

| URL | What | Cadence |
|---|---|---|
| `https://poskobanjir.dsdadki.web.id/xmldata.xml` | Latest reading for every gate (mm) | ~10 min |
| `https://poskobanjir.dsdadki.web.id/Pages/GenerateDataTinggiAir.aspx?IdPintuAir=160&StartDate=dd-MM-yyyy&EndDate=dd-MM-yyyy` | Time-series for one gate (cm) | ~10 min |

| `POST https://bpbd.jakarta.go.id/api/charttma` (form `pintuair_id=2&pintuair=Pos Pesanggrahan`) | BPBD DKI's hourly **manual** gauge readings for today (cm) — fallback | hourly |

All three have `Access-Control-Allow-Origin: *`; no proxy needed. The XML uses **mm** while the time-series uses **cm**; conversion happens at the parser boundary in `src/lib/upstream.ts` so the rest of the app is in cm.

### Sensor fallback

The DSDA sensor feed is primary. When it goes quiet (gate 160 dropped out of `xmldata.xml` on 2026-11-18), the page shows BPBD's hourly manual reading instead — but only while that reading is strictly newer than anything the sensor has, so a live sensor always wins (`src/lib/manualFallback.ts`). BPBD's endpoint returns today's hours only, as undated `HH:MM` labels, so `src/lib/bpbd.ts` stamps them with the Jakarta date and re-dates yesterday's table when it is still served after midnight. The table is kept in `localStorage` and merged across polls (48 h), which keeps the reading, the chart and the 24h stats continuous over midnight and stops a cached sensor level from re-triggering the rising alert on every page open. Hourly readings count as stale after 2 h, and their rate/ETA are measured over the last three hours from the reading's own time.

## Alert design

Browser Notification API + a synthetic Web Audio chime fires when `detectTransition(prev, next).direction === 'rising'`. Foreground-only — alerts do not fire when the tab is closed. Pin to home screen and keep the tab alive for monitoring.

## Deploy

See [`DEPLOY.md`](./DEPLOY.md).
