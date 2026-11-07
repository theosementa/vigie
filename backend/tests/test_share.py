from tests.conftest import make_client, register


async def add(c, url, **extra):
    r = await c.post("/api/items", json={"url": url, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def test_share_with_existing_user(alice, bob):
    item = await add(alice, "https://example.com/a", notes="private", tags=["x"])
    r = await alice.post(
        f"/api/items/{item['id']}/share",
        json={"emails": ["BOB@example.com"], "message": "you should read this"},
    )
    assert r.status_code == 200
    assert r.json() == {"shared": ["bob@example.com"], "not_found": [], "already_had": []}

    listing = (await bob.get("/api/items")).json()["items"]
    assert len(listing) == 1
    got = listing[0]
    assert got["id"] != item["id"]
    assert got["status"] == "to_watch"
    assert got["resource"]["id"] == item["resource"]["id"]
    assert got["notes"] is None and got["tags"] == []  # personal data is not shared
    assert got["share_message"] == "you should read this"
    assert got["shared_by"] == {
        "id": alice.user["id"],
        "first_name": "Alice",
        "last_name": "Tester",
        "email": "alice@example.com",
    }
    shared_only = (await bob.get("/api/items", params={"shared": "true"})).json()["items"]
    assert [i["id"] for i in shared_only] == [got["id"]]
    assert (await alice.get("/api/items", params={"shared": "true"})).json()["items"] == []


async def test_share_unknown_email(alice):
    item = await add(alice, "https://example.com/a")
    r = await alice.post(f"/api/items/{item['id']}/share", json={"emails": ["ghost@example.com"]})
    assert r.status_code == 200
    assert r.json() == {"shared": [], "not_found": ["ghost@example.com"], "already_had": []}


async def test_share_when_recipient_already_has_resource(alice, bob):
    item = await add(alice, "https://example.com/a")
    bobs = await add(bob, "https://example.com/a", status="seen")
    r = await alice.post(
        f"/api/items/{item['id']}/share", json={"emails": ["bob@example.com"], "message": "hi"}
    )
    assert r.json() == {"shared": [], "not_found": [], "already_had": ["bob@example.com"]}

    after = (await bob.get(f"/api/items/{bobs['id']}")).json()
    assert after["shared_by"]["email"] == "alice@example.com"  # only shared_by is filled
    assert after["status"] == "seen"  # untouched
    assert len((await bob.get("/api/items")).json()["items"]) == 1


async def test_share_twice_reports_already_had(alice, bob):
    item = await add(alice, "https://example.com/a")
    url = f"/api/items/{item['id']}/share"
    assert (await alice.post(url, json={"emails": ["bob@example.com"]})).json()["shared"]
    second = (await alice.post(url, json={"emails": ["bob@example.com"]})).json()
    assert second == {"shared": [], "not_found": [], "already_had": ["bob@example.com"]}
    assert len((await bob.get("/api/items")).json()["items"]) == 1


async def test_share_mixed_batch_dedupes_and_ignores_self(alice, bob):
    async with make_client() as carol:
        await register(carol, "carol@example.com", "Carol")
        item = await add(alice, "https://example.com/a")
        await add(carol, "https://example.com/a")
        r = await alice.post(
            f"/api/items/{item['id']}/share",
            json={
                "emails": [
                    "bob@example.com",
                    "Bob@Example.com",
                    "carol@example.com",
                    "nobody@example.com",
                    "alice@example.com",
                ]
            },
        )
        assert r.json() == {
            "shared": ["bob@example.com"],
            "not_found": ["nobody@example.com"],
            "already_had": ["carol@example.com", "alice@example.com"],
        }
        assert len((await alice.get("/api/items")).json()["items"]) == 1


async def test_share_validation(alice):
    item = await add(alice, "https://example.com/a")
    assert (
        await alice.post(f"/api/items/{item['id']}/share", json={"emails": []})
    ).status_code == 422
