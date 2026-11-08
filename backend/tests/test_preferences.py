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


async def test_mobile_layout_defaults_and_follows_the_account(alice):
    assert (await alice.get("/api/auth/me")).json()["mobile_layout"] == "list"
    r = await alice.patch("/api/auth/me", json={"mobile_layout": "grid"})
    assert r.status_code == 200 and r.json()["mobile_layout"] == "grid"
    # other preferences untouched, and it persists for every device reading /me
    r = await alice.patch("/api/auth/me", json={"theme": "dark"})
    me = (await alice.get("/api/auth/me")).json()
    assert (me["mobile_layout"], me["theme"]) == ("grid", "dark")
    assert r.json()["mobile_layout"] == "grid"


@pytest.mark.parametrize("value", ["table", "GRID", ""])
async def test_invalid_mobile_layout_is_422(alice, value):
    assert (await alice.patch("/api/auth/me", json={"mobile_layout": value})).status_code == 422
    assert (await alice.get("/api/auth/me")).json()["mobile_layout"] == "list"


async def test_show_repos_defaults_to_true_and_follows_the_account(alice):
    assert (await alice.get("/api/auth/me")).json()["show_repos"] is True
    r = await alice.patch("/api/auth/me", json={"show_repos": False})
    assert r.status_code == 200 and r.json()["show_repos"] is False
    # untouched by other updates, persisted for every device reading /me
    await alice.patch("/api/auth/me", json={"theme": "dark"})
    assert (await alice.get("/api/auth/me")).json()["show_repos"] is False


async def test_invalid_show_repos_is_422(alice):
    assert (await alice.patch("/api/auth/me", json={"show_repos": "maybe"})).status_code == 422
    assert (await alice.get("/api/auth/me")).json()["show_repos"] is True
