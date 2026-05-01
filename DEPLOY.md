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

Manual redeploy after a code change:

```sh
cd app
npm run build
wrangler pages deploy dist --project-name=banjir-achmadnaufal --branch=main
```

The Pages project is in **Direct Upload** mode (no Git provider connected),
so pushing to `main` does NOT auto-deploy on its own. CI is wired but
parked at `.github/workflows.example/deploy.yml` because the local `gh`
OAuth token lacks the `workflow` scope; once you `gh auth refresh -h
github.com -s workflow` (one interactive command), `git mv` it into
`.github/workflows/deploy.yml` and push to enable auto-deploy.

The workflow needs two repo secrets:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token, **Account → Cloudflare Pages → Edit**. Mint at https://dash.cloudflare.com/profile/api-tokens. |
| `CLOUDFLARE_ACCOUNT_ID` | `3a115fbb6690986310407d37ce9c9c05` |

Set via `gh secret set CLOUDFLARE_API_TOKEN` etc. or the repo Settings UI.

## Optional

- **Web Analytics**: enable in the Pages project settings (free, no code change).
- **Real PNG icons**: drop `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png` into `app/public/` and update `vite.config.ts`'s manifest. The current SVG-only icon works but a maskable PNG looks crisper on Android.
- **Always-on alerts**: out of scope for the current build (browser-only by design). If you later want notifications when the tab is closed, add a Cloudflare Worker on a 10-min cron that calls the Telegram Bot API on rising transitions.
