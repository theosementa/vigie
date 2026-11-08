from tests.conftest import make_client, register, sql


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
    assert r.json() == {"sent": ["bob@example.com"], "unknown_contacts": []}

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
    assert r.json() == {
        "sent": ["ghost@example.com"],
        "unknown_contacts": [],
    }  # same shape as a known address


async def test_share_when_recipient_already_has_resource(alice, bob):
    item = await add(alice, "https://example.com/a")
    bobs = await add(bob, "https://example.com/a", status="seen")
    r = await alice.post(
        f"/api/items/{item['id']}/share", json={"emails": ["bob@example.com"], "message": "hi"}
    )
    assert r.json() == {"sent": ["bob@example.com"], "unknown_contacts": []}

    after = (await bob.get(f"/api/items/{bobs['id']}")).json()
    assert after["shared_by"]["email"] == "alice@example.com"  # only shared_by is filled
    assert after["status"] == "seen"  # untouched
    assert len((await bob.get("/api/items")).json()["items"]) == 1


async def test_share_twice_is_idempotent(alice, bob):
    item = await add(alice, "https://example.com/a")
    url = f"/api/items/{item['id']}/share"
    assert (await alice.post(url, json={"emails": ["bob@example.com"]})).status_code == 200
    second = (await alice.post(url, json={"emails": ["bob@example.com"]})).json()
    assert second == {"sent": ["bob@example.com"], "unknown_contacts": []}
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
            "sent": [
                "bob@example.com",
                "carol@example.com",
                "nobody@example.com",
                "alice@example.com",
            ],
            "unknown_contacts": [],
        }
        assert len((await alice.get("/api/items")).json()["items"]) == 1


async def test_share_validation(alice):
    item = await add(alice, "https://example.com/a")
    assert (
        await alice.post(f"/api/items/{item['id']}/share", json={"emails": []})
    ).status_code == 422


async def test_share_log_records_every_address_but_never_the_account(alice, bob):
    item = await add(alice, "https://example.com/a")
    await alice.post(
        f"/api/items/{item['id']}/share",
        json={"emails": ["bob@example.com", "ghost@example.com", "alice@example.com"]},
    )
    rows = await sql(
        "SELECT recipient_email, recipient_user_id FROM share_log ORDER BY recipient_email"
    )
    assert [r[0] for r in rows] == ["bob@example.com", "ghost@example.com"]  # not the sender
    assert rows[0][1] is not None and rows[1][1] is None  # set only when delivered


async def test_share_response_is_identical_for_registered_and_unregistered(alice, bob):
    await alice.patch("/api/auth/me", json={"auto_create_contacts": False})
    item = await add(alice, "https://example.com/a")
    url = f"/api/items/{item['id']}/share"
    known = await alice.post(url, json={"emails": ["bob@example.com"]})
    unknown = await alice.post(url, json={"emails": ["ghost@example.com"]})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == {"sent": ["bob@example.com"], "unknown_contacts": ["bob@example.com"]}
    assert unknown.json() == {
        "sent": ["ghost@example.com"],
        "unknown_contacts": ["ghost@example.com"],
    }


async def test_share_rejects_malformed_addresses(alice):
    item = await add(alice, "https://example.com/a")
    r = await alice.post(f"/api/items/{item['id']}/share", json={"emails": ["not an email"]})
    assert r.status_code == 422
