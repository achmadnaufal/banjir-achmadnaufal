import logging
from pathlib import Path

import pytest

import setup_tunnel as st

ACCOUNT = "acc1"
ZONE = "zone1"
HOST = "banjir-api.achmadnaufal.com"


class FakeApi:
    """Records calls and answers from a table of (method, path) → result."""

    def __init__(self, answers: dict[tuple[str, str], object]) -> None:
        self.answers = answers
        self.calls: list[tuple[str, str, object]] = []

    def request(self, method: str, path: str, body: object = None) -> object:
        self.calls.append((method, path, body))
        key = (method, path)
        if key not in self.answers:
            raise AssertionError(f"unexpected call {method} {path}")
        return self.answers[key]


def test_find_zone_returns_zone_and_account():
    api = FakeApi({("GET", "/zones?name=achmadnaufal.com"): [{"id": ZONE, "account": {"id": ACCOUNT}}]})
    assert st.find_zone(api, "achmadnaufal.com") == {"zone_id": ZONE, "account_id": ACCOUNT}


def test_find_zone_missing_is_an_error():
    api = FakeApi({("GET", "/zones?name=achmadnaufal.com"): []})
    with pytest.raises(st.CfError, match="achmadnaufal.com"):
        st.find_zone(api, "achmadnaufal.com")


def test_ensure_tunnel_reuses_an_existing_one():
    path = f"/accounts/{ACCOUNT}/cfd_tunnel?name=banjir-alerts&is_deleted=false"
    api = FakeApi({("GET", path): [{"id": "t-old", "name": "banjir-alerts"}]})
    assert st.ensure_tunnel(api, ACCOUNT) == "t-old"
    assert [c[0] for c in api.calls] == ["GET"]


def test_ensure_tunnel_creates_a_remotely_managed_one():
    api = FakeApi(
        {
            ("GET", f"/accounts/{ACCOUNT}/cfd_tunnel?name=banjir-alerts&is_deleted=false"): [],
            ("POST", f"/accounts/{ACCOUNT}/cfd_tunnel"): {"id": "t-new"},
        }
    )
    assert st.ensure_tunnel(api, ACCOUNT) == "t-new"
    assert api.calls[-1][2] == {"name": "banjir-alerts", "config_src": "cloudflare"}


def test_put_ingress_routes_the_host_to_the_app_and_404s_the_rest():
    path = f"/accounts/{ACCOUNT}/cfd_tunnel/t1/configurations"
    api = FakeApi({("PUT", path): {}})
    st.put_ingress(api, ACCOUNT, "t1", HOST)
    assert api.calls[0][2] == {
        "config": {"ingress": [{"hostname": HOST, "service": "http://app:8080"}, {"service": "http_status:404"}]}
    }


@pytest.fixture
def dns_path() -> str:
    return f"/zones/{ZONE}/dns_records?name={HOST}"


def test_ensure_cname_creates(dns_path):
    api = FakeApi({("GET", dns_path): [], ("POST", f"/zones/{ZONE}/dns_records"): {"id": "r1"}})
    st.ensure_cname(api, ZONE, HOST, "t1.cfargotunnel.com")
    assert api.calls[-1][2] == {"type": "CNAME", "name": HOST, "content": "t1.cfargotunnel.com", "proxied": True}


def test_ensure_cname_updates_a_stale_target(dns_path):
    existing = [{"id": "r1", "type": "CNAME", "content": "old.cfargotunnel.com", "proxied": True}]
    api = FakeApi({("GET", dns_path): existing, ("PATCH", f"/zones/{ZONE}/dns_records/r1"): {}})
    st.ensure_cname(api, ZONE, HOST, "t1.cfargotunnel.com")
    assert api.calls[-1] == (
        "PATCH",
        f"/zones/{ZONE}/dns_records/r1",
        {"content": "t1.cfargotunnel.com", "proxied": True},
    )


def test_ensure_cname_leaves_a_correct_record_alone(dns_path):
    existing = [{"id": "r1", "type": "CNAME", "content": "t1.cfargotunnel.com", "proxied": True}]
    api = FakeApi({("GET", dns_path): existing})
    st.ensure_cname(api, ZONE, HOST, "t1.cfargotunnel.com")
    assert len(api.calls) == 1


def test_ensure_cname_refuses_to_replace_another_kind_of_record(dns_path):
    api = FakeApi({("GET", dns_path): [{"id": "r1", "type": "A", "content": "1.2.3.4", "proxied": True}]})
    with pytest.raises(st.CfError, match="A record"):
        st.ensure_cname(api, ZONE, HOST, "t1.cfargotunnel.com")


def _token_file(tmp_path: Path, mode: int) -> Path:
    path = tmp_path / "cf_token"
    path.write_text("SECRET-TOKEN-VALUE\n")
    path.chmod(mode)
    return path


def test_verify_only_never_shows_the_token(tmp_path, monkeypatch, capsys, caplog):
    caplog.set_level(logging.INFO)
    token_file = _token_file(tmp_path, 0o600)
    seen = {}

    def fake_api(token: str) -> FakeApi:
        seen["token"] = token
        return FakeApi({("GET", "/user/tokens/verify"): {"status": "active"}})

    monkeypatch.setattr(st, "CfApi", fake_api)
    assert st.main(["--verify-only", "--token-file", str(token_file)]) == 0
    out = capsys.readouterr().out + caplog.text
    assert "Token active" in out
    assert "SECRET-TOKEN-VALUE" not in out
    assert seen["token"] == "SECRET-TOKEN-VALUE"


def test_a_readable_token_file_is_refused(tmp_path, capsys, caplog):
    token_file = _token_file(tmp_path, 0o644)
    assert st.main(["--verify-only", "--token-file", str(token_file)]) == 2
    assert "chmod 600 ~/.config/mykid/cf_token" in capsys.readouterr().out + caplog.text


def test_write_env_sends_values_over_stdin(monkeypatch):
    calls = []
    monkeypatch.setattr(st.subprocess, "run", lambda args, **kw: calls.append((args, kw)))
    st.write_env({"TUNNEL_TOKEN": "T", "OWNER_TOKEN": "a=b"}, "root@host")
    args, kw = calls[0]
    assert kw["input"] == "TUNNEL_TOKEN=T\nOWNER_TOKEN=a=b\n"
    assert "umask 077" in args[2]
    with pytest.raises(ValueError):
        st.write_env({"BAD": "line\nbreak"}, "root@host")


class _Resp:
    def __init__(self, payload: dict) -> None:
        self._raw = __import__("json").dumps(payload).encode()

    def read(self) -> bytes:
        return self._raw

    def __enter__(self) -> "_Resp":
        return self

    def __exit__(self, *exc: object) -> None:
        return None


def test_cfapi_returns_result_and_sends_bearer(monkeypatch):
    seen = {}

    def fake_urlopen(req, timeout):
        seen["auth"] = req.headers["Authorization"]
        seen["url"] = req.full_url
        return _Resp({"success": True, "result": {"ok": 1}})

    monkeypatch.setattr(st.urllib.request, "urlopen", fake_urlopen)
    assert st.CfApi("tok").request("GET", "/x") == {"ok": 1}
    assert seen == {"auth": "Bearer tok", "url": "https://api.cloudflare.com/client/v4/x"}


def test_cfapi_raises_on_unsuccessful_payload(monkeypatch):
    monkeypatch.setattr(
        st.urllib.request,
        "urlopen",
        lambda req, timeout: _Resp({"success": False, "errors": [{"message": "bad zone"}]}),
    )
    with pytest.raises(st.CfError, match="bad zone"):
        st.CfApi("tok").request("GET", "/x")


def test_cfapi_raises_on_http_error_without_leaking_the_token(monkeypatch):
    import io

    def fake_urlopen(req, timeout):
        body = io.BytesIO(b'{"errors":[{"message":"Authentication error"}]}')
        raise st.urllib.error.HTTPError(req.full_url, 403, "Forbidden", {}, body)

    monkeypatch.setattr(st.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(st.CfError) as err:
        st.CfApi("SECRET").request("GET", "/x")
    assert "403" in str(err.value) and "Authentication error" in str(err.value)
    assert "SECRET" not in str(err.value)


def test_write_env_never_puts_values_on_the_command_line(monkeypatch):
    calls = []
    monkeypatch.setattr(st.subprocess, "run", lambda args, **kw: calls.append((args, kw)))
    st.write_env({"TUNNEL_TOKEN": "TUNNEL-SECRET"}, "root@host")
    args, kw = calls[0]
    assert args[:2] == ["ssh", "root@host"]
    assert "TUNNEL-SECRET" not in " ".join(args)


def test_setup_stops_cleanly_when_cloudflare_refuses(tmp_path, monkeypatch, caplog):
    token_file = _token_file(tmp_path, 0o600)

    class Refusing:
        def request(self, method, path, body=None):
            raise st.CfError("GET /user/tokens/verify failed (401): Invalid API Token")

    monkeypatch.setattr(st, "CfApi", lambda token: Refusing())
    assert st.main(["--token-file", str(token_file)]) == 1
    assert "Invalid API Token" in caplog.text




def _fake_vapid(calls: list | None = None):
    def generate() -> dict[str, str]:
        if calls is not None:
            calls.append(1)
        return {"publicKey": "BPUB", "privateKey": "PRIV-SECRET"}

    return generate


def test_secrets_are_created_once_private_and_reused(tmp_path, monkeypatch):
    calls: list = []
    monkeypatch.setattr(st, "generate_vapid_keys", _fake_vapid(calls))
    first = st.load_or_create_secrets(tmp_path / "secrets")
    second = st.load_or_create_secrets(tmp_path / "secrets")
    assert first == second
    assert calls == [1]  # regenerating VAPID keys would orphan every subscribed phone
    assert first["VAPID_PUBLIC_KEY"] == "BPUB"
    assert first["VAPID_PRIVATE_KEY"] == "PRIV-SECRET"
    assert len(first["OWNER_TOKEN"]) == 48
    for f in (tmp_path / "secrets").iterdir():
        assert f.stat().st_mode & 0o077 == 0


def test_readable_secrets_are_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(st, "generate_vapid_keys", _fake_vapid())
    st.load_or_create_secrets(tmp_path / "secrets")
    (tmp_path / "secrets" / "owner_token").chmod(0o644)
    with pytest.raises(PermissionError):
        st.load_or_create_secrets(tmp_path / "secrets")


def test_full_run_sends_every_secret_only_to_the_vps(tmp_path, monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    token_file = _token_file(tmp_path, 0o600)
    answers = {
        ("GET", "/user/tokens/verify"): {"status": "active"},
        ("GET", "/zones?name=achmadnaufal.com"): [{"id": ZONE, "account": {"id": ACCOUNT}}],
        ("GET", f"/accounts/{ACCOUNT}/cfd_tunnel?name=banjir-alerts&is_deleted=false"): [{"id": "t1"}],
        ("PUT", f"/accounts/{ACCOUNT}/cfd_tunnel/t1/configurations"): {},
        ("GET", f"/zones/{ZONE}/dns_records?name={HOST}"): [],
        ("POST", f"/zones/{ZONE}/dns_records"): {"id": "r1"},
        ("GET", f"/accounts/{ACCOUNT}/cfd_tunnel/t1/token"): "TUNNEL-SECRET",
    }
    api = FakeApi(answers)
    monkeypatch.setattr(st, "CfApi", lambda token: api)
    monkeypatch.setattr(st, "generate_vapid_keys", _fake_vapid())
    sent = []
    monkeypatch.setattr(st, "write_env", lambda values, host: sent.append((dict(values), host)))
    secrets_dir = tmp_path / "secrets"
    assert st.main(["--token-file", str(token_file), "--secrets-dir", str(secrets_dir)]) == 0

    owner = (secrets_dir / "owner_token").read_text().strip()
    assert sent == [
        (
            {
                "TUNNEL_TOKEN": "TUNNEL-SECRET",
                "VAPID_PUBLIC_KEY": "BPUB",
                "VAPID_PRIVATE_KEY": "PRIV-SECRET",
                "OWNER_TOKEN": owner,
            },
            "root@45.77.33.192",
        )
    ]
    ingress = next(body for (m, p, body) in api.calls if m == "PUT")
    assert ingress["config"]["ingress"][0] == {"hostname": HOST, "service": "http://app:8080"}
    assert not any("access" in p for (_, p, _) in api.calls)  # the API is public: no Access app
    for secret in ("TUNNEL-SECRET", "SECRET-TOKEN-VALUE", "PRIV-SECRET", owner):
        assert secret not in caplog.text
