import uuid

import pytest

from app.services.views import canonical_query


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("type=video&length=short", "length=short&type=video"),
        ("?tag=pos&status=seen", "status=seen&tag=pos"),
        ("status=to_watch&type=all&tag=pos", "tag=pos"),  # defaults are not filters
        ("type=video&type=article&type=video", "type=article&type=video"),  # several, sorted
        ("tag=Pos&tag=ai&tag=pos", "tag=ai&tag=Pos"),  # deduplicated case-insensitively
        ("length=short&length=long", "length=short"),  # first one wins
        ("type=movie&length=huge&status=done", ""),  # unknown values dropped
        ("item=abc&shared=true&utm=x&tag=a", "tag=a"),  # unknown keys dropped
        ("q=+hello+world+&tag=", "q=hello+world"),  # trimmed, blanks dropped
        ("tag=" + "x" * 51, ""),
        ("q=" + "x" * 201, ""),
        ("tag=c%2B%2B%20%26%20co", "tag=c%2B%2B+%26+co"),  # decoded, then re-encoded
        ("", ""),
    ],
)
def test_canonical_query(raw, expected):
    assert canonical_query(raw) == expected


async def create(c, name, query="type=video", **expect):
    r = await c.post("/api/views", json={"name": name, "query": query})
    assert r.status_code == expect.get("status", 201), r.text
    return r.json()


async def names(c):
    r = await c.get("/api/views")
    assert r.status_code == 200
    assert [v["position"] for v in r.json()] == list(range(len(r.json())))
    return [v["name"] for v in r.json()]


async def test_create_list_and_canonical_query(alice):
    v = await create(alice, "  Short videos ", "type=video&length=short&x=1")
    assert (v["name"], v["query"], v["position"]) == ("Short videos", "length=short&type=video", 0)
    await create(alice, "Seen", "status=seen")
    assert await names(alice) == ["Short videos", "Seen"]


async def test_validation(alice):
    r = await create(alice, "Nothing", "type=all&status=to_watch&junk=1", status=422)
    assert r["detail"]["code"] == "view_empty"
    await create(alice, "x", "q=" + "a" * 1001, status=422)
    await create(alice, "", status=422)
    await create(alice, "   ", status=422)
    await create(alice, "n" * 41, status=422)
    await create(alice, "n" * 40)
    assert (
        await alice.patch("/api/views/" + str(uuid.uuid4()), json={"name": ""})
    ).status_code == 422


async def test_duplicate_names_ignore_case(alice, bob):
    v = await create(alice, "Videos")
    r = await create(alice, " videos ", status=409)
    assert r["detail"]["code"] == "view_name_taken"
    other = await create(alice, "Articles", "type=article")
    r = await alice.patch(f"/api/views/{other['id']}", json={"name": "VIDEOS"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "view_name_taken"
    # another case of its own name is fine, and so is the same name on another account
    r = await alice.patch(f"/api/views/{v['id']}", json={"name": "VIDEOS"})
    assert r.status_code == 200 and r.json()["name"] == "VIDEOS"
    await create(bob, "Videos")


async def test_limit(alice, bob):
    for i in range(20):
        await create(alice, f"v{i}", f"tag=t{i}")
    r = await create(alice, "one more", status=409)
    assert r["detail"]["code"] == "views_limit"
    await create(bob, "mine")  # the limit is per account
    first = (await alice.get("/api/views")).json()[0]
    assert (await alice.delete(f"/api/views/{first['id']}")).status_code == 204
    await create(alice, "one more")


async def test_positions_are_compacted(alice):
    ids = [(await create(alice, n, f"tag={n}"))["id"] for n in "abcd"]
    r = await alice.patch(f"/api/views/{ids[3]}", json={"position": 0})
    assert r.status_code == 200 and r.json()["position"] == 0
    assert await names(alice) == ["d", "a", "b", "c"]
    await alice.patch(f"/api/views/{ids[3]}", json={"position": 99})  # clamped to the end
    assert await names(alice) == ["a", "b", "c", "d"]
    await alice.patch(f"/api/views/{ids[0]}", json={"position": 2})
    assert await names(alice) == ["b", "c", "a", "d"]
    assert (await alice.delete(f"/api/views/{ids[1]}")).status_code == 204
    assert await names(alice) == ["c", "a", "d"]
    assert (await create(alice, "e", "tag=e"))["position"] == 3
    r = await alice.patch(f"/api/views/{ids[0]}", json={"position": -1})
    assert r.status_code == 422
    # a rename alone leaves the order
    await alice.patch(f"/api/views/{ids[2]}", json={"name": "C"})
    assert await names(alice) == ["C", "a", "d", "e"]


async def test_views_are_private_to_their_owner(alice, bob):
    v = await create(alice, "Mine")
    assert await names(bob) == []
    for r in (
        await bob.patch(f"/api/views/{v['id']}", json={"name": "x"}),
        await bob.delete(f"/api/views/{v['id']}"),
        await bob.patch(f"/api/views/{uuid.uuid4()}", json={"name": "x"}),
        await bob.delete(f"/api/views/{uuid.uuid4()}"),
    ):
        assert r.status_code == 404 and r.json()["detail"]["code"] == "view_not_found"
    assert await names(alice) == ["Mine"]


async def test_requires_login():
    from tests.conftest import make_client

    async with make_client() as c:
        assert (await c.get("/api/views")).status_code == 401
