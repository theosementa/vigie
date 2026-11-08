import pytest

from app.services.items import effective_length_seconds, length_bucket
from tests.conftest import sql


@pytest.mark.parametrize(
    ("item_type", "duration", "reading", "expected"),
    [
        ("video", 754, None, 754),
        ("podcast", 3000, None, 3000),
        ("article", None, 7, 420),
        ("article", 900, 7, 420),  # a stray duration never counts for an article
        ("video", None, 7, None),  # a reading time never counts for a video
        ("video", None, None, None),
        ("article", None, None, None),
        ("repo", 600, 4, None),
        ("website", 600, 4, None),
    ],
)
def test_effective_length_seconds(item_type, duration, reading, expected):
    assert effective_length_seconds(item_type, duration, reading) == expected


@pytest.mark.parametrize(
    ("seconds", "expected"),
    [
        (0, "short"),
        (599, "short"),
        (600, "medium"),
        (1800, "medium"),
        (1801, "long"),
        (None, None),
    ],
)
def test_length_bucket(seconds, expected):
    assert length_bucket(seconds) == expected


async def add(c, url, **extra):
    r = await c.post("/api/items", json={"url": url, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def set_lengths(item, *, duration=None, reading=None):
    await sql(
        "UPDATE resources SET duration_seconds = :d, reading_time_minutes = :r "
        "WHERE id = (SELECT resource_id FROM items WHERE id = CAST(:i AS uuid))",
        d=duration,
        r=reading,
        i=item["id"],
    )


async def ids(c, **params):
    r = await c.get("/api/items", params={"limit": 100, **params})
    assert r.status_code == 200, r.text
    return r.json()


async def seed(c):
    """One item per boundary and per kind of unknown, keyed by a readable name."""
    specs = {
        "v599": ("https://www.youtube.com/watch?v=v599", dict(duration=599)),
        "v600": ("https://www.youtube.com/watch?v=v600", dict(duration=600)),
        "v1800": ("https://www.youtube.com/watch?v=v1800", dict(duration=1800)),
        "v1801": ("https://www.youtube.com/watch?v=v1801", dict(duration=1801)),
        "vnone": ("https://www.youtube.com/watch?v=vnone", dict()),
        "a5": ("https://example.com/a5", dict(reading=5)),
        "a30": ("https://example.com/a30", dict(reading=30)),
        "a31": ("https://example.com/a31", dict(reading=31)),
        "anone": ("https://example.com/anone", dict()),
    }
    by_name = {}
    for name, (url, lengths) in specs.items():
        item = await add(c, url)
        await set_lengths(item, **lengths)
        by_name[item["id"]] = name
    site = await add(c, "https://example.com/site", type="website")
    await set_lengths(site, duration=100, reading=1)
    by_name[site["id"]] = "site"
    return by_name


def names(body, by_name):
    return {by_name[i["id"]] for i in body["items"]}


async def test_length_filter_buckets(alice):
    by_name = await seed(alice)
    short = await ids(alice, length="short")
    assert names(short, by_name) == {"v599", "a5"}
    medium = await ids(alice, length="medium")
    assert names(medium, by_name) == {"v600", "v1800", "a30"}
    long_ = await ids(alice, length="long")
    assert names(long_, by_name) == {"v1801", "a31"}
    # vnone, anone and the website are left out of every bucket
    assert short["length_unknown"] == medium["length_unknown"] == long_["length_unknown"] == 3


async def test_length_unknown_is_null_without_the_filter(alice):
    await seed(alice)
    assert (await ids(alice))["length_unknown"] is None


async def test_length_uses_the_type_override(alice):
    by_name = await seed(alice)
    article = next(i for i, n in by_name.items() if n == "a5")
    # an article turned into a video has no duration: it moves to the unknown ones
    r = await alice.patch(f"/api/items/{article}", json={"type": "video"})
    assert r.status_code == 200
    body = await ids(alice, length="short")
    assert names(body, by_name) == {"v599"}
    assert body["length_unknown"] == 4


async def test_length_unknown_follows_the_other_filters(alice):
    by_name = await seed(alice)
    body = await ids(alice, length="short", type="video")
    assert names(body, by_name) == {"v599"}
    assert body["length_unknown"] == 1  # only vnone
    body = await ids(alice, length="short", type="website")
    assert body["items"] == []
    assert body["length_unknown"] == 1


async def test_length_unknown_ignores_pagination(alice):
    await seed(alice)
    first = await ids(alice, length="medium", limit=1)
    assert first["next_cursor"]
    second = await ids(alice, length="medium", limit=1, cursor=first["next_cursor"])
    assert first["length_unknown"] == second["length_unknown"] == 3


async def test_length_rejects_unknown_bucket(alice):
    r = await alice.get("/api/items", params={"length": "huge"})
    assert r.status_code == 422


async def test_length_is_account_isolated(alice, bob):
    mine = await add(alice, "https://www.youtube.com/watch?v=mine")
    await add(alice, "https://example.com/unknown-mine", type="website")
    theirs = await add(bob, "https://www.youtube.com/watch?v=theirs")
    await set_lengths(mine, duration=60)
    await set_lengths(theirs, duration=60)
    body = await ids(alice, length="short")
    assert [i["id"] for i in body["items"]] == [mine["id"]]
    assert body["length_unknown"] == 1
    bob_body = await ids(bob, length="short")
    assert [i["id"] for i in bob_body["items"]] == [theirs["id"]]
    assert bob_body["length_unknown"] == 0
