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

Both have `Access-Control-Allow-Origin: *`; no proxy needed. The XML uses **mm** while the time-series uses **cm**; conversion happens at the parser boundary in `src/lib/upstream.ts` so the rest of the app is in cm.

## Alert design

Browser Notification API + a synthetic Web Audio chime fires when `detectTransition(prev, next).direction === 'rising'`. Foreground-only — alerts do not fire when the tab is closed. Pin to home screen and keep the tab alive for monitoring.

## Deploy

See [`DEPLOY.md`](./DEPLOY.md).
