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


async def test_hidden_types_default_to_none_and_follow_the_account(alice):
    assert (await alice.get("/api/auth/me")).json()["hidden_types"] == []
    r = await alice.patch("/api/auth/me", json={"hidden_types": ["repo", "video", "repo"]})
    assert r.status_code == 200 and r.json()["hidden_types"] == ["repo", "video"]
    # untouched by other updates, persisted for every device reading /me
    await alice.patch("/api/auth/me", json={"theme": "dark"})
    assert (await alice.get("/api/auth/me")).json()["hidden_types"] == ["repo", "video"]
    # an empty list shows everything again
    r = await alice.patch("/api/auth/me", json={"hidden_types": []})
    assert r.json()["hidden_types"] == []


@pytest.mark.parametrize(
    "value",
    [["podcast"], "repo", ["article", "video", "website", "repo"]],
)
async def test_invalid_hidden_types_is_422(alice, value):
    assert (await alice.patch("/api/auth/me", json={"hidden_types": value})).status_code == 422
    assert (await alice.get("/api/auth/me")).json()["hidden_types"] == []
