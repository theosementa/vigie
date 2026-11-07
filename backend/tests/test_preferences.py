import pytest


async def test_defaults(alice):
    me = (await alice.get("/api/auth/me")).json()
    assert (me["locale"], me["theme"]) == ("auto", "system")


async def test_patch_preferences(alice):
    r = await alice.patch("/api/auth/me", json={"locale": "fr", "theme": "dark"})
    assert r.status_code == 200
    assert (r.json()["locale"], r.json()["theme"]) == ("fr", "dark")
    # partial update leaves the other preference alone
    r = await alice.patch("/api/auth/me", json={"theme": "light"})
    me = (await alice.get("/api/auth/me")).json()
    assert (me["locale"], me["theme"]) == ("fr", "light")
    assert r.json()["first_name"] == "Alice"


@pytest.mark.parametrize("body", [{"locale": "de"}, {"theme": "blue"}, {"locale": "FR"}])
async def test_invalid_preference_is_422(alice, body):
    assert (await alice.patch("/api/auth/me", json=body)).status_code == 422
    me = (await alice.get("/api/auth/me")).json()
    assert (me["locale"], me["theme"]) == ("auto", "system")
