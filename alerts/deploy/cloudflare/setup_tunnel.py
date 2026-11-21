"""Sets up the Cloudflare side of the banjir alerts service: a tunnel, its route
and the DNS record for banjir-api.achmadnaufal.com — and writes the service's
secrets to the VPS.

    python3.12 alerts/deploy/cloudflare/setup_tunnel.py --verify-only
    python3.12 alerts/deploy/cloudflare/setup_tunnel.py

Reads the Cloudflare API token from ~/.config/mykid/cf_token (the owner chose to
reuse mykid's). VAPID keys and the owner token are created once in
~/.config/banjir-alerts/ (mode 600) and reused on every run: new VAPID keys
would silently cut off every subscribed phone. Secrets go to the VPS over ssh
stdin; nothing secret is printed. Safe to run again. Modelled on mykid's script.
"""

from __future__ import annotations

import argparse
import json
import logging
import secrets
import stat
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Mapping, Protocol

API_BASE = "https://api.cloudflare.com/client/v4"
ZONE_NAME = "achmadnaufal.com"
HOSTNAME = "banjir-api.achmadnaufal.com"
TUNNEL_NAME = "banjir-alerts"
SERVICE = "http://app:8080"
VPS = "root@45.77.33.192"
ENV_PATH = "/opt/banjir-alerts/deploy/.env"
DEFAULT_TOKEN_FILE = Path.home() / ".config" / "mykid" / "cf_token"
DEFAULT_SECRETS_DIR = Path.home() / ".config" / "banjir-alerts"
ALERTS_DIR = Path(__file__).resolve().parents[2]

log = logging.getLogger("setup_tunnel")


class CfError(Exception):
    """A Cloudflare API call failed, or the account isn't in the expected state."""


class Api(Protocol):
    def request(self, method: str, path: str, body: Any = None) -> Any: ...


class CfApi:
    """Minimal Cloudflare API v4 client (stdlib only)."""

    def __init__(self, token: str, base: str = API_BASE) -> None:
        self._token = token
        self._base = base

    def request(self, method: str, path: str, body: Any = None) -> Any:
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            f"{self._base}{path}",
            data=data,
            method=method,
            headers={"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            payload = _json_or_empty(err.read())
            raise CfError(f"{method} {path} failed ({err.code}): {_messages(payload)}") from None
        except urllib.error.URLError as err:
            raise CfError(f"{method} {path} could not reach Cloudflare: {err.reason}") from None
        if not payload.get("success", False):
            raise CfError(f"{method} {path} failed: {_messages(payload)}")
        return payload.get("result")


def _json_or_empty(raw: bytes) -> dict[str, Any]:
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return {}


def _messages(payload: dict[str, Any]) -> str:
    errors = payload.get("errors") or []
    return "; ".join(str(e.get("message", e)) for e in errors) or "no details"


def verify_token(api: Api) -> None:
    result = api.request("GET", "/user/tokens/verify")
    if (result or {}).get("status") != "active":
        raise CfError("The API token is not active.")


def find_zone(api: Api, name: str) -> dict[str, str]:
    zones = api.request("GET", f"/zones?name={name}") or []
    if not zones:
        raise CfError(f"No zone {name} is visible to this token.")
    return {"zone_id": zones[0]["id"], "account_id": zones[0]["account"]["id"]}


def ensure_tunnel(api: Api, account_id: str, name: str = TUNNEL_NAME) -> str:
    existing = api.request("GET", f"/accounts/{account_id}/cfd_tunnel?name={name}&is_deleted=false") or []
    if existing:
        return existing[0]["id"]
    created = api.request("POST", f"/accounts/{account_id}/cfd_tunnel", {"name": name, "config_src": "cloudflare"})
    return created["id"]


def put_ingress(api: Api, account_id: str, tunnel_id: str, hostname: str, service: str = SERVICE) -> None:
    config = {"ingress": [{"hostname": hostname, "service": service}, {"service": "http_status:404"}]}
    api.request("PUT", f"/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations", {"config": config})


def ensure_cname(api: Api, zone_id: str, hostname: str, target: str) -> None:
    records = api.request("GET", f"/zones/{zone_id}/dns_records?name={hostname}") or []
    if not records:
        api.request(
            "POST",
            f"/zones/{zone_id}/dns_records",
            {"type": "CNAME", "name": hostname, "content": target, "proxied": True},
        )
        return
    record = records[0]
    if record["type"] != "CNAME":
        raise CfError(f"{hostname} already has an {record['type']} record; not replacing it.")
    if record["content"] != target or not record.get("proxied"):
        api.request("PATCH", f"/zones/{zone_id}/dns_records/{record['id']}", {"content": target, "proxied": True})


def tunnel_token(api: Api, account_id: str, tunnel_id: str) -> str:
    return str(api.request("GET", f"/accounts/{account_id}/cfd_tunnel/{tunnel_id}/token"))


def write_env(values: Mapping[str, str], host: str) -> None:
    """Writes the server's .env on the VPS through ssh stdin (never on a command line)."""
    for key, value in values.items():
        if "\n" in value or "\n" in key:
            raise ValueError(f"{key} must be a single line")
    body = "".join(f"{key}={value}\n" for key, value in values.items())
    script = f"umask 077; mkdir -p {Path(ENV_PATH).parent} && cat > {ENV_PATH}"
    subprocess.run(["ssh", host, script], input=body, text=True, check=True)


def _require_private(path: Path, hint: str) -> None:
    if path.stat().st_mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise PermissionError(f"{path.name} is readable by others. Run: chmod 600 {hint}")


def read_token(path: Path) -> str:
    _require_private(path, "~/.config/mykid/cf_token")
    token = path.read_text(encoding="utf-8").strip()
    if not token:
        raise ValueError(f"{path} is empty.")
    return token


def generate_vapid_keys() -> dict[str, str]:
    """A fresh VAPID key pair from the web-push library the service itself uses."""
    script = "process.stdout.write(JSON.stringify(require('web-push').generateVAPIDKeys()))"
    out = subprocess.run(["node", "-e", script], cwd=ALERTS_DIR, capture_output=True, text=True, check=True)
    keys = json.loads(out.stdout)
    return {"publicKey": keys["publicKey"], "privateKey": keys["privateKey"]}


def _write_private(path: Path, value: str) -> None:
    path.touch(mode=0o600, exist_ok=True)
    path.chmod(0o600)
    path.write_text(value + "\n", encoding="utf-8")


def load_or_create_secrets(directory: Path) -> dict[str, str]:
    """VAPID keys and the owner token, created on the first run and reused after."""
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    vapid_file = directory / "vapid.json"
    owner_file = directory / "owner_token"
    if not vapid_file.exists():
        _write_private(vapid_file, json.dumps(generate_vapid_keys()))
    if not owner_file.exists():
        _write_private(owner_file, secrets.token_hex(24))
    for f in (vapid_file, owner_file):
        _require_private(f, f"~/.config/banjir-alerts/{f.name}")
    vapid = json.loads(vapid_file.read_text(encoding="utf-8"))
    return {
        "VAPID_PUBLIC_KEY": vapid["publicKey"],
        "VAPID_PRIVATE_KEY": vapid["privateKey"],
        "OWNER_TOKEN": owner_file.read_text(encoding="utf-8").strip(),
    }


def main(argv: list[str]) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--verify-only", action="store_true", help="only check that the API token works")
    parser.add_argument("--token-file", type=Path, default=DEFAULT_TOKEN_FILE)
    parser.add_argument("--secrets-dir", type=Path, default=DEFAULT_SECRETS_DIR)
    args = parser.parse_args(argv)

    try:
        api = CfApi(read_token(args.token_file))
        verify_token(api)
        log.info("Token active")
        if args.verify_only:
            return 0
        ids = find_zone(api, ZONE_NAME)
        tunnel_id = ensure_tunnel(api, ids["account_id"])
        log.info("Tunnel %s: %s", TUNNEL_NAME, tunnel_id)
        put_ingress(api, ids["account_id"], tunnel_id, HOSTNAME)
        log.info("Ingress set for %s", HOSTNAME)
        target = f"{tunnel_id}.cfargotunnel.com"
        ensure_cname(api, ids["zone_id"], HOSTNAME, target)
        log.info("DNS CNAME %s → %s (proxied)", HOSTNAME, target)
        values = {"TUNNEL_TOKEN": tunnel_token(api, ids["account_id"], tunnel_id), **load_or_create_secrets(args.secrets_dir)}
        write_env(values, VPS)
        log.info("Env written to the VPS (%s): %s", ENV_PATH, ", ".join(values))
        return 0
    except PermissionError as err:
        log.error("%s", err)
        return 2
    except (CfError, OSError, ValueError, KeyError, subprocess.CalledProcessError) as err:
        log.error("Setup stopped: %s", err)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
