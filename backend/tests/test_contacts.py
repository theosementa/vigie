import uuid

from tests.conftest import make_client, register, sql


async def add(c, url, **extra):
    r = await c.post("/api/items", json={"url": url, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def share(c, item, *emails, message=None):
    r = await c.post(
        f"/api/items/{item['id']}/share", json={"emails": list(emails), "message": message}
    )
    assert r.status_code == 200, r.text
    return r.json()


async def contacts(c):
    r = await c.get("/api/contacts")
    assert r.status_code == 200, r.text
    return r.json()


async def test_crud(alice):
    r = await alice.post("/api/contacts", json={"email": " Dana@Example.com ", "name": " Dana "})
    assert r.status_code == 200
    c = r.json()
    assert (c["email"], c["name"], c["share_count"], c["last_shared_at"]) == (
        "dana@example.com",
        "Dana",
        0,
        None,
    )
    # idempotent: the existing contact comes back, unchanged
    again = await alice.post("/api/contacts", json={"email": "dana@example.com", "name": "Other"})
    assert again.json()["id"] == c["id"] and again.json()["name"] == "Dana"
    assert len(await contacts(alice)) == 1

    r = await alice.patch(f"/api/contacts/{c['id']}", json={"name": "Dana B."})
    assert r.status_code == 200 and r.json()["name"] == "Dana B."
    r = await alice.patch(f"/api/contacts/{c['id']}", json={"name": "  "})
    assert r.json()["name"] is None  # blank means "use the address"

    assert (await alice.delete(f"/api/contacts/{c['id']}")).status_code == 204
    assert await contacts(alice) == []


async def test_validation(alice):
    assert (await alice.post("/api/contacts", json={"email": "nope"})).status_code == 422
    r = await alice.post("/api/contacts", json={"email": "a@example.com", "name": "x" * 101})
    assert r.status_code == 422


async def test_contacts_are_private_to_their_owner(alice, bob):
    c = (await alice.post("/api/contacts", json={"email": "dana@example.com"})).json()
    assert await contacts(bob) == []
    missing = f"/api/contacts/{uuid.uuid4()}"
    for client in (bob,):
        assert (
            await client.patch(f"/api/contacts/{c['id']}", json={"name": "x"})
        ).status_code == 404
        assert (await client.delete(f"/api/contacts/{c['id']}")).status_code == 404
        assert (await client.get(f"/api/contacts/{c['id']}/history")).status_code == 404
    assert (await alice.patch(missing, json={"name": "x"})).status_code == 404
    assert (await alice.get("/api/contacts")).json()[0]["name"] is None  # untouched


async def test_sharing_saves_recipients_by_default(alice, bob):
    item = await add(alice, "https://example.com/a")
    out = await share(alice, item, "bob@example.com", "ghost@example.com", "alice@example.com")
    assert out["unknown_contacts"] == []
    saved = {c["email"]: c for c in await contacts(alice)}
    assert set(saved) == {"bob@example.com", "ghost@example.com"}  # never the sender itself
    assert all(c["name"] is None and c["share_count"] == 1 for c in saved.values())


async def test_setting_off_creates_nothing_and_lists_new_addresses(alice, bob):
    await alice.patch("/api/auth/me", json={"auto_create_contacts": False})
    item = await add(alice, "https://example.com/a")
    out = await share(alice, item, "bob@example.com", "ghost@example.com")
    assert out["unknown_contacts"] == ["bob@example.com", "ghost@example.com"]
    assert await contacts(alice) == []

    await alice.post("/api/contacts", json={"email": "bob@example.com"})
    out = await share(alice, item, "bob@example.com", "ghost@example.com")
    assert out["unknown_contacts"] == ["ghost@example.com"]  # bob is saved now


async def test_no_oracle_in_share_contacts_and_history(alice, bob):
    await alice.patch("/api/auth/me", json={"auto_create_contacts": False})
    item = await add(
        alice,
        "https://example.com/a",
    )
    known = await share(alice, item, "bob@example.com", message="hi")
    ghost = await share(alice, item, "ghost@example.com", message="hi")
    assert known["unknown_contacts"] == ["bob@example.com"]
    assert ghost["unknown_contacts"] == ["ghost@example.com"]

    ids = {}
    for email in ("bob@example.com", "ghost@example.com"):
        ids[email] = (await alice.post("/api/contacts", json={"email": email})).json()["id"]
    by_email = {c["email"]: c for c in await contacts(alice)}
    for key in ("name", "share_count"):
        assert by_email["bob@example.com"][key] == by_email["ghost@example.com"][key]
    assert set(by_email["bob@example.com"]) == set(by_email["ghost@example.com"])
    assert "recipient_user_id" not in str(by_email) and "user_id" not in str(by_email)

    hist = {e: (await alice.get(f"/api/contacts/{i}/history")).json() for e, i in ids.items()}
    a, b = hist["bob@example.com"], hist["ghost@example.com"]
    assert len(a["entries"]) == len(b["entries"]) == 1
    assert set(a["entries"][0]) == set(b["entries"][0])
    assert a["entries"][0]["direction"] == b["entries"][0]["direction"] == "sent"
    assert a["entries"][0]["resource"] == b["entries"][0]["resource"]
    assert "user_id" not in str(a) and "user_id" not in str(b)


async def test_sent_history_includes_unknown_addresses_and_reshares_in_order(alice, bob):
    one = await add(alice, "https://example.com/one")
    two = await add(alice, "https://example.com/two")
    await share(alice, one, "ghost@example.com", message="first")
    await share(alice, two, "ghost@example.com", "bob@example.com")
    await share(alice, one, "ghost@example.com", message="again")
    cid = next(c["id"] for c in await contacts(alice) if c["email"] == "ghost@example.com")
    page = (await alice.get(f"/api/contacts/{cid}/history")).json()
    entries = page["entries"]
    assert [e["message"] for e in entries] == ["again", None, "first"]  # newest first
    assert [e["resource"]["url"] for e in entries] == [
        "https://example.com/one",
        "https://example.com/two",
        "https://example.com/one",
    ]
    assert all(e["direction"] == "sent" and e["my_item_id"] for e in entries)
    assert entries[0]["at"] >= entries[1]["at"] >= entries[2]["at"]
    assert page["next_before"] is None
    assert (await contacts(alice))[0]["share_count"] == 3


async def test_history_pagination(alice):
    items = [await add(alice, f"https://example.com/{i}") for i in range(5)]
    for it in items:
        await share(alice, it, "ghost@example.com")
    cid = (await contacts(alice))[0]["id"]
    first = (await alice.get(f"/api/contacts/{cid}/history", params={"limit": 2})).json()
    assert len(first["entries"]) == 2 and first["next_before"]
    second = (
        await alice.get(
            f"/api/contacts/{cid}/history", params={"limit": 2, "before": first["next_before"]}
        )
    ).json()
    seen = {e["id"] for e in first["entries"]} | {e["id"] for e in second["entries"]}
    assert len(seen) == 4
    last = (
        await alice.get(
            f"/api/contacts/{cid}/history", params={"limit": 2, "before": second["next_before"]}
        )
    ).json()
    assert len(last["entries"]) == 1 and last["next_before"] is None


async def test_received_history_only_when_that_account_delivered(alice, bob):
    # bob shares with alice: alice sees it from bob's side, on the left
    theirs = await add(bob, "https://example.com/from-bob")
    await share(bob, theirs, "alice@example.com", message="for you")
    await alice.post("/api/contacts", json={"email": "bob@example.com"})
    cid = (await contacts(alice))[0]["id"]
    entries = (await alice.get(f"/api/contacts/{cid}/history")).json()["entries"]
    assert [(e["direction"], e["message"]) for e in entries] == [("received", "for you")]
    assert entries[0]["my_item_id"]  # the copy that landed in alice's library

    # alice answers: both sides in one thread, in order
    mine = await add(alice, "https://example.com/from-alice")
    await share(alice, mine, "bob@example.com", message="thanks")
    entries = (await alice.get(f"/api/contacts/{cid}/history")).json()["entries"]
    assert [e["direction"] for e in entries] == ["sent", "received"]
    assert (await contacts(alice))[0]["share_count"] == 2


async def test_share_sent_before_an_account_existed_is_never_received(alice):
    item = await add(alice, "https://example.com/a")
    await share(alice, item, "late@example.com")
    async with make_client() as late:
        await register(late, "late@example.com", "Late")
        await late.post("/api/contacts", json={"email": "alice@example.com"})
        cid = (await contacts(late))[0]["id"]
        page = (await late.get(f"/api/contacts/{cid}/history")).json()
        assert page["entries"] == []
        assert (await contacts(late))[0]["share_count"] == 0
        assert (await late.get("/api/items")).json()["items"] == []


async def test_deleting_a_contact_keeps_its_history(alice):
    item = await add(alice, "https://example.com/a")
    await share(alice, item, "ghost@example.com", message="kept")
    c = (await contacts(alice))[0]
    await alice.delete(f"/api/contacts/{c['id']}")
    assert len(await sql("SELECT 1 FROM share_log")) == 1
    back = (await alice.post("/api/contacts", json={"email": "ghost@example.com"})).json()
    assert back["share_count"] == 1
    entries = (await alice.get(f"/api/contacts/{back['id']}/history")).json()["entries"]
    assert [e["message"] for e in entries] == ["kept"]


async def test_contacts_sorted_by_last_activity(alice):
    one = await add(alice, "https://example.com/one")
    await alice.post("/api/contacts", json={"email": "never@example.com"})
    await share(alice, one, "first@example.com")
    await share(alice, one, "second@example.com")
    assert [c["email"] for c in await contacts(alice)] == [
        "second@example.com",
        "first@example.com",
        "never@example.com",
    ]
