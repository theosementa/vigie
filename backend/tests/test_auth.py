async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


async def test_me_requires_session(client):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


async def test_register_sets_cookie_and_me_works(client):
    r = await client.post(
        "/api/auth/register",
        json={"email": "Alice@Example.com", "password": "supersecret", "display_name": "Alice"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "alice@example.com"
    assert body["display_name"] == "Alice"
    assert "password" not in body and "password_hash" not in body
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert "secure" not in cookie.replace("secure=false", "")

    me = await client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["id"] == body["id"]


async def test_register_default_display_name(client):
    r = await client.post(
        "/api/auth/register", json={"email": "zoe@example.com", "password": "supersecret"}
    )
    assert r.json()["display_name"] == "zoe"


async def test_register_duplicate_and_validation(client):
    payload = {"email": "a@example.com", "password": "supersecret"}
    assert (await client.post("/api/auth/register", json=payload)).status_code == 201
    dup = {"email": "A@example.com", "password": "supersecret"}
    assert (await client.post("/api/auth/register", json=dup)).status_code == 409
    short = {"email": "b@example.com", "password": "short"}
    assert (await client.post("/api/auth/register", json=short)).status_code == 422
    bad = {"email": "not-an-email", "password": "supersecret"}
    assert (await client.post("/api/auth/register", json=bad)).status_code == 422


async def test_login_logout(client):
    await client.post(
        "/api/auth/register", json={"email": "a@example.com", "password": "supersecret"}
    )
    await client.post("/api/auth/logout")
    assert (await client.get("/api/auth/me")).status_code == 401

    bad = await client.post(
        "/api/auth/login", json={"email": "a@example.com", "password": "wrongpass"}
    )
    assert bad.status_code == 401
    unknown = await client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "supersecret"}
    )
    assert unknown.status_code == 401
    assert unknown.json() == bad.json()

    ok = await client.post(
        "/api/auth/login", json={"email": "A@example.com", "password": "supersecret"}
    )
    assert ok.status_code == 200
    assert (await client.get("/api/auth/me")).status_code == 200

    out = await client.post("/api/auth/logout")
    assert out.status_code == 204
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_invalid_token_is_401(client):
    client.cookies.set("radar_session", "garbage")
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_routes_require_auth(client):
    for method, path in [
        ("GET", "/api/items"),
        ("POST", "/api/items"),
        ("GET", "/api/tags"),
        ("POST", "/api/resources/preview"),
    ]:
        r = await client.request(method, path, json={"url": "https://example.com"})
        assert r.status_code == 401, path
