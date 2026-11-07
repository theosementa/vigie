import time

import jwt

from app.core.config import settings
from tests.conftest import make_client, signup_payload, sql

PW = "correct horse"


async def _login(email: str, password: str = PW):
    c = make_client()
    r = await c.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return c


def _cookie(c) -> str:
    return c.cookies[settings.cookie_name]


async def test_token_carries_sub_and_ver(alice):
    payload = jwt.decode(_cookie(alice), settings.secret_key, algorithms=["HS256"])
    assert payload["sub"] == alice.user["id"] and payload["ver"] == 0


async def test_token_with_other_version_or_no_version_is_rejected(alice):
    def forge(**over):
        claims = {"sub": alice.user["id"], "ver": 0, "exp": time.time() + 600, **over}
        claims = {k: v for k, v in claims.items() if v is not None}
        return jwt.encode(claims, settings.secret_key, algorithm="HS256")

    async with make_client() as c:
        c.cookies.set(settings.cookie_name, forge())
        assert (await c.get("/api/auth/me")).status_code == 200
        c.cookies.set(settings.cookie_name, forge(ver=1))
        r = await c.get("/api/auth/me")
        assert r.status_code == 401 and r.json()["detail"]["code"] == "not_authenticated"
        c.cookies.set(settings.cookie_name, forge(ver=None))
        assert (await c.get("/api/auth/me")).status_code == 401


async def test_password_change_revokes_other_sessions_and_keeps_caller(alice):
    other = await _login("alice@example.com")
    r = await alice.post(
        "/api/auth/password", json={"current_password": PW, "new_password": "brand new pass"}
    )
    assert r.status_code == 204
    assert (await alice.get("/api/auth/me")).status_code == 200  # cookie re-issued
    assert (await other.get("/api/auth/me")).status_code == 401
    assert (await sql("SELECT token_version FROM users"))[0].token_version == 1
    async with make_client() as c:
        old = await c.post("/api/auth/login", json={"email": "alice@example.com", "password": PW})
        assert old.status_code == 401
        new = await c.post(
            "/api/auth/login", json={"email": "alice@example.com", "password": "brand new pass"}
        )
        assert new.status_code == 200
    await other.aclose()


async def test_password_change_rejects_wrong_current_and_short_new(alice):
    r = await alice.post(
        "/api/auth/password", json={"current_password": "nope", "new_password": "brand new pass"}
    )
    assert r.status_code == 403 and r.json()["detail"]["code"] == "wrong_password"
    r = await alice.post(
        "/api/auth/password", json={"current_password": PW, "new_password": "short"}
    )
    assert r.status_code == 422
    assert (await sql("SELECT token_version FROM users"))[0].token_version == 0


async def test_logout_all_revokes_every_session_and_clears_cookie(alice):
    other = await _login("alice@example.com")
    r = await alice.post("/api/auth/logout-all")
    assert r.status_code == 204
    assert settings.cookie_name in r.headers["set-cookie"]
    assert (await alice.get("/api/auth/me")).status_code == 401
    assert (await other.get("/api/auth/me")).status_code == 401
    await other.aclose()
    assert (await _login("alice@example.com")) is not None  # logging in again works


async def test_logout_all_requires_session(client):
    assert (await client.post("/api/auth/logout-all")).status_code == 401


async def test_login_gives_the_same_answer_for_unknown_email_and_wrong_password(alice):
    async with make_client() as c:
        wrong = await c.post(
            "/api/auth/login", json={"email": "alice@example.com", "password": "x"}
        )
        unknown = await c.post(
            "/api/auth/login", json={"email": "ghost@example.com", "password": "x"}
        )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["detail"]["code"] == "invalid_credentials"


async def test_login_verifies_a_dummy_hash_for_unknown_email(client, monkeypatch):
    calls = []
    real = __import__("app.api.routes.auth", fromlist=["verify_password"]).verify_password

    def spy(password, hashed):
        calls.append(hashed)
        return real(password, hashed)

    monkeypatch.setattr("app.api.routes.auth.verify_password", spy)
    r = await client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "x"})
    assert r.status_code == 401
    assert len(calls) == 1 and calls[0].startswith("$argon2")


async def test_cookie_secure_modes(client, monkeypatch):
    payload = signup_payload("a@example.com")
    monkeypatch.setattr("app.core.cookies.settings.cookie_secure", "auto")
    r = await client.post("/api/auth/register", json=payload)
    assert "secure" not in r.headers["set-cookie"].lower()

    async with make_client() as c:  # https as seen through the proxy headers
        c.base_url = "https://test"
        r = await c.post("/api/auth/login", json={"email": "a@example.com", "password": PW})
        assert "; secure" in r.headers["set-cookie"].lower()

    monkeypatch.setattr("app.core.cookies.settings.cookie_secure", "true")
    r = await client.post("/api/auth/login", json={"email": "a@example.com", "password": PW})
    assert "; secure" in r.headers["set-cookie"].lower()
    monkeypatch.setattr("app.core.cookies.settings.cookie_secure", "false")
    async with make_client() as c:
        c.base_url = "https://test"
        r = await c.post("/api/auth/login", json={"email": "a@example.com", "password": PW})
        assert "; secure" not in r.headers["set-cookie"].lower()


async def test_cookie_is_named_vigie_session(alice):
    assert "vigie_session" in alice.cookies.keys() or settings.cookie_name == "vigie_session"
    assert settings.cookie_name == "vigie_session"
