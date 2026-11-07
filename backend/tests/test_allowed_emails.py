import pytest

from tests.conftest import make_client, signup_payload

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"


@pytest.fixture
def allow(monkeypatch):
    def _set(value: str) -> None:
        monkeypatch.setattr("app.core.config.settings.allowed_emails", value)

    return _set


async def test_empty_list_restricts_nobody(client):
    r = await client.post(REGISTER, json=signup_payload("anyone@example.com"))
    assert r.status_code == 201


async def test_signup_is_limited_to_the_list_case_insensitively(client, allow):
    allow(" Me@Example.com , you@example.com ")
    refused = await client.post(REGISTER, json=signup_payload("eve@example.com"))
    assert refused.status_code == 403
    assert refused.json()["detail"]["code"] == "email_not_allowed"
    ok = await client.post(REGISTER, json=signup_payload("ME@example.com"))
    assert ok.status_code == 201 and ok.json()["role"] == "admin"


async def test_the_very_first_signup_is_limited_too(client, allow):
    allow("me@example.com")
    r = await client.post(REGISTER, json=signup_payload("eve@example.com"))
    assert r.status_code == 403


async def test_invitations_outside_the_list_are_refused(alice, allow):
    allow("alice@example.com,bob@example.com")
    assert (
        await alice.post("/api/admin/invitations", json={"email": "bob@example.com"})
    ).status_code == 201
    r = await alice.post("/api/admin/invitations", json={"email": "eve@example.com"})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "email_not_allowed"


async def test_removed_address_cannot_log_in_or_use_its_session(alice, allow):
    allow("someone-else@example.com")
    assert (await alice.get("/api/auth/me")).status_code == 401  # session already open
    async with make_client() as c:
        r = await c.post(LOGIN, json={"email": "alice@example.com", "password": "correct horse"})
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "invalid_credentials"
