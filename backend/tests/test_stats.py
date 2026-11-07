import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import text

from app.db import engine
from tests.conftest import make_client, register

# Wednesday 2026-03-18 12:00 UTC: week = Mon 2026-03-16 .. Mon 2026-03-23
NOW = datetime(2026, 3, 18, 12, 0, tzinfo=UTC)


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC)


@pytest.fixture
def frozen(monkeypatch):
    monkeypatch.setattr("app.services.stats._now", lambda: NOW)


async def add(c, url, **extra):
    r = await c.post("/api/items", json={"url": url, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def run(sql: str, **params) -> None:
    async with engine.begin() as conn:
        await conn.execute(text(sql), params)


async def set_event_time(kind: str, item: dict, ts: datetime) -> None:
    await run(
        "UPDATE item_events SET occurred_at = :ts WHERE kind = :k AND item_id = CAST(:i AS uuid)",
        ts=ts,
        k=kind,
        i=item["id"],
    )


async def set_added(item: dict, ts: datetime) -> None:
    await run("UPDATE items SET created_at = :ts WHERE id = CAST(:i AS uuid)", ts=ts, i=item["id"])
    await set_event_time("added", item, ts)


async def set_seen(item: dict, ts: datetime) -> None:
    """Mark the item seen through the API, then move the seen time to `ts`."""
    r = await item["_client"].patch(f"/api/items/{item['id']}", json={"status": "seen"})
    assert r.status_code == 200
    await run("UPDATE items SET seen_at = :ts WHERE id = CAST(:i AS uuid)", ts=ts, i=item["id"])
    await set_event_time("seen", item, ts)


async def seen_item(c, url, ts: datetime, **extra) -> dict:
    item = await add(c, url, **extra)
    item["_client"] = c
    await set_seen(item, ts)
    return item


async def insert_events(user_id: str, resource_id: str, kind: str, *stamps: datetime) -> None:
    for ts in stamps:
        await run(
            "INSERT INTO item_events (id, user_id, item_id, resource_id, kind, occurred_at) "
            "VALUES (CAST(:id AS uuid), CAST(:u AS uuid), CAST(:it AS uuid), CAST(:r AS uuid), "
            ":k, :ts)",
            id=str(uuid.uuid4()),
            u=user_id,
            it=str(uuid.uuid4()),
            r=resource_id,
            k=kind,
            ts=ts,
        )


async def summary(c, **params):
    r = await c.get("/api/stats/summary", params=params)
    assert r.status_code == 200, r.text
    return r.json()


async def series(c, **params):
    r = await c.get("/api/stats/timeseries", params=params)
    assert r.status_code == 200, r.text
    return r.json()


YT = "https://www.youtube.com/watch?v="  # fake metadata: video, 600 s
BLOG = "https://blog.example.com/"  # fake metadata: article, 4 min


# --- auth / isolation ---------------------------------------------------------------------------


async def test_requires_session(client):
    assert (await client.get("/api/stats/summary")).status_code == 401
    r = await client.get(
        "/api/stats/timeseries",
        params={"metric": "seen", "granularity": "day", "from": "2026-03-01", "to": "2026-03-02"},
    )
    assert r.status_code == 401


async def test_empty_summary(alice, frozen):
    s = await summary(alice)
    zero = {
        "articles_read": 0,
        "videos_seen": 0,
        "items_added": 0,
        "watch_seconds": 0,
        "reading_minutes": 0,
    }
    assert s["period"] == "week" and s["offset"] == 0 and s["timezone"] == "UTC"
    assert s["start"] == "2026-03-16" and s["end"] == "2026-03-23"
    assert s["current"] == zero and s["previous"] == zero
    assert s["top_tags"] == [] and s["top_sources"] == []
    assert s["shares"] == {"sent": 0, "received": 0, "by_user": []}
    assert s["streak"] == {"current": 0, "best": 0}
    assert s["videos_without_duration"] == 0


async def test_user_isolation(alice, bob, frozen):
    await seen_item(alice, BLOG + "a", utc(2026, 3, 17, 9), tags=["python"])
    await seen_item(alice, YT + "a", utc(2026, 3, 17, 10))
    s = await summary(bob)
    assert s["current"]["articles_read"] == 0 and s["current"]["videos_seen"] == 0
    assert s["top_tags"] == [] and s["streak"] == {"current": 0, "best": 0}
    pts = (
        await series(
            bob, metric="seen", granularity="day", **{"from": "2026-03-16", "to": "2026-03-18"}
        )
    )["points"]
    assert [p["value"] for p in pts] == [0, 0, 0]
    mine = await summary(alice)
    assert mine["current"]["articles_read"] == 1 and mine["current"]["videos_seen"] == 1


# --- summary: periods ---------------------------------------------------------------------------


async def test_summary_week_current_and_previous(alice, frozen):
    # current week (Mon 16 .. Sun 22)
    a1 = await seen_item(alice, BLOG + "a1", utc(2026, 3, 16, 0, 0))  # first instant of the week
    a2 = await seen_item(alice, BLOG + "a2", utc(2026, 3, 22, 23, 59))  # last minute of the week
    v1 = await seen_item(alice, YT + "v1", utc(2026, 3, 18, 8))
    # previous week
    a3 = await seen_item(alice, BLOG + "a3", utc(2026, 3, 15, 23, 59))
    v2 = await seen_item(alice, YT + "v2", utc(2026, 3, 10, 8))
    v3 = await seen_item(alice, YT + "v3", utc(2026, 3, 11, 8))
    # outside both
    await seen_item(alice, BLOG + "old", utc(2026, 3, 8, 23, 59))
    await seen_item(alice, BLOG + "future", utc(2026, 3, 23, 0, 0))
    # still to_watch: never counted as seen
    await add(alice, BLOG + "todo")

    for item, ts in ((a1, utc(2026, 3, 16, 7)), (a2, utc(2026, 3, 20)), (v1, utc(2026, 3, 18))):
        await set_added(item, ts)
    for item in (a3, v2, v3):
        await set_added(item, utc(2026, 3, 12))

    s = await summary(alice, period="week")
    assert s["current"] == {
        "articles_read": 2,
        "videos_seen": 1,
        "items_added": 3,
        "watch_seconds": 600,
        "reading_minutes": 8,
    }
    assert s["previous"] == {
        "articles_read": 1,
        "videos_seen": 2,
        "items_added": 3,
        "watch_seconds": 1200,
        "reading_minutes": 4,
    }
    assert (s["start"], s["end"]) == ("2026-03-16", "2026-03-23")

    s = await summary(alice, period="week", offset=-1)
    assert (s["start"], s["end"], s["offset"]) == ("2026-03-09", "2026-03-16", -1)
    assert s["current"]["articles_read"] == 1 and s["current"]["videos_seen"] == 2
    assert s["current"]["watch_seconds"] == 1200
    # previous of last week = the week of 2 March: only the 8 March item
    assert s["previous"]["articles_read"] == 1 and s["previous"]["videos_seen"] == 0


async def test_summary_month_and_year_bounds(alice, frozen):
    await seen_item(alice, BLOG + "mar", utc(2026, 3, 1, 0, 0))
    await seen_item(alice, BLOG + "feb1", utc(2026, 2, 28, 23, 59))
    await seen_item(alice, BLOG + "feb2", utc(2026, 2, 1))
    await seen_item(alice, BLOG + "dec", utc(2025, 12, 31, 23))
    await seen_item(alice, YT + "jan", utc(2026, 1, 15))

    s = await summary(alice, period="month")
    assert (s["start"], s["end"]) == ("2026-03-01", "2026-04-01")
    assert s["current"]["articles_read"] == 1
    assert s["previous"]["articles_read"] == 2

    s = await summary(alice, period="month", offset=-2)
    assert (s["start"], s["end"]) == ("2026-01-01", "2026-02-01")
    assert s["current"]["videos_seen"] == 1
    assert s["previous"]["articles_read"] == 1  # December 2025

    s = await summary(alice, period="month", offset=-3)  # crosses the year boundary
    assert (s["start"], s["end"]) == ("2025-12-01", "2026-01-01")

    s = await summary(alice, period="year")
    assert (s["start"], s["end"]) == ("2026-01-01", "2027-01-01")
    assert s["current"]["articles_read"] == 3 and s["current"]["videos_seen"] == 1
    assert s["previous"]["articles_read"] == 1 and s["previous"]["videos_seen"] == 0

    s = await summary(alice, period="year", offset=-1)
    assert (s["start"], s["end"]) == ("2025-01-01", "2026-01-01")
    assert s["current"]["articles_read"] == 1


async def test_summary_validation(alice):
    assert (await alice.get("/api/stats/summary", params={"period": "day"})).status_code == 422
    assert (await alice.get("/api/stats/summary", params={"offset": 1})).status_code == 422
    assert (await alice.get("/api/stats/summary", params={"offset": "x"})).status_code == 422


async def test_type_override_is_the_effective_type(alice, frozen):
    # article by detection, overridden to video for this user: counted as a video without duration
    await seen_item(alice, BLOG + "x", utc(2026, 3, 17), type="video")
    # video by detection, overridden to article: no watch time
    await seen_item(alice, YT + "y", utc(2026, 3, 17), type="article")
    s = await summary(alice)
    assert s["current"]["videos_seen"] == 1 and s["current"]["articles_read"] == 1
    assert s["current"]["watch_seconds"] == 0
    assert s["videos_without_duration"] == 1


# --- timezone -----------------------------------------------------------------------------------


async def test_timezone_boundary_in_summary(alice, frozen):
    # Sunday 15 March 23:30 UTC = Monday 16 March 00:30 in Paris (UTC+1)
    await seen_item(alice, BLOG + "late", utc(2026, 3, 15, 23, 30))
    s = await summary(alice)
    assert s["current"]["articles_read"] == 0 and s["previous"]["articles_read"] == 1

    await alice.patch("/api/auth/me", json={"timezone": "Europe/Paris"})
    s = await summary(alice)
    assert s["timezone"] == "Europe/Paris"
    assert s["current"]["articles_read"] == 1 and s["previous"]["articles_read"] == 0


async def test_timezone_boundary_in_timeseries(alice):
    await seen_item(alice, BLOG + "late", utc(2026, 3, 10, 23, 30))
    await seen_item(alice, BLOG + "early", utc(2026, 3, 10, 22, 30))
    params = {"metric": "seen", "granularity": "day", "from": "2026-03-10", "to": "2026-03-12"}

    pts = (await series(alice, **params))["points"]
    assert [(p["bucket"], p["value"]) for p in pts] == [
        ("2026-03-10", 2),
        ("2026-03-11", 0),
        ("2026-03-12", 0),
    ]

    await alice.patch("/api/auth/me", json={"timezone": "Europe/Paris"})
    body = await series(alice, **params)
    assert body["timezone"] == "Europe/Paris"
    assert [(p["bucket"], p["value"]) for p in body["points"]] == [
        ("2026-03-10", 1),  # 22:30 UTC = 23:30 Paris
        ("2026-03-11", 1),  # 23:30 UTC = 00:30 Paris, next day
        ("2026-03-12", 0),
    ]


async def test_today_is_computed_in_the_user_timezone(alice, monkeypatch):
    # 2026-03-18 23:30 UTC is already Thursday 19 March in Paris
    monkeypatch.setattr("app.services.stats._now", lambda: utc(2026, 3, 18, 23, 30))
    assert (await summary(alice))["start"] == "2026-03-16"
    await alice.patch("/api/auth/me", json={"timezone": "Pacific/Auckland"})  # +13: 19 March 12:30
    assert (await summary(alice))["start"] == "2026-03-16"
    # Sunday 22 March 23:30 UTC: still last week in UTC, already the next one in Paris
    monkeypatch.setattr("app.services.stats._now", lambda: utc(2026, 3, 22, 23, 30))
    await alice.patch("/api/auth/me", json={"timezone": "UTC"})
    assert (await summary(alice))["start"] == "2026-03-16"
    await alice.patch("/api/auth/me", json={"timezone": "Europe/Paris"})
    assert (await summary(alice))["start"] == "2026-03-23"


# --- summary: tops, shares, durations -----------------------------------------------------------


async def test_tops(alice, frozen):
    when = utc(2026, 3, 17)
    for i in range(3):
        await seen_item(alice, f"https://a.example.com/{i}", when, tags=["python", "Rust"])
    await seen_item(alice, "https://b.example.com/1", when, tags=["python"])
    await seen_item(alice, "https://b.example.com/2", when, tags=["go"])
    await seen_item(alice, "https://c.example.com/1", when, tags=["go"])
    await seen_item(alice, "https://d.example.com/1", when, tags=["a", "b", "c"])
    # not counted: seen outside the period, still to_watch
    await seen_item(alice, "https://z.example.com/1", utc(2026, 3, 1), tags=["python", "old"])
    await add(alice, "https://z.example.com/2", tags=["python", "todo"])

    s = await summary(alice)
    assert s["top_tags"] == [
        {"name": "python", "count": 4},
        {"name": "Rust", "count": 3},
        {"name": "go", "count": 2},
        {"name": "a", "count": 1},
        {"name": "b", "count": 1},
    ]
    assert s["top_sources"] == [
        {"site_name": "a.example.com", "count": 3},
        {"site_name": "b.example.com", "count": 2},
        {"site_name": "c.example.com", "count": 1},
        {"site_name": "d.example.com", "count": 1},
    ]


async def test_shares_sent_and_received(alice, bob):
    async with make_client() as carol:
        await register(carol, "carol@example.com", "Carol")
        one = await add(alice, "https://example.com/1")
        two = await add(alice, "https://example.com/2")
        three = await add(carol, "https://example.com/3")
        for item in (one, two):
            await alice.post(f"/api/items/{item['id']}/share", json={"emails": ["bob@example.com"]})
        await alice.post(f"/api/items/{one['id']}/share", json={"emails": ["carol@example.com"]})
        await carol.post(f"/api/items/{three['id']}/share", json={"emails": ["bob@example.com"]})

        b = await summary(bob, period="week")
        assert b["shares"]["sent"] == 0 and b["shares"]["received"] == 3
        assert b["shares"]["by_user"] == [
            {"user_id": alice.user["id"], "first_name": "Alice", "last_name": "Tester", "count": 2},
            {
                "user_id": (await carol.get("/api/auth/me")).json()["id"],
                "first_name": "Carol",
                "last_name": "Tester",
                "count": 1,
            },
        ]
        assert b["current"]["items_added"] == 3  # shared items are added to the library

        a = await summary(alice, period="week")
        assert a["shares"]["sent"] == 3  # 2 to bob, 1 to carol
        assert a["shares"]["received"] == 0 and a["shares"]["by_user"] == []

        c = await summary(carol, period="week")
        assert c["shares"]["sent"] == 1 and c["shares"]["received"] == 1
        assert c["shares"]["by_user"][0]["first_name"] == "Alice"

        # shares only count in the period they happened in
        last_week = await summary(alice, period="week", offset=-1)
        assert last_week["shares"] == {"sent": 0, "received": 0, "by_user": []}


# --- streak -------------------------------------------------------------------------------------


async def streak_user(alice) -> str:
    item = await add(alice, BLOG + "seed")
    return item["resource"]["id"]


async def test_streak_current_and_best(alice, frozen):
    rid = await streak_user(alice)
    # island of 4 days (1-4 March), island of 3 days ending today (16-18), duplicates same day
    await insert_events(
        alice.user["id"],
        rid,
        "seen",
        *(utc(2026, 3, d, 9) for d in (1, 2, 3, 4)),
        utc(2026, 3, 3, 18),
        *(utc(2026, 3, d, 9) for d in (16, 17, 18)),
    )
    assert (await summary(alice))["streak"] == {"current": 3, "best": 4}


async def test_streak_counts_when_last_active_day_is_yesterday(alice, frozen):
    rid = await streak_user(alice)
    await insert_events(alice.user["id"], rid, "seen", *(utc(2026, 3, d, 9) for d in (15, 16, 17)))
    assert (await summary(alice))["streak"] == {"current": 3, "best": 3}


async def test_streak_broken_when_last_active_day_is_older(alice, frozen):
    rid = await streak_user(alice)
    await insert_events(alice.user["id"], rid, "seen", *(utc(2026, 3, d, 9) for d in (14, 15, 16)))
    assert (await summary(alice))["streak"] == {"current": 0, "best": 3}


async def test_streak_uses_local_days(alice, frozen):
    rid = await streak_user(alice)
    # UTC days 15, 16 and 17 at 23:30 -> Paris days 16, 17 and 18 (today)
    await insert_events(
        alice.user["id"], rid, "seen", *(utc(2026, 3, d, 23, 30) for d in (15, 16, 17))
    )
    await alice.patch("/api/auth/me", json={"timezone": "Europe/Paris"})
    assert (await summary(alice))["streak"] == {"current": 3, "best": 3}
    # in UTC the same events are on days 15-17: the last one is yesterday, still a current streak
    await alice.patch("/api/auth/me", json={"timezone": "UTC"})
    assert (await summary(alice))["streak"] == {"current": 3, "best": 3}


async def test_streak_one_utc_day_can_be_two_local_days(alice, frozen):
    rid = await streak_user(alice)
    await insert_events(
        alice.user["id"], rid, "seen", utc(2026, 3, 17, 22, 30), utc(2026, 3, 17, 23, 30)
    )
    assert (await summary(alice))["streak"] == {"current": 1, "best": 1}
    await alice.patch("/api/auth/me", json={"timezone": "Europe/Paris"})  # 23:30 and 00:30 (18th)
    assert (await summary(alice))["streak"] == {"current": 2, "best": 2}


async def test_streak_unseen_same_day_does_not_count(alice, frozen):
    await seen_item(alice, BLOG + "today", utc(2026, 3, 18, 8))
    yesterday = await seen_item(alice, BLOG + "yday", utc(2026, 3, 17, 8))
    assert (await summary(alice))["streak"] == {"current": 2, "best": 2}

    # un-see yesterday's item: the unseen event is dated "now" in real life, put it on that day
    await alice.patch(f"/api/items/{yesterday['id']}", json={"status": "to_watch"})
    await run(
        "UPDATE item_events SET occurred_at = :ts WHERE kind = 'unseen'", ts=utc(2026, 3, 17, 9)
    )
    assert (await summary(alice))["streak"] == {"current": 1, "best": 1}

    # seen again the same day: counts again
    await alice.patch(f"/api/items/{yesterday['id']}", json={"status": "seen"})
    await run(
        "UPDATE item_events SET occurred_at = :ts WHERE kind = 'seen' AND occurred_at > :after",
        ts=utc(2026, 3, 17, 10),
        after=datetime.now(UTC) - timedelta(minutes=5),
    )
    assert (await summary(alice))["streak"] == {"current": 2, "best": 2}


async def test_streak_survives_deletion(alice, frozen):
    item = await seen_item(alice, BLOG + "a", utc(2026, 3, 18, 8))
    assert (await alice.delete(f"/api/items/{item['id']}")).status_code == 204
    # the item is gone but the day was active
    assert (await summary(alice))["streak"] == {"current": 1, "best": 1}
    # ... while the library-based counters no longer include it
    assert (await summary(alice))["current"]["articles_read"] == 0


# --- videos without duration --------------------------------------------------------------------


async def test_videos_without_duration(alice, frozen):
    await seen_item(alice, YT + "ok", utc(2026, 3, 17))
    await seen_item(alice, BLOG + "novid1", utc(2026, 3, 17), type="video")
    await seen_item(alice, BLOG + "novid2", utc(2026, 3, 18), type="video")
    await seen_item(alice, BLOG + "oldvid", utc(2026, 3, 1), type="video")  # other period
    await add(alice, BLOG + "todo", type="video")  # not seen
    s = await summary(alice)
    assert s["videos_without_duration"] == 2
    assert s["current"]["videos_seen"] == 3 and s["current"]["watch_seconds"] == 600


# --- timeseries ---------------------------------------------------------------------------------


async def test_timeseries_seen_zero_filled_with_split(alice):
    await seen_item(alice, BLOG + "a", utc(2026, 3, 10, 9))
    await seen_item(alice, BLOG + "b", utc(2026, 3, 10, 18))
    await seen_item(alice, YT + "c", utc(2026, 3, 10, 20))
    await seen_item(alice, YT + "d", utc(2026, 3, 13, 20))
    await seen_item(alice, BLOG + "outside", utc(2026, 3, 14, 0, 0))

    body = await series(
        alice, metric="seen", granularity="day", **{"from": "2026-03-09", "to": "2026-03-13"}
    )
    assert body["metric"] == "seen" and body["granularity"] == "day" and body["timezone"] == "UTC"
    assert body["points"] == [
        {"bucket": "2026-03-09", "value": 0, "articles": 0, "videos": 0},
        {"bucket": "2026-03-10", "value": 3, "articles": 2, "videos": 1},
        {"bucket": "2026-03-11", "value": 0, "articles": 0, "videos": 0},
        {"bucket": "2026-03-12", "value": 0, "articles": 0, "videos": 0},
        {"bucket": "2026-03-13", "value": 1, "articles": 0, "videos": 1},
    ]


async def test_timeseries_added_and_watch_time_have_no_split(alice):
    a = await add(alice, YT + "a")
    b = await add(alice, BLOG + "b")
    await set_added(a, utc(2026, 3, 10, 9))
    await set_added(b, utc(2026, 3, 12, 9))
    await seen_item(alice, YT + "v1", utc(2026, 3, 11, 9))
    await seen_item(alice, YT + "v2", utc(2026, 3, 11, 10))
    await seen_item(alice, BLOG + "art", utc(2026, 3, 11, 11))

    params = {"granularity": "day", "from": "2026-03-10", "to": "2026-03-12"}
    added = await series(alice, metric="added", **params)
    # the items created by seen_item() were added "now", outside the range
    assert added["points"] == [
        {"bucket": "2026-03-10", "value": 1},
        {"bucket": "2026-03-11", "value": 0},
        {"bucket": "2026-03-12", "value": 1},
    ]

    watch = await series(alice, metric="watch_time", **params)
    assert watch["points"] == [
        {"bucket": "2026-03-10", "value": 0},
        {"bucket": "2026-03-11", "value": 1200},
        {"bucket": "2026-03-12", "value": 0},
    ]


async def test_timeseries_week_and_month_buckets(alice):
    await seen_item(alice, BLOG + "a", utc(2026, 3, 8, 23, 59))  # Sunday: week of 2 March
    await seen_item(alice, BLOG + "b", utc(2026, 3, 9, 0, 0))  # Monday: week of 9 March
    await seen_item(alice, BLOG + "c", utc(2026, 3, 15, 12))
    await seen_item(alice, YT + "d", utc(2026, 4, 2))

    # `from` in the middle of a week: the bucket starts on the Monday before
    body = await series(
        alice, metric="seen", granularity="week", **{"from": "2026-03-04", "to": "2026-03-17"}
    )
    assert [(p["bucket"], p["value"]) for p in body["points"]] == [
        ("2026-03-02", 1),
        ("2026-03-09", 2),
        ("2026-03-16", 0),
    ]

    body = await series(
        alice, metric="seen", granularity="month", **{"from": "2026-02-10", "to": "2026-05-01"}
    )
    assert [(p["bucket"], p["value"]) for p in body["points"]] == [
        ("2026-02-01", 0),
        ("2026-03-01", 3),
        ("2026-04-01", 1),
        ("2026-05-01", 0),
    ]
    assert body["points"][3] == {"bucket": "2026-05-01", "value": 0, "articles": 0, "videos": 0}


async def test_timeseries_backlog(alice):
    base = await add(alice, BLOG + "base")
    one = await add(alice, BLOG + "one")
    two = await add(alice, BLOG + "two")
    three = await add(alice, BLOG + "three")
    await set_added(base, utc(2026, 3, 1, 9))  # before the range: part of the starting balance
    await set_added(one, utc(2026, 3, 10, 9))
    await set_added(two, utc(2026, 3, 10, 10))
    await set_added(three, utc(2026, 3, 12, 9))

    one["_client"] = alice
    await set_seen(one, utc(2026, 3, 11, 9))  # -1
    # `three` is deleted while to_watch (-1); `one` is deleted while seen (no change)
    assert (await alice.delete(f"/api/items/{three['id']}")).status_code == 204
    assert (await alice.delete(f"/api/items/{one['id']}")).status_code == 204
    await set_event_time("deleted", three, utc(2026, 3, 13, 9))
    await set_event_time("deleted", one, utc(2026, 3, 14, 9))
    # `two` goes seen then back to to_watch on the 15th (-1 then +1 the same day)
    two["_client"] = alice
    await set_seen(two, utc(2026, 3, 15, 8))
    await alice.patch(f"/api/items/{two['id']}", json={"status": "to_watch"})
    await set_event_time("unseen", two, utc(2026, 3, 15, 9))

    body = await series(
        alice, metric="backlog", granularity="day", **{"from": "2026-03-09", "to": "2026-03-16"}
    )
    assert [(p["bucket"], p["value"]) for p in body["points"]] == [
        ("2026-03-09", 1),  # base
        ("2026-03-10", 3),  # + one, two
        ("2026-03-11", 2),  # one seen
        ("2026-03-12", 3),  # + three
        ("2026-03-13", 2),  # three deleted
        ("2026-03-14", 2),  # one (seen) deleted: unchanged
        ("2026-03-15", 2),  # two seen then unseen
        ("2026-03-16", 2),
    ]
    assert all("articles" not in p for p in body["points"])

    # week granularity: balance at the END of each week
    body = await series(
        alice, metric="backlog", granularity="week", **{"from": "2026-03-02", "to": "2026-03-16"}
    )
    assert [(p["bucket"], p["value"]) for p in body["points"]] == [
        ("2026-03-02", 1),
        ("2026-03-09", 2),
        ("2026-03-16", 2),
    ]


async def test_timeseries_backlog_matches_library(alice):
    """Without any manual date tweaking, the last backlog point equals the to_watch count."""
    a = await add(alice, BLOG + "a")
    await add(alice, BLOG + "b")
    c = await add(alice, BLOG + "c", status="seen")
    await alice.patch(f"/api/items/{a['id']}", json={"status": "seen"})
    await alice.patch(f"/api/items/{a['id']}", json={"status": "to_watch"})
    await alice.delete(f"/api/items/{c['id']}")
    today = datetime.now(UTC).date().isoformat()
    body = await series(
        alice,
        metric="backlog",
        granularity="month",
        **{"from": date(2020, 1, 1).isoformat(), "to": today},
    )
    to_watch = (await alice.get("/api/items", params={"status": "to_watch"})).json()["items"]
    assert body["points"][-1]["value"] == len(to_watch) == 2


async def test_timeseries_validation(alice):
    base = {"metric": "seen", "granularity": "day"}
    r = await alice.get(
        "/api/stats/timeseries", params={**base, "from": "2026-03-10", "to": "2026-03-09"}
    )
    assert r.status_code == 422

    # exactly 400 daily buckets is fine, 401 is not
    ok = await alice.get(
        "/api/stats/timeseries", params={**base, "from": "2025-01-01", "to": "2026-02-04"}
    )
    assert ok.status_code == 200 and len(ok.json()["points"]) == 400
    too_many = await alice.get(
        "/api/stats/timeseries", params={**base, "from": "2025-01-01", "to": "2026-02-05"}
    )
    assert too_many.status_code == 422

    for bad in (
        {"metric": "nope", "granularity": "day", "from": "2026-03-01", "to": "2026-03-02"},
        {"metric": "seen", "granularity": "hour", "from": "2026-03-01", "to": "2026-03-02"},
        {"metric": "seen", "granularity": "day", "from": "x", "to": "2026-03-02"},
        {"metric": "seen", "granularity": "day", "to": "2026-03-02"},
    ):
        assert (await alice.get("/api/stats/timeseries", params=bad)).status_code == 422
