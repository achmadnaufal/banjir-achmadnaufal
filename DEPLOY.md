# Deploy to Cloudflare Pages

Mirrors `/Users/achmadnaufal/projects/achmadnaufal-website/DEPLOY.md`.

## 1. Push to GitHub

```sh
cd /Users/achmadnaufal/projects/banjir-achmadnaufal
gh repo create banjir-achmadnaufal --public --source=. --remote=origin --push
```

## 2. Connect to Cloudflare Pages

1. dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git.
2. Pick `banjir-achmadnaufal`.
3. Build settings:
   - Framework preset: **Vite**
   - Root directory: `app`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION=22`
4. Save and Deploy → ships to `banjir-achmadnaufal.pages.dev` in ~1 min.

## 3. Attach `banjir.achmadnaufal.com`

Pages project → Custom domains → Set up a custom domain → `banjir.achmadnaufal.com`.

DNS is already on Cloudflare (the parent zone `achmadnaufal.com`), so the CNAME is created automatically. SSL provisions in a few minutes.

Verify "Always Use HTTPS" is on in the zone's SSL/TLS settings (it is, for the parent site).

## 4. Iterate

Edit, commit, push to `main`. Cloudflare auto-deploys every commit.

## Optional

- **Web Analytics**: enable in the Pages project settings (free, no code change).
- **Real PNG icons**: drop `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png` into `app/public/` and update `vite.config.ts`'s manifest. The current SVG-only icon works but a maskable PNG looks crisper on Android.
- **Always-on alerts**: out of scope for the current build (browser-only by design). If you later want notifications when the tab is closed, add a Cloudflare Worker on a 10-min cron that calls the Telegram Bot API on rising transitions.
