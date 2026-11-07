import uuid

from tests.conftest import make_client, set_mode, sql

ADMIN_ROUTES = [
    ("GET", "/api/admin/settings", None),
    ("PATCH", "/api/admin/settings", {"registration_mode": "open"}),
    ("GET", "/api/admin/invitations", None),
    ("POST", "/api/admin/invitations", {"email": "x@example.com"}),
    ("DELETE", f"/api/admin/invitations/{uuid.uuid4()}", None),
    ("GET", "/api/admin/users", None),
    ("DELETE", f"/api/admin/users/{uuid.uuid4()}", None),
    ("POST", f"/api/admin/users/{uuid.uuid4()}/reset-link", None),
]


async def test_non_admin_gets_404_on_every_admin_route(alice, bob):
    for method, path, body in ADMIN_ROUTES:
        r = await bob.request(method, path, json=body)
        assert r.status_code == 404, (method, path)
        assert r.json()["detail"]["code"] == "not_found"
    assert (await alice.get("/api/admin/settings")).status_code == 200


async def test_anonymous_gets_401(client):
    for method, path, body in ADMIN_ROUTES:
        assert (await client.request(method, path, json=body)).status_code == 401


async def test_settings_get_and_patch(alice):
    await set_mode("invite")
    got = (await alice.get("/api/admin/settings")).json()
    assert got["registration_mode"] == "invite" and got["updated_by"] is None
    r = await alice.patch("/api/admin/settings", json={"registration_mode": "closed"})
    assert r.status_code == 200
    assert r.json()["registration_mode"] == "closed"
    assert r.json()["updated_by"] == alice.user["id"]
    assert (await alice.get("/api/admin/settings")).json()["registration_mode"] == "closed"
    bad = await alice.patch("/api/admin/settings", json={"registration_mode": "wide-open"})
    assert bad.status_code == 422


async def test_invitations_are_idempotent_and_deletable(alice):
    first = await alice.post("/api/admin/invitations", json={"email": "Eve@Example.com"})
    assert first.status_code == 201 and first.json()["email"] == "eve@example.com"
    again = await alice.post("/api/admin/invitations", json={"email": "eve@example.com"})
    assert again.status_code == 200 and again.json()["id"] == first.json()["id"]
    assert (await alice.post("/api/admin/invitations", json={"email": "nope"})).status_code == 422

    listing = (await alice.get("/api/admin/invitations")).json()
    assert [i["email"] for i in listing] == ["eve@example.com"]
    assert listing[0]["created_by"] == alice.user["id"] and listing[0]["used_at"] is None

    assert (await alice.delete(f"/api/admin/invitations/{first.json()['id']}")).status_code == 204
    assert (await alice.get("/api/admin/invitations")).json() == []
    missing = await alice.delete(f"/api/admin/invitations/{first.json()['id']}")
    assert missing.status_code == 404 and missing.json()["detail"]["code"] == "invitation_not_found"


async def test_users_list_has_counts_and_no_library_content(alice, bob):
    await bob.post("/api/items", json={"url": "https://example.com/secret-b"})
    await bob.post("/api/items", json={"url": "https://example.com/secret-c"})
    r = await alice.get("/api/admin/users")
    assert r.status_code == 200
    users = {u["email"]: u for u in r.json()}
    assert set(users["bob@example.com"]) == {
        "id",
        "first_name",
        "last_name",
        "email",
        "role",
        "created_at",
        "item_count",
    }
    assert (
        users["bob@example.com"]["item_count"] == 2 and users["bob@example.com"]["role"] == "user"
    )
    assert (
        users["alice@example.com"]["item_count"] == 0
        and users["alice@example.com"]["role"] == "admin"
    )
    assert "secret" not in r.text


async def test_admin_deletes_a_user(alice, bob):
    await bob.post("/api/items", json={"url": "https://example.com/b"})
    r = await alice.delete(f"/api/admin/users/{bob.user['id']}")
    assert r.status_code == 204
    assert await sql("SELECT 1 FROM users WHERE email = 'bob@example.com'") == []
    assert await sql("SELECT 1 FROM items") == []
    assert (await bob.get("/api/auth/me")).status_code == 401
    gone = await alice.delete(f"/api/admin/users/{bob.user['id']}")
    assert gone.status_code == 404 and gone.json()["detail"]["code"] == "user_not_found"


async def test_admin_cannot_delete_self_here(alice):
    r = await alice.delete(f"/api/admin/users/{alice.user['id']}")
    assert r.status_code == 400 and r.json()["detail"]["code"] == "cannot_delete_self"


async def test_reset_link_works_once(alice, bob, monkeypatch):
    monkeypatch.setattr("app.services.accounts.settings.public_url", "https://vigie.example.org/")
    r = await alice.post(f"/api/admin/users/{bob.user['id']}/reset-link")
    assert r.status_code == 200
    url = r.json()["url"]
    assert url.startswith("https://vigie.example.org/reset-password?token=")
    token = url.split("token=")[1]

    async with make_client() as c:
        ok = await c.post("/api/auth/reset", json={"token": token, "password": "a fresh secret"})
        assert ok.status_code == 204
        again = await c.post("/api/auth/reset", json={"token": token, "password": "another one!"})
        assert again.status_code == 400
        assert again.json()["detail"]["code"] == "invalid_reset_token"
        login = await c.post(
            "/api/auth/login", json={"email": "bob@example.com", "password": "a fresh secret"}
        )
        assert login.status_code == 200
    assert (await bob.get("/api/auth/me")).status_code == 401  # old sessions revoked


async def test_reset_link_falls_back_to_request_base_url(alice, bob):
    r = await alice.post(f"/api/admin/users/{bob.user['id']}/reset-link")
    assert r.json()["url"].startswith("http://test/reset-password?token=")


async def test_reset_link_unknown_user(alice):
    r = await alice.post(f"/api/admin/users/{uuid.uuid4()}/reset-link")
    assert r.status_code == 404
