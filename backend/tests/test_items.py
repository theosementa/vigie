import uuid

import pytest

from tests.conftest import make_client, register

YT = "https://youtu.be/dQw4w9WgXcQ"
YT_CANON = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


async def add(c, url, **extra):
    r = await c.post("/api/items", json={"url": url, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def test_create_item_contract(alice):
    item = await add(alice, YT, notes="remember", tags=["Python", "talk"])
    uuid.UUID(item["id"])
    assert item["status"] == "to_watch"
    assert item["notes"] == "remember"
    assert item["seen_at"] is None
    assert item["shared_by"] is None
    assert item["share_message"] is None
    assert {t["name"] for t in item["tags"]} == {"Python", "talk"}
    for t in item["tags"]:
        uuid.UUID(t["id"])
    res = item["resource"]
    assert res["url"] == YT_CANON
    assert res["type"] == "video"
    assert res["duration_seconds"] == 600
    assert res["title"]
    for key in ("created_at", "updated_at"):
        assert "T" in item[key]


async def test_create_normalizes_and_rejects_duplicates(alice):
    first = await add(alice, "https://Example.com/post/?utm_source=x#frag")
    assert first["resource"]["url"] == "https://example.com/post"
    dup = await alice.post("/api/items", json={"url": "https://example.com/post?fbclid=1"})
    assert dup.status_code == 409
    assert dup.json()["detail"]["item_id"] == first["id"]


async def test_create_invalid_url(alice):
    r = await alice.post("/api/items", json={"url": "ftp://example.com/x"})
    assert r.status_code == 422
    r = await alice.post("/api/items", json={"url": "   "})
    assert r.status_code == 422


async def test_create_with_seen_status_and_type_override(alice):
    item = await add(alice, "https://example.com/talk", status="seen", type="video")
    assert item["status"] == "seen"
    assert item["seen_at"] is not None
    assert item["resource"]["type"] == "video"


@pytest.mark.real_metadata
async def test_metadata_failure_never_blocks_creation(alice):
    item = await add(alice, "http://127.0.0.1:9/private")
    assert item["resource"]["title"] == "127.0.0.1"
    assert item["resource"]["type"] == "article"


async def test_status_transitions_set_seen_at(alice):
    item = await add(alice, "https://example.com/a")
    r = await alice.patch(f"/api/items/{item['id']}", json={"status": "seen"})
    assert r.status_code == 200
    assert r.json()["status"] == "seen"
    seen_at = r.json()["seen_at"]
    assert seen_at is not None

    again = await alice.patch(f"/api/items/{item['id']}", json={"status": "seen"})
    assert again.json()["seen_at"] == seen_at  # unchanged

    back = await alice.patch(f"/api/items/{item['id']}", json={"status": "to_watch"})
    assert back.json()["status"] == "to_watch"
    assert back.json()["seen_at"] is None


async def test_patch_notes_tags_type(alice):
    item = await add(alice, "https://example.com/a", tags=["one", "two"])
    r = await alice.patch(
        f"/api/items/{item['id']}",
        json={"notes": "hello", "tags": ["two", "THREE", "three"], "type": "video"},
    )
    body = r.json()
    assert body["notes"] == "hello"
    assert sorted(t["name"] for t in body["tags"]) == ["THREE", "two"]
    assert body["resource"]["type"] == "video"

    # partial patch leaves other fields alone; empty notes clears
    r = await alice.patch(f"/api/items/{item['id']}", json={"notes": ""})
    assert r.json()["notes"] is None
    assert len(r.json()["tags"]) == 2
    assert (
        await alice.patch(f"/api/items/{item['id']}", json={"status": "nope"})
    ).status_code == 422


async def test_get_and_delete(alice):
    item = await add(alice, "https://example.com/a")
    assert (await alice.get(f"/api/items/{item['id']}")).json()["id"] == item["id"]
    assert (await alice.delete(f"/api/items/{item['id']}")).status_code == 204
    assert (await alice.get(f"/api/items/{item['id']}")).status_code == 404
    assert (await alice.delete(f"/api/items/{item['id']}")).status_code == 404
    # can be re-added afterwards
    await add(alice, "https://example.com/a")


async def test_list_filters(alice):
    a = await add(alice, "https://example.com/python-intro", tags=["python"], notes="great lesson")
    b = await add(alice, YT, tags=["Python", "talk"])
    c = await add(alice, "https://other.org/rust", status="seen")

    async def ids(**params):
        r = await alice.get("/api/items", params=params)
        assert r.status_code == 200
        return [i["id"] for i in r.json()["items"]]

    assert await ids() == [c["id"], b["id"], a["id"]]  # newest first
    assert await ids(status="seen") == [c["id"]]
    assert await ids(status="to_watch") == [b["id"], a["id"]]
    assert await ids(type="video") == [b["id"]]
    assert await ids(type="article") == [c["id"], a["id"]]
    assert await ids(tag="python") == [b["id"], a["id"]]  # case-insensitive, by name
    talk_id = next(t["id"] for t in b["tags"] if t["name"] == "talk")
    assert await ids(tag=talk_id) == [b["id"]]
    assert await ids(tag="talk") == [b["id"]]
    assert await ids(tag="unknown") == []
    assert await ids(q="rust") == [c["id"]]  # url-based title / site name
    assert await ids(q="LESSON") == [a["id"]]  # notes
    assert await ids(q="python-intro") == [a["id"]]
    assert await ids(q="%") == []  # wildcard is escaped
    assert await ids(shared="true") == []
    assert await ids(status="seen", type="article", q="other") == [c["id"]]


async def test_type_filter_uses_user_override(alice):
    a = await add(alice, "https://example.com/a", type="video")
    r = await alice.get("/api/items", params={"type": "video"})
    assert [i["id"] for i in r.json()["items"]] == [a["id"]]
    r = await alice.get("/api/items", params={"type": "article"})
    assert r.json()["items"] == []


async def test_rename_item_is_per_user_and_reversible(alice):
    item = await add(alice, "https://example.com/a")
    original = item["resource"]["title"]
    r = await alice.patch(f"/api/items/{item['id']}", json={"title": "  My   own title "})
    assert r.json()["resource"]["title"] == "My own title"
    r = await alice.get("/api/items", params={"q": "own title"})
    assert [i["id"] for i in r.json()["items"]] == [item["id"]]
    # a refresh keeps the custom title
    r = await alice.post(f"/api/items/{item['id']}/refresh")
    assert r.json()["item"]["resource"]["title"] == "My own title"
    # an empty title restores the page's own
    r = await alice.patch(f"/api/items/{item['id']}", json={"title": ""})
    assert r.json()["resource"]["title"] == original
    assert (
        await alice.patch(f"/api/items/{item['id']}", json={"title": "x" * 501})
    ).status_code == 422


async def test_pagination_cursor(alice):
    created = [await add(alice, f"https://example.com/{n}") for n in range(5)]
    expected = [i["id"] for i in reversed(created)]

    r = await alice.get("/api/items", params={"limit": 2})
    page1 = r.json()
    assert len(page1["items"]) == 2
    assert page1["next_cursor"]

    collected = [i["id"] for i in page1["items"]]
    cursor = page1["next_cursor"]
    while cursor:
        page = (await alice.get("/api/items", params={"limit": 2, "cursor": cursor})).json()
        collected += [i["id"] for i in page["items"]]
        cursor = page["next_cursor"]
    assert collected == expected

    last = (await alice.get("/api/items", params={"limit": 5})).json()
    assert last["next_cursor"] is None
    assert (await alice.get("/api/items", params={"cursor": "###"})).status_code == 422
    assert (await alice.get("/api/items", params={"limit": 0})).status_code == 422


async def test_tags_endpoint_counts(alice, bob):
    await add(alice, "https://example.com/1", tags=["python", "web"])
    await add(alice, "https://example.com/2", tags=["Python"])
    await add(bob, "https://example.com/1", tags=["secret"])
    r = await alice.get("/api/tags")
    tags = {t["name"].lower(): t["item_count"] for t in r.json()}
    assert tags == {"python": 2, "web": 1}
    assert set(r.json()[0]) == {"id", "name", "item_count"}


async def test_tags_are_per_user(alice, bob):
    a = await add(alice, "https://example.com/1", tags=["python"])
    b = await add(bob, "https://example.com/1", tags=["python"])
    assert a["tags"][0]["id"] != b["tags"][0]["id"]
    assert [
        i["id"] for i in (await bob.get("/api/items", params={"tag": "python"})).json()["items"]
    ] == [b["id"]]


async def test_resource_is_shared_but_items_are_not(alice, bob):
    a = await add(alice, "https://example.com/x", notes="alice notes")
    b = await add(bob, "https://example.com/x")
    assert a["resource"]["id"] == b["resource"]["id"]
    assert a["id"] != b["id"]
    assert b["notes"] is None


async def test_isolation_between_users(alice, bob):
    item = await add(alice, "https://example.com/private", tags=["mine"])
    iid = item["id"]
    missing = str(uuid.uuid4())

    for method, path, body in [
        ("GET", f"/api/items/{iid}", None),
        ("PATCH", f"/api/items/{iid}", {"status": "seen"}),
        ("DELETE", f"/api/items/{iid}", None),
        ("POST", f"/api/items/{iid}/refresh", None),
        ("POST", f"/api/items/{iid}/share", {"emails": ["alice@example.com"]}),
    ]:
        other = await bob.request(method, path, json=body)
        nonexistent = await bob.request(method, path.replace(iid, missing), json=body)
        assert other.status_code == 404, (method, path)
        # indistinguishable from an item that does not exist
        assert other.json() == nonexistent.json()

    assert (await bob.get("/api/items")).json() == {
        "items": [],
        "next_cursor": None,
        "length_unknown": None,
    }
    assert (await bob.get("/api/tags")).json() == []
    # untouched for alice
    still = (await alice.get(f"/api/items/{iid}")).json()
    assert still["status"] == "to_watch"


async def test_refresh_updates_metadata(alice, monkeypatch):
    item = await add(alice, "https://example.com/a")
    from app.services.metadata import Metadata

    async def new_meta(url):
        return Metadata(url=url, title="New title", ok=True, reading_time_minutes=9)

    monkeypatch.setattr("app.api.routes.items.fetch_metadata", new_meta)
    r = await alice.post(f"/api/items/{item['id']}/refresh")
    assert r.status_code == 200
    assert r.json()["refreshed"] is True and r.json()["reason"] is None
    assert r.json()["item"]["resource"]["title"] == "New title"
    assert r.json()["item"]["resource"]["reading_time_minutes"] == 9


async def test_refresh_failure_keeps_old_data(alice, monkeypatch):
    item = await add(alice, "https://example.com/a")
    from app.services.metadata import Metadata

    async def failed(url):
        return Metadata(url=url, title="example.com", ok=False)

    monkeypatch.setattr("app.api.routes.items.fetch_metadata", failed)
    r = await alice.post(f"/api/items/{item['id']}/refresh")
    assert r.json()["refreshed"] is False and r.json()["reason"] == "fetch_failed"
    assert r.json()["item"]["resource"]["title"] == item["resource"]["title"]


async def test_preview(alice):
    r = await alice.post("/api/resources/preview", json={"url": "https://youtu.be/dQw4w9WgXcQ"})
    assert r.status_code == 200
    body = r.json()
    assert body["url"] == YT_CANON
    assert body["type"] == "video"
    assert body["existing_item_id"] is None
    item = await add(alice, YT)
    again = (await alice.post("/api/resources/preview", json={"url": YT})).json()
    assert again["existing_item_id"] == item["id"]
    bad = await alice.post("/api/resources/preview", json={"url": "nope://x"})
    assert bad.status_code == 422


async def test_preview_does_not_store_anything(alice):
    await alice.post("/api/resources/preview", json={"url": "https://example.com/p"})
    assert (await alice.get("/api/items")).json()["items"] == []
    # and a user who has no item for an existing resource gets no existing_item_id
    async with make_client() as other:
        await register(other, "carol@example.com")
        await add(other, "https://example.com/p")
        r = await alice.post("/api/resources/preview", json={"url": "https://example.com/p"})
        assert r.json()["existing_item_id"] is None


async def test_preview_returns_effective_type_for_owner(alice):
    url = "https://example.com/talk"
    await add(alice, url, type="video")
    body = (await alice.post("/api/resources/preview", json={"url": url})).json()
    assert body["type"] == "video"
    assert body["existing_item_id"] is not None


async def test_duplicate_race_returns_same_conflict_object(alice, bob, monkeypatch):
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.core.config import settings
    from app.models import Item, Resource
    from app.services import items as items_service

    url = "https://example.com/race"
    await add(bob, url)  # the resource already exists, committed
    real = items_service.resolve_tags
    created: dict[str, str] = {}

    async def racing_resolve_tags(session, user_id, names):
        # a concurrent request inserts the same item between the check and the commit
        other_engine = create_async_engine(settings.database_url, poolclass=NullPool)
        async with async_sessionmaker(other_engine, expire_on_commit=False)() as other:
            res = await other.scalar(select(Resource).where(Resource.url == url))
            item = Item(user_id=user_id, resource_id=res.id)
            other.add(item)
            await other.commit()
            created["id"] = str(item.id)
        await other_engine.dispose()
        return await real(session, user_id, names)

    monkeypatch.setattr("app.services.items.resolve_tags", racing_resolve_tags)
    r = await alice.post("/api/items", json={"url": url})
    assert r.status_code == 409
    assert r.json()["detail"] == {
        "code": "already_in_library",
        "message": "Already in your library",
        "item_id": created["id"],
    }
