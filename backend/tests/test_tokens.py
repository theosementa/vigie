from app.core.security import hash_token
from tests.conftest import make_client, sql

URL = "https://example.com/post"


async def make_token(c, name="Chrome"):
    r = await c.post("/api/tokens", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def add(token: str, url: str = URL, **body):
    async with make_client() as c:  # no cookie: only the token
        return await c.post(
            "/api/extension/items", json={"url": url, **body}, headers=bearer(token)
        )


async def test_token_is_shown_once_and_stored_hashed(alice):
    created = await make_token(alice)
    assert created["token"].startswith("vgt_") and created["scope"] == "items:add"
    assert created["token"].startswith(created["prefix"])
    rows = await sql("SELECT token_hash, prefix FROM api_tokens")
    assert rows[0].token_hash == hash_token(created["token"])
    assert created["token"] not in str(rows[0])
    listed = (await alice.get("/api/tokens")).json()
    assert [t["id"] for t in listed] == [created["id"]]
    assert "token" not in listed[0] and "token_hash" not in listed[0]


async def test_extension_adds_an_item_like_the_app(alice):
    token = (await make_token(alice))["token"]
    r = await add(token, notes="later", tags=["read"], queue=True)
    assert r.status_code == 201, r.text
    item = r.json()
    assert item["resource"]["url"] == URL and item["notes"] == "later"
    assert [t["name"] for t in item["tags"]] == ["read"] and item["queue_position"] == 0
    assert (await alice.get(f"/api/items/{item['id']}")).status_code == 200
    again = await add(token)
    assert again.status_code == 409
    assert again.json()["detail"]["code"] == "already_in_library"
    assert again.json()["detail"]["item_id"] == item["id"]
    assert (await add(token, url="ftp://example.com/x")).status_code == 422
    used = (await alice.get("/api/tokens")).json()[0]["last_used_at"]
    assert used is not None


async def test_revoked_unknown_and_missing_tokens_get_the_same_401(alice):
    created = await make_token(alice)
    assert (await alice.delete(f"/api/tokens/{created['id']}")).status_code == 204
    revoked = await add(created["token"])
    unknown = await add("vgt_" + "x" * 43)
    async with make_client() as c:
        missing = await c.post("/api/extension/items", json={"url": URL})
        wrong_scheme = await c.post(
            "/api/extension/items", json={"url": URL}, headers={"Authorization": "Basic abc"}
        )
    for r in (revoked, unknown, missing, wrong_scheme):
        assert r.status_code == 401
        assert r.json() == revoked.json()
    assert revoked.json()["detail"]["code"] == "invalid_token"
    assert (await alice.get("/api/items")).json()["items"] == []


async def test_token_does_not_open_the_cookie_routes(alice):
    token = (await make_token(alice))["token"]
    async with make_client() as c:
        for method, path in (
            ("GET", "/api/items"),
            ("POST", "/api/items"),
            ("GET", "/api/auth/me"),
            ("GET", "/api/tokens"),
            ("POST", "/api/tokens"),
        ):
            r = await c.request(method, path, json={"url": URL}, headers=bearer(token))
            assert r.status_code == 401, (method, path)


async def test_a_session_cookie_does_not_open_the_extension_route(alice):
    r = await alice.post("/api/extension/items", json={"url": URL})
    assert r.status_code == 401


async def test_tokens_are_private_to_their_owner(alice, bob):
    created = await make_token(alice)
    assert (await bob.get("/api/tokens")).json() == []
    r = await bob.delete(f"/api/tokens/{created['id']}")
    assert r.status_code == 404
    assert (await add(created["token"])).status_code == 201  # still alive
    # the item landed in alice's library, not bob's
    assert (await bob.get("/api/items")).json()["items"] == []


async def test_limit_and_validation(alice):
    assert (await alice.post("/api/tokens", json={"name": "   "})).status_code == 422
    assert (await alice.post("/api/tokens", json={"name": "x" * 61})).status_code == 422
    for i in range(10):
        await make_token(alice, f"t{i}")
    r = await alice.post("/api/tokens", json={"name": "one more"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "tokens_limit"


async def test_deleting_the_account_removes_its_tokens(alice):
    await make_token(alice)
    r = await alice.request("DELETE", "/api/auth/me", json={"password": "correct horse"})
    assert r.status_code == 204
    assert await sql("SELECT 1 FROM api_tokens") == []


async def test_token_of_a_user_off_the_allow_list_is_refused(alice, monkeypatch):
    token = (await make_token(alice))["token"]
    monkeypatch.setattr("app.core.config.settings.allowed_emails", "someone@else.org")
    assert (await add(token)).status_code == 401


async def test_extension_route_is_rate_limited_per_ip(rate_limits):
    async with make_client() as c:
        codes = [
            (
                await c.post("/api/extension/items", json={"url": URL}, headers=bearer("vgt_x"))
            ).status_code
            for _ in range(125)
        ]
    assert codes[0] == 401 and codes[-1] == 429
