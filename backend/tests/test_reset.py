import asyncio
import hashlib
import os
import subprocess
import sys

from tests.conftest import TEST_DATABASE_URL, TEST_SECRET_KEY, make_client, sql

BACKEND = os.path.join(os.path.dirname(__file__), "..")


def _cli(*args: str, public_url: str | None = "https://vigie.example.org"):
    env = {**os.environ, "DATABASE_URL": TEST_DATABASE_URL, "SECRET_KEY": TEST_SECRET_KEY}
    env.pop("PUBLIC_URL", None)
    if public_url:
        env["PUBLIC_URL"] = public_url
    return subprocess.run(
        [sys.executable, "-m", "app.cli", *args],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
    )


async def test_cli_prints_a_working_link_and_stores_only_a_hash(alice):
    out = await asyncio.to_thread(_cli, "reset-password", "Alice@example.com")
    assert out.returncode == 0, out.stderr
    url = out.stdout.strip()
    assert url.startswith("https://vigie.example.org/reset-password?token=")
    token = url.split("token=")[1]

    rows = await sql("SELECT token_hash, expires_at, used_at FROM password_resets")
    assert len(rows) == 1 and rows[0].used_at is None
    assert rows[0].token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token not in rows[0].token_hash

    async with make_client() as c:
        r = await c.post("/api/auth/reset", json={"token": token, "password": "cli reset pass"})
        assert r.status_code == 204
        login = await c.post(
            "/api/auth/login", json={"email": "alice@example.com", "password": "cli reset pass"}
        )
        assert login.status_code == 200


async def test_cli_unknown_email_fails(alice):
    out = await asyncio.to_thread(_cli, "reset-password", "ghost@example.com")
    assert out.returncode == 1 and out.stdout == ""


async def test_reset_token_expires_after_an_hour(alice):
    out = await asyncio.to_thread(_cli, "reset-password", "alice@example.com")
    token = out.stdout.strip().split("token=")[1]
    rows = await sql("SELECT expires_at - now() AS ttl FROM password_resets")
    assert 3500 < rows[0].ttl.total_seconds() <= 3600

    await sql("UPDATE password_resets SET expires_at = now() - interval '1 second'")
    async with make_client() as c:
        r = await c.post("/api/auth/reset", json={"token": token, "password": "too late pass"})
        assert r.status_code == 400 and r.json()["detail"]["code"] == "invalid_reset_token"
    assert (await sql("SELECT token_version FROM users"))[0].token_version == 0


async def test_reset_with_unknown_token_and_short_password(alice):
    async with make_client() as c:
        r = await c.post("/api/auth/reset", json={"token": "nope", "password": "long enough pw"})
        assert r.status_code == 400 and r.json()["detail"]["code"] == "invalid_reset_token"
        r = await c.post("/api/auth/reset", json={"token": "nope", "password": "short"})
        assert r.status_code == 422


async def test_new_link_voids_the_previous_one(alice):
    first = (await asyncio.to_thread(_cli, "reset-password", "alice@example.com")).stdout
    second = (await asyncio.to_thread(_cli, "reset-password", "alice@example.com")).stdout
    async with make_client() as c:
        old = await c.post(
            "/api/auth/reset",
            json={"token": first.strip().split("token=")[1], "password": "password one"},
        )
        assert old.status_code == 400
        new = await c.post(
            "/api/auth/reset",
            json={"token": second.strip().split("token=")[1], "password": "password two"},
        )
        assert new.status_code == 204


async def test_vigie_console_script_is_declared():
    import tomllib

    with open(os.path.join(BACKEND, "pyproject.toml"), "rb") as f:
        assert tomllib.load(f)["project"]["scripts"]["vigie"] == "app.cli:main"
