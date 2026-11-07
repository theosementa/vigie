import pytest

from tests.conftest import make_client, set_mode, signup_payload, sql

REGISTER = "/api/auth/register"


async def test_first_account_is_admin_second_is_user(client):
    r = await client.post(REGISTER, json=signup_payload("a@example.com"))
    assert r.status_code == 201 and r.json()["role"] == "admin"
    async with make_client() as c2:
        r2 = await c2.post(REGISTER, json=signup_payload("b@example.com"))
        assert r2.status_code == 201 and r2.json()["role"] == "user"


@pytest.mark.parametrize("mode", ["invite", "open", "closed"])
async def test_first_account_is_admin_whatever_the_mode(client, mode):
    await set_mode(mode)
    r = await client.post(REGISTER, json=signup_payload("a@example.com"))
    assert r.status_code == 201 and r.json()["role"] == "admin"


async def test_names_are_required_trimmed_and_bounded(client):
    base = signup_payload("a@example.com")
    for bad in ({"first_name": ""}, {"last_name": "   "}, {"first_name": "x" * 51}):
        assert (await client.post(REGISTER, json={**base, **bad})).status_code == 422
    missing = {k: v for k, v in base.items() if k != "last_name"}
    assert (await client.post(REGISTER, json=missing)).status_code == 422
    r = await client.post(REGISTER, json={**base, "first_name": "  Ada ", "last_name": " L "})
    assert r.status_code == 201
    assert (r.json()["first_name"], r.json()["last_name"]) == ("Ada", "L")


async def test_invite_mode_requires_an_invitation(alice):
    await set_mode("invite")
    async with make_client() as c:
        r = await c.post(REGISTER, json=signup_payload("eve@example.com"))
        assert r.status_code == 403
        assert r.json()["detail"]["code"] == "not_invited"

        inv = await alice.post("/api/admin/invitations", json={"email": "Eve@Example.com"})
        assert inv.status_code == 201
        ok = await c.post(REGISTER, json=signup_payload("EVE@example.com"))
        assert ok.status_code == 201 and ok.json()["role"] == "user"

    rows = await sql("SELECT used_at FROM invitations WHERE email = 'eve@example.com'")
    assert rows[0].used_at is not None
    # an invitation is single use
    async with make_client() as c:
        again = await c.post(REGISTER, json=signup_payload("eve@example.com"))
        assert again.status_code == 403


async def test_closed_mode_refuses_everyone_after_the_first(alice):
    await set_mode("closed")
    await alice.post("/api/admin/invitations", json={"email": "eve@example.com"})
    async with make_client() as c:
        r = await c.post(REGISTER, json=signup_payload("eve@example.com"))
        assert r.status_code == 403
        assert r.json()["detail"]["code"] == "registration_closed"


async def test_changing_the_mode_never_touches_existing_accounts(alice, bob):
    for mode in ("closed", "invite", "open"):
        r = await alice.patch("/api/admin/settings", json={"registration_mode": mode})
        assert r.status_code == 200
        assert (await bob.get("/api/auth/me")).status_code == 200
    assert len(await sql("SELECT 1 FROM users")) == 2


@pytest.mark.parametrize(
    "domain", ["nas.local", "pi.lan", "box.home.arpa", "me.test", "svc.internal"]
)
async def test_special_use_domains_by_mode(client, domain):
    email = f"user@{domain}"
    await set_mode("open")
    r = await client.post(REGISTER, json=signup_payload(email))
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "email_domain_not_allowed"

    await set_mode("invite")  # first account: allowed whatever, and homelab domains are fine
    r = await client.post(REGISTER, json=signup_payload(email))
    assert r.status_code == 201

    await set_mode("closed")
    admin = make_client()
    async with admin as c:
        await c.post("/api/auth/login", json={"email": email, "password": "correct horse"})
        inv = await c.post("/api/admin/invitations", json={"email": f"two@{domain}"})
        assert inv.status_code == 201
    await set_mode("invite")
    async with make_client() as c:
        ok = await c.post(REGISTER, json=signup_payload(f"two@{domain}"))
        assert ok.status_code == 201


async def test_duplicate_email_is_409_with_code(alice):
    r = await alice.post(REGISTER, json=signup_payload("ALICE@example.com"))
    assert r.status_code == 409 and r.json()["detail"]["code"] == "email_taken"


async def test_registration_seeded_from_env_only_once(client, monkeypatch):
    monkeypatch.setattr("app.services.accounts.settings.registration", "closed")
    await client.post(REGISTER, json=signup_payload("a@example.com"))
    rows = await sql("SELECT registration_mode FROM instance_settings")
    assert [r.registration_mode for r in rows] == ["closed"]
    monkeypatch.setattr("app.services.accounts.settings.registration", "open")
    async with make_client() as c:
        assert (await c.post(REGISTER, json=signup_payload("b@example.com"))).status_code == 403
