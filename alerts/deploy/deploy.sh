#!/usr/bin/env bash
# Deploys the banjir alerts service to the VPS. Safe to run again: it only
# touches /opt/banjir-alerts and the "banjir-alerts" compose project, and
# refuses to run unless RustDesk, WireGuard and mykid are up (and re-checks them).
set -euo pipefail

HOST="${BANJIR_ALERTS_HOST:-root@45.77.33.192}"
DEST=/opt/banjir-alerts
URL="${BANJIR_ALERTS_URL:-https://banjir-api.achmadnaufal.com}"
NEIGHBOURS=(hbbs hbbr wg-easy mykid-app-1 mykid-cloudflared-1)

cd "$(dirname "$0")/.."

neighbours_up() {
  local status
  status="$(ssh "$HOST" "docker ps --format '{{.Names}} {{.Status}}'")"
  for name in "${NEIGHBOURS[@]}"; do
    if ! grep -qE "^${name} Up" <<<"$status"; then
      echo "✗ ${name} is not running on the VPS. Not deploying." >&2
      return 1
    fi
  done
  echo "✓ RustDesk, WireGuard and mykid are running"
}

echo "1/7 Checking the other services on the VPS"
neighbours_up

echo "2/7 Running tests"
npm test >/dev/null
npx tsc --noEmit
python3.12 -m pytest -q deploy/cloudflare >/dev/null
echo "✓ tests pass"

echo "3/7 Building"
npm run build >/dev/null
echo "✓ dist/main.cjs"

echo "4/7 Copying files"
ssh "$HOST" "mkdir -p $DEST"
rsync -az --delete --exclude 'deploy/.env' --exclude '__pycache__' --exclude '.DS_Store' --exclude '.pytest_cache' \
  dist Dockerfile .dockerignore deploy "$HOST:$DEST/"

echo "5/7 Building and starting"
ssh "$HOST" "cd $DEST/deploy && test -f .env && docker compose up -d --build --remove-orphans"

echo "6/7 Checking containers"
neighbours_up
health=""
for _ in $(seq 1 30); do
  health="$(ssh "$HOST" "docker inspect -f '{{.State.Health.Status}}' banjir-alerts-app-1" || true)"
  [ "$health" = "healthy" ] && break
  sleep 3
done
[ "$health" = "healthy" ] || { echo "✗ app container is ${health:-missing}" >&2; exit 1; }
ssh "$HOST" "docker ps --format '{{.Names}} {{.Status}}' | grep -E '^banjir-alerts-cloudflared-1 Up'" >/dev/null \
  || { echo "✗ cloudflared is not running" >&2; exit 1; }
echo "✓ app healthy, tunnel running"

echo "7/7 Checking $URL"
for _ in $(seq 1 20); do
  if curl -fsS --max-time 5 "$URL/healthz" 2>/dev/null | grep -q '"ok":true'; then
    echo "✓ live: $URL"
    exit 0
  fi
  sleep 3
done
echo "✗ $URL/healthz did not answer" >&2
exit 1
