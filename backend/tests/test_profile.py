from tests.conftest import make_client


async def test_register_defaults_to_utc(client):
    r = await client.post(
        "/api/auth/register", json={"email": "a@example.com", "password": "correct horse"}
    )
    assert r.status_code == 201
    assert r.json()["timezone"] == "UTC"


async def test_register_with_timezone(client):
    r = await client.post(
        "/api/auth/register",
        json={"email": "a@example.com", "password": "correct horse", "timezone": "Europe/Paris"},
    )
    assert r.status_code == 201
    assert r.json()["timezone"] == "Europe/Paris"
    assert (await client.get("/api/auth/me")).json()["timezone"] == "Europe/Paris"


async def test_register_with_invalid_timezone(client):
    for tz in ("Mars/Olympus", "../etc/passwd", "paris"):
        r = await client.post(
            "/api/auth/register",
            json={"email": "a@example.com", "password": "correct horse", "timezone": tz},
        )
        assert r.status_code == 422, tz
    # nothing was created
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_patch_me(alice):
    r = await alice.patch(
        "/api/auth/me", json={"display_name": "  Alicia ", "timezone": "America/New_York"}
    )
    assert r.status_code == 200
    assert r.json()["display_name"] == "Alicia"
    assert r.json()["timezone"] == "America/New_York"
    assert (await alice.get("/api/auth/me")).json()["timezone"] == "America/New_York"


async def test_patch_me_partial(alice):
    r = await alice.patch("/api/auth/me", json={"timezone": "Asia/Tokyo"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Alice"
    assert r.json()["timezone"] == "Asia/Tokyo"

    r = await alice.patch("/api/auth/me", json={"display_name": "Al"})
    assert r.json()["display_name"] == "Al"
    assert r.json()["timezone"] == "Asia/Tokyo"

    r = await alice.patch("/api/auth/me", json={})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Al"


async def test_patch_me_invalid(alice):
    assert (await alice.patch("/api/auth/me", json={"timezone": "Nope/Nowhere"})).status_code == 422
    assert (await alice.patch("/api/auth/me", json={"timezone": ""})).status_code == 422
    assert (await alice.patch("/api/auth/me", json={"display_name": "  "})).status_code == 422
    me = (await alice.get("/api/auth/me")).json()
    assert me["timezone"] == "UTC" and me["display_name"] == "Alice"


async def test_patch_me_requires_session():
    async with make_client() as c:
        assert (await c.patch("/api/auth/me", json={"timezone": "UTC"})).status_code == 401
