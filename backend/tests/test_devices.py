import asyncio
import json

import jwt

from app.core.config import settings
from app.services import realtime
from app.services.sessions import describe_device
from tests.conftest import make_client, sql

PW = "correct horse"
IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
)
MAC_CHROME = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)


async def _login(ua: str = MAC_CHROME):
    c = make_client()
    r = await c.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": PW},
        headers={"user-agent": ua},
    )
    assert r.status_code == 200, r.text
    return c


def _sid(c) -> str:
    return jwt.decode(c.cookies[settings.cookie_name], settings.secret_key, algorithms=["HS256"])[
        "sid"
    ]


def test_describe_device():
    assert describe_device(IPHONE) == "Safari · iPhone"
    assert describe_device(MAC_CHROME) == "Chrome · Mac"
    assert describe_device("") == "Unknown device"
    assert describe_device(None) == "Unknown device"


async def test_each_login_is_a_device_and_the_list_marks_the_current_one(alice):
    phone = await _login(IPHONE)
    rows = (await phone.get("/api/auth/sessions")).json()
    assert len(rows) == 2
    current = [r for r in rows if r["current"]]
    assert len(current) == 1 and current[0]["id"] == _sid(phone)
    assert current[0]["device"] == "Safari · iPhone"
    # the other device sees the same list, with itself marked
    mine = [r for r in (await alice.get("/api/auth/sessions")).json() if r["current"]]
    assert mine[0]["id"] == _sid(alice)
    await phone.aclose()


async def test_revoking_a_device_signs_it_out_but_not_the_caller(alice):
    phone = await _login(IPHONE)
    r = await alice.delete(f"/api/auth/sessions/{_sid(phone)}")
    assert r.status_code == 204
    assert (await phone.get("/api/auth/me")).status_code == 401
    assert (await alice.get("/api/auth/me")).status_code == 200
    assert len((await alice.get("/api/auth/sessions")).json()) == 1
    await phone.aclose()


async def test_revoking_the_current_device_clears_the_cookie(alice):
    r = await alice.delete(f"/api/auth/sessions/{_sid(alice)}")
    assert r.status_code == 204
    assert (await alice.get("/api/auth/me")).status_code == 401


async def test_cannot_revoke_someone_elses_device(alice, bob):
    r = await alice.delete(f"/api/auth/sessions/{_sid(bob)}")
    assert r.status_code == 404
    assert (await bob.get("/api/auth/me")).status_code == 200


async def test_logout_removes_only_this_device(alice):
    phone = await _login(IPHONE)
    assert (await phone.post("/api/auth/logout")).status_code == 204
    assert len(await sql("SELECT 1 FROM sessions")) == 1
    assert (await alice.get("/api/auth/me")).status_code == 200
    await phone.aclose()


async def test_logout_all_removes_every_device(alice):
    phone = await _login(IPHONE)
    assert (await alice.post("/api/auth/logout-all")).status_code == 204
    assert await sql("SELECT 1 FROM sessions") == []
    assert (await phone.get("/api/auth/me")).status_code == 401
    await phone.aclose()


async def test_password_change_keeps_only_the_caller_device(alice):
    phone = await _login(IPHONE)
    r = await alice.post(
        "/api/auth/password", json={"current_password": PW, "new_password": "brand new pass"}
    )
    assert r.status_code == 204
    rows = await sql("SELECT id FROM sessions")
    assert [str(x.id) for x in rows] == [_sid(alice)]
    assert (await alice.get("/api/auth/me")).status_code == 200
    assert (await phone.get("/api/auth/me")).status_code == 401
    await phone.aclose()


async def test_deleting_the_account_deletes_its_devices(alice):
    r = await alice.request("DELETE", "/api/auth/me", json={"password": PW})
    assert r.status_code == 204
    assert await sql("SELECT 1 FROM sessions") == []


async def test_last_seen_is_throttled_but_refreshed_when_old(alice):
    before = (await sql("SELECT last_seen_at FROM sessions"))[0].last_seen_at
    await alice.get("/api/auth/me")
    assert (await sql("SELECT last_seen_at FROM sessions"))[0].last_seen_at == before
    await sql("UPDATE sessions SET last_seen_at = now() - interval '1 hour'")
    await alice.get("/api/auth/me")
    rows = await sql("SELECT now() - last_seen_at AS age FROM sessions")
    assert rows[0].age.total_seconds() < 60


# ---------- live updates ----------


def _drain(sub: realtime.Subscriber) -> list[tuple[str, dict]]:
    out = []
    while not sub.queue.empty():
        ev = sub.queue.get_nowait()
        out.append((ev.name, json.loads(ev.data)))
    return out


async def test_stream_requires_a_session(client):
    assert (await client.get("/api/stream")).status_code == 401


async def test_a_write_on_one_device_notifies_the_others(alice):
    phone = await _login(IPHONE)
    uid = alice.user["id"]
    import uuid

    sub = realtime.subscribe(uuid.UUID(uid), uuid.UUID(_sid(phone)))
    try:
        r = await alice.post("/api/items", json={"url": "https://example.com/a"})
        assert r.status_code == 201
        events = _drain(sub)
        assert events and events[0][0] == "sync"
        assert {"items", "queue"} <= set(events[0][1]["topics"])
        # reads do not notify
        await alice.get("/api/items")
        assert _drain(sub) == []
        # a failed write does not notify either
        missing = "00000000-0000-0000-0000-000000000000"
        assert (await alice.delete(f"/api/items/{missing}")).status_code == 404
        assert _drain(sub) == []
        # a preference change notifies with the "me" topic
        await alice.patch("/api/auth/me", json={"mobile_layout": "grid"})
        assert "me" in _drain(sub)[0][1]["topics"]
    finally:
        realtime.unsubscribe(sub)
        await phone.aclose()


async def test_other_users_are_not_notified(alice, bob):
    import uuid

    sub = realtime.subscribe(uuid.UUID(bob.user["id"]), uuid.uuid4())
    try:
        await alice.post("/api/items", json={"url": "https://example.com/a"})
        assert _drain(sub) == []
    finally:
        realtime.unsubscribe(sub)


async def test_sharing_notifies_the_recipient(alice, bob):
    import uuid

    item = (await alice.post("/api/items", json={"url": "https://example.com/a"})).json()
    sub = realtime.subscribe(uuid.UUID(bob.user["id"]), uuid.uuid4())
    try:
        r = await alice.post(f"/api/items/{item['id']}/share", json={"emails": ["bob@example.com"]})
        assert r.status_code == 200
        assert "items" in _drain(sub)[0][1]["topics"]
    finally:
        realtime.unsubscribe(sub)


async def test_revoking_a_device_sends_revoked_to_its_stream(alice):
    import uuid

    phone = await _login(IPHONE)
    sub = realtime.subscribe(uuid.UUID(alice.user["id"]), uuid.UUID(_sid(phone)))
    try:
        await alice.delete(f"/api/auth/sessions/{_sid(phone)}")
        assert "revoked" in [name for name, _ in _drain(sub)]
    finally:
        realtime.unsubscribe(sub)
        await phone.aclose()


async def test_event_stream_formats_and_closes_on_revoked():
    import uuid

    from app.api.routes.stream import event_stream

    sub = realtime.subscribe(uuid.uuid4(), uuid.uuid4())
    chunks = []

    async def consume():
        async for chunk in event_stream(sub):
            chunks.append(chunk)

    task = asyncio.create_task(consume())
    await asyncio.sleep(0.05)
    realtime.publish(sub.user_id, ["items"])
    realtime.revoke([sub.session_id])
    await asyncio.wait_for(task, 2)
    joined = "".join(chunks)
    assert "event: ready" in joined
    assert 'event: sync\ndata: {"topics": ["items"]}' in joined
    assert "event: revoked" in joined
    assert realtime.subscriber_count(sub.user_id) == 0  # unsubscribed on exit
