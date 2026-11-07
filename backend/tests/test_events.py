from sqlalchemy import text

from app.db import engine
from tests.conftest import make_client, register


async def events(user_id: str | None = None) -> list[dict]:
    sql = "SELECT * FROM item_events"
    params: dict = {}
    if user_id:
        sql += " WHERE user_id = CAST(:u AS uuid)"
        params["u"] = user_id
    async with engine.connect() as conn:
        rows = await conn.execute(text(sql + " ORDER BY occurred_at, kind"), params)
        return [dict(r._mapping) for r in rows]


def kinds(evts: list[dict]) -> list[str]:
    return [e["kind"] for e in evts]


async def add(c, url, **extra):
    r = await c.post("/api/items", json={"url": url, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def test_add_emits_added(alice):
    item = await add(alice, "https://example.com/a")
    evts = await events()
    assert kinds(evts) == ["added"]
    e = evts[0]
    assert str(e["item_id"]) == item["id"]
    assert str(e["user_id"]) == alice.user["id"]
    assert str(e["resource_id"]) == item["resource"]["id"]
    assert e["other_user_id"] is None and e["was_seen"] is None


async def test_add_as_seen_emits_added_and_seen(alice):
    await add(alice, "https://example.com/a", status="seen")
    assert sorted(kinds(await events())) == ["added", "seen"]


async def test_duplicate_add_emits_nothing(alice):
    await add(alice, "https://example.com/a")
    assert (
        await alice.post("/api/items", json={"url": "https://example.com/a"})
    ).status_code == 409
    assert kinds(await events()) == ["added"]


async def test_status_transitions_emit_events(alice):
    item = await add(alice, "https://example.com/a")
    url = f"/api/items/{item['id']}"

    await alice.patch(url, json={"status": "to_watch"})  # no transition
    await alice.patch(url, json={"notes": "n", "tags": ["x"]})  # not a status change
    assert kinds(await events()) == ["added"]

    r = await alice.patch(url, json={"status": "seen"})
    assert r.json()["status"] == "seen"
    await alice.patch(url, json={"status": "seen"})  # no transition
    await alice.patch(url, json={"status": "to_watch"})
    await alice.patch(url, json={"status": "seen"})
    assert kinds(await events()) == ["added", "seen", "unseen", "seen"]


async def test_seen_event_matches_seen_at(alice):
    item = await add(alice, "https://example.com/a")
    r = await alice.patch(f"/api/items/{item['id']}", json={"status": "seen"})
    seen = [e for e in await events() if e["kind"] == "seen"][0]
    assert seen["occurred_at"].isoformat() == r.json()["seen_at"].replace("Z", "+00:00")


async def test_delete_emits_deleted_and_events_survive(alice):
    to_watch = await add(alice, "https://example.com/a")
    seen = await add(alice, "https://example.com/b", status="seen")
    assert (await alice.delete(f"/api/items/{to_watch['id']}")).status_code == 204
    assert (await alice.delete(f"/api/items/{seen['id']}")).status_code == 204

    deleted = [e for e in await events() if e["kind"] == "deleted"]
    by_item = {str(e["item_id"]): e["was_seen"] for e in deleted}
    assert by_item == {to_watch["id"]: False, seen["id"]: True}
    assert len(await events()) == 5  # 2 added + 1 seen + 2 deleted: nothing was cascaded away


async def test_share_emits_shared_and_added(alice, bob):
    async with make_client() as carol:
        carol_user = await register(carol, "carol@example.com", "Carol")
        item = await add(alice, "https://example.com/a")
        r = await alice.post(
            f"/api/items/{item['id']}/share",
            json={"emails": ["bob@example.com", "carol@example.com", "ghost@example.com"]},
        )
        assert len(r.json()["shared"]) == 2

        sent = [e for e in await events(alice.user["id"]) if e["kind"] == "shared"]
        assert sorted(str(e["other_user_id"]) for e in sent) == sorted(
            [bob.user["id"], carol_user["id"]]
        )
        assert {str(e["item_id"]) for e in sent} == {item["id"]}

        for who, c in ((bob.user, bob), (carol_user, carol)):
            got = (await c.get("/api/items")).json()["items"][0]
            evts = await events(who["id"])
            assert kinds(evts) == ["added"]
            assert str(evts[0]["item_id"]) == got["id"]
            assert str(evts[0]["other_user_id"]) == alice.user["id"]


async def test_share_already_had_emits_nothing(alice, bob):
    item = await add(alice, "https://example.com/a")
    await add(bob, "https://example.com/a")
    before = len(await events())
    await alice.post(f"/api/items/{item['id']}/share", json={"emails": ["bob@example.com"]})
    await alice.post(f"/api/items/{item['id']}/share", json={"emails": ["alice@example.com"]})
    assert len(await events()) == before
