import asyncio
import os
import uuid

from alembic.config import Config
from sqlalchemy import text

from alembic import command
from app.db import engine


def yt(n: int) -> str:
    return f"https://www.youtube.com/watch?v=video{n:06d}"


async def add(c, url, **extra):
    r = await c.post("/api/items", json={"url": url, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def enqueue(c, item_id, position=None):
    r = await c.post("/api/queue", json={"item_id": item_id, "position": position})
    assert r.status_code == 200, r.text
    return r.json()


async def queue_ids(c) -> list[str]:
    r = await c.get("/api/queue")
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert [i["queue_position"] for i in items] == list(range(len(items)))  # contiguous
    return [i["id"] for i in items]


async def make_videos(c, n: int) -> list[str]:
    return [(await add(c, yt(i)))["id"] for i in range(n)]


async def test_empty_queue_and_default_position(alice):
    assert (await alice.get("/api/queue")).json() == {"items": []}
    item = await add(alice, yt(1))
    assert item["queue_position"] is None


async def test_add_appends_by_default(alice):
    a, b, c = await make_videos(alice, 3)
    first = await enqueue(alice, a)
    assert first["id"] == a and first["queue_position"] == 0
    assert first["resource"]["type"] == "video"
    await enqueue(alice, b)
    await enqueue(alice, c)
    assert await queue_ids(alice) == [a, b, c]


async def test_add_at_position_and_clamping(alice):
    a, b, c, d = await make_videos(alice, 4)
    await enqueue(alice, a)
    await enqueue(alice, b)
    assert (await enqueue(alice, c, 0))["queue_position"] == 0
    assert await queue_ids(alice) == [c, a, b]
    assert (await enqueue(alice, d, 99))["queue_position"] == 3
    assert await queue_ids(alice) == [c, a, b, d]


async def test_add_negative_position_clamps_to_front(alice):
    a, b = await make_videos(alice, 2)
    await enqueue(alice, a)
    assert (await enqueue(alice, b, -5))["queue_position"] == 0
    assert await queue_ids(alice) == [b, a]


async def test_add_is_idempotent_and_moves_when_position_given(alice):
    a, b, c = await make_videos(alice, 3)
    for i in (a, b, c):
        await enqueue(alice, i)
    again = await enqueue(alice, a)  # no position: unchanged
    assert again["queue_position"] == 0
    assert await queue_ids(alice) == [a, b, c]
    moved = await enqueue(alice, a, 2)
    assert moved["queue_position"] == 2
    assert await queue_ids(alice) == [b, c, a]


async def test_any_type_can_be_queued(alice):
    article = await add(alice, "https://example.com/post")
    assert (await enqueue(alice, article["id"]))["queue_position"] == 0
    as_article = await add(alice, yt(1), type="article")
    assert (await enqueue(alice, as_article["id"]))["queue_position"] == 1
    assert await queue_ids(alice) == [article["id"], as_article["id"]]


async def test_add_unknown_item_and_invalid_body(alice):
    r = await alice.post("/api/queue", json={"item_id": str(uuid.uuid4())})
    assert r.status_code == 404
    r = await alice.post("/api/queue", json={"item_id": "nope"})
    assert r.status_code == 422
    r = await alice.post("/api/queue", json={})
    assert r.status_code == 422


async def test_move(alice):
    a, b, c, d = await make_videos(alice, 4)
    for i in (a, b, c, d):
        await enqueue(alice, i)

    r = await alice.patch(f"/api/queue/{d}", json={"position": 0})
    assert r.status_code == 200 and r.json()["queue_position"] == 0
    assert await queue_ids(alice) == [d, a, b, c]

    r = await alice.patch(f"/api/queue/{d}", json={"position": 2})
    assert r.json()["queue_position"] == 2
    assert await queue_ids(alice) == [a, b, d, c]

    r = await alice.patch(f"/api/queue/{a}", json={"position": 100})  # clamped to the end
    assert r.json()["queue_position"] == 3
    assert await queue_ids(alice) == [b, d, c, a]

    r = await alice.patch(f"/api/queue/{a}", json={"position": -1})  # clamped to the front
    assert r.json()["queue_position"] == 0
    assert await queue_ids(alice) == [a, b, d, c]


async def test_move_not_queued_is_404(alice):
    (a,) = await make_videos(alice, 1)
    r = await alice.patch(f"/api/queue/{a}", json={"position": 0})
    assert r.status_code == 404
    r = await alice.patch(f"/api/queue/{uuid.uuid4()}", json={"position": 0})
    assert r.status_code == 404
    r = await alice.patch(f"/api/queue/{a}", json={})
    assert r.status_code == 422


async def test_remove_compacts(alice):
    a, b, c = await make_videos(alice, 3)
    for i in (a, b, c):
        await enqueue(alice, i)
    r = await alice.delete(f"/api/queue/{b}")
    assert r.status_code == 204
    assert await queue_ids(alice) == [a, c]
    # the item itself is still in the library, no longer queued
    item = (await alice.get(f"/api/items/{b}")).json()
    assert item["queue_position"] is None

    again = await alice.delete(f"/api/queue/{b}")  # not queued anymore: still 204
    assert again.status_code == 204
    assert (await alice.delete(f"/api/queue/{uuid.uuid4()}")).status_code == 404

    await alice.delete(f"/api/queue/{a}")
    assert await queue_ids(alice) == [c]


async def test_queue_does_not_touch_updated_at_of_neighbours(alice):
    a, b = await make_videos(alice, 2)
    await enqueue(alice, a)
    await enqueue(alice, b)
    before = (await alice.get(f"/api/items/{b}")).json()["updated_at"]
    await alice.delete(f"/api/queue/{a}")  # b shifts from 1 to 0
    after = (await alice.get(f"/api/items/{b}")).json()
    assert after["queue_position"] == 0
    assert after["updated_at"] == before


async def test_isolation_between_users(alice, bob):
    (a,) = await make_videos(alice, 1)
    await enqueue(alice, a)
    (b,) = await make_videos(bob, 1)  # same URL, different item

    assert await queue_ids(bob) == []
    assert (await bob.post("/api/queue", json={"item_id": a})).status_code == 404
    assert (await bob.patch(f"/api/queue/{a}", json={"position": 0})).status_code == 404
    assert (await bob.delete(f"/api/queue/{a}")).status_code == 404
    assert await queue_ids(alice) == [a]

    await enqueue(bob, b)
    assert await queue_ids(bob) == [b]  # position 0 for both users
    assert await queue_ids(alice) == [a]


async def test_requires_auth(client):
    assert (await client.get("/api/queue")).status_code == 401
    assert (await client.post("/api/queue", json={"item_id": str(uuid.uuid4())})).status_code == 401


async def test_marking_seen_removes_and_compacts(alice):
    a, b, c = await make_videos(alice, 3)
    for i in (a, b, c):
        await enqueue(alice, i)
    r = await alice.patch(f"/api/items/{a}", json={"status": "seen"})
    assert r.status_code == 200 and r.json()["queue_position"] is None
    assert await queue_ids(alice) == [b, c]

    # back to to_watch does not requeue
    await alice.patch(f"/api/items/{a}", json={"status": "to_watch"})
    assert await queue_ids(alice) == [b, c]


async def test_deleting_item_removes_and_compacts(alice):
    a, b, c = await make_videos(alice, 3)
    for i in (a, b, c):
        await enqueue(alice, i)
    assert (await alice.delete(f"/api/items/{b}")).status_code == 204
    assert await queue_ids(alice) == [a, c]


async def test_changing_type_keeps_queue_position(alice):
    a, b = await make_videos(alice, 2)
    await enqueue(alice, a)
    await enqueue(alice, b)
    r = await alice.patch(f"/api/items/{a}", json={"type": "article"})
    assert r.json()["queue_position"] == 0
    assert await queue_ids(alice) == [a, b]


async def test_other_item_edits_keep_queue_position(alice):
    a, b = await make_videos(alice, 2)
    await enqueue(alice, a)
    await enqueue(alice, b)
    r = await alice.patch(f"/api/items/{b}", json={"notes": "hi", "tags": ["x"]})
    assert r.json()["queue_position"] == 1


async def test_create_with_queue_flag(alice):
    first = await add(alice, yt(1), queue=True)
    assert first["queue_position"] == 0
    second = await add(alice, yt(2), queue=True)
    assert second["queue_position"] == 1
    plain = await add(alice, yt(3))
    assert plain["queue_position"] is None
    assert await queue_ids(alice) == [first["id"], second["id"]]


async def test_create_with_queue_flag_any_type_but_not_seen(alice):
    article = await add(alice, "https://example.com/post", queue=True)
    assert article["queue_position"] == 0
    seen = await add(alice, yt(1), status="seen", queue=True)
    assert seen["queue_position"] is None
    assert await queue_ids(alice) == [article["id"]]


async def test_list_items_queued_filter(alice):
    a, b, c = await make_videos(alice, 3)
    article = (await add(alice, "https://example.com/post"))["id"]
    await enqueue(alice, a)
    await enqueue(alice, c)

    r = await alice.get("/api/items", params={"queued": "true"})
    assert {i["id"] for i in r.json()["items"]} == {a, c}
    r = await alice.get("/api/items", params={"queued": "false"})
    assert {i["id"] for i in r.json()["items"]} == {b, article}
    r = await alice.get("/api/items")
    assert len(r.json()["items"]) == 4
    assert {i["id"]: i["queue_position"] for i in r.json()["items"]}[c] == 1


async def test_queue_does_not_write_events(alice):
    (a,) = await make_videos(alice, 1)
    before = (await alice.get("/api/stats/summary")).json()
    await enqueue(alice, a)
    await alice.patch(f"/api/queue/{a}", json={"position": 0})
    await alice.delete(f"/api/queue/{a}")
    assert (await alice.get("/api/stats/summary")).json() == before


async def test_migration_0003_adds_nullable_queue_position():
    root = os.path.join(os.path.dirname(__file__), "..")
    cfg = Config(os.path.join(root, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(root, "alembic"))
    await asyncio.to_thread(command.downgrade, cfg, "0002")

    uid, rid, iid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, display_name) "
                "VALUES (:i, 'a@example.com', 'x', 'a')"
            ),
            {"i": uid},
        )
        await conn.execute(
            text(
                "INSERT INTO resources (id, url, type, title) "
                "VALUES (:i, 'https://a.b', 'video', 't')"
            ),
            {"i": rid},
        )
        await conn.execute(
            text(
                "INSERT INTO items (id, user_id, resource_id, status) "
                "VALUES (:i, :u, :r, 'to_watch')"
            ),
            {"i": iid, "u": uid, "r": rid},
        )

    await asyncio.to_thread(command.upgrade, cfg, "head")

    async with engine.connect() as conn:
        position = await conn.scalar(
            text("SELECT queue_position FROM items WHERE id = :i"), {"i": iid}
        )
        index = await conn.scalar(
            text("SELECT 1 FROM pg_indexes WHERE indexname = 'ix_items_user_queue_position'")
        )
    assert position is None
    assert index == 1
