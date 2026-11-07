import uuid

from sqlalchemy import text

from app.db import engine
from tests.conftest import make_client, register


async def add(c, url):
    r = await c.post("/api/items", json={"url": url})
    assert r.status_code == 201, r.text
    return r.json()


async def test_history_oldest_first(alice):
    item = await add(alice, "https://example.com/a")
    await alice.patch(f"/api/items/{item['id']}", json={"status": "seen"})
    await alice.patch(f"/api/items/{item['id']}", json={"status": "to_watch"})
    r = await alice.get(f"/api/items/{item['id']}/events")
    assert r.status_code == 200
    body = r.json()
    assert [e["kind"] for e in body] == ["added", "seen", "unseen"]
    stamps = [e["occurred_at"] for e in body]
    assert stamps == sorted(stamps)
    assert all(e["other_user"] is None for e in body)


async def test_only_that_items_events(alice):
    a = await add(alice, "https://example.com/a")
    await add(alice, "https://example.com/b")
    r = await alice.get(f"/api/items/{a['id']}/events")
    assert [e["kind"] for e in r.json()] == ["added"]


async def test_foreign_and_unknown_item_are_404(alice, bob):
    item = await add(alice, "https://example.com/a")
    assert (await bob.get(f"/api/items/{item['id']}/events")).status_code == 404
    assert (await bob.get(f"/api/items/{uuid.uuid4()}/events")).status_code == 404


async def test_requires_auth(client):
    assert (await client.get(f"/api/items/{uuid.uuid4()}/events")).status_code == 401


async def test_shared_names(alice, bob):
    item = await add(alice, "https://example.com/a")
    await alice.post(f"/api/items/{item['id']}/share", json={"emails": ["bob@example.com"]})

    sent = (await alice.get(f"/api/items/{item['id']}/events")).json()
    shared = [e for e in sent if e["kind"] == "shared"]
    assert shared[0]["other_user"] == {"first_name": "Bob", "last_name": "Tester"}

    received = (await bob.get("/api/items")).json()["items"][0]
    evts = (await bob.get(f"/api/items/{received['id']}/events")).json()
    assert [e["kind"] for e in evts] == ["added"]
    assert evts[0]["other_user"] == {"first_name": "Alice", "last_name": "Tester"}


async def test_unknown_sharer_is_null(alice, bob):
    item = await add(alice, "https://example.com/a")
    await alice.post(f"/api/items/{item['id']}/share", json={"emails": ["bob@example.com"]})
    async with make_client() as carol:
        await register(carol, "carol@example.com", "Carol")
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM users WHERE email = 'bob@example.com'"))
    shared = [
        e
        for e in (await alice.get(f"/api/items/{item['id']}/events")).json()
        if e["kind"] == "shared"
    ]
    assert shared[0]["other_user"] is None
