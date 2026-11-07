import pytest

from app.core.ratelimit import RateLimiter
from tests.conftest import make_client, signup_payload

pytestmark = pytest.mark.usefixtures("rate_limits")


def assert_limited(r):
    assert r.status_code == 429, r.text
    assert r.json()["detail"]["code"] == "rate_limited"
    assert int(r.headers["retry-after"]) >= 1


def test_sliding_window_and_bounded_memory(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr("app.core.ratelimit.time.monotonic", lambda: now[0])
    lim = RateLimiter(max_keys=3)
    assert [lim.hit("k", 2, 10) for _ in range(2)] == [None, None]
    assert lim.hit("k", 2, 10) == 10
    now[0] += 4
    assert lim.hit("k", 2, 10) == 6
    now[0] += 6.1
    assert lim.hit("k", 2, 10) is None  # window slid
    assert lim.hit("k", 5, 10, cost=9) is not None  # cost above the limit is refused
    for i in range(20):
        lim.hit(f"other{i}", 1, 10)
    assert len(lim._hits) <= 3


async def test_login_per_ip(client):
    for i in range(10):
        r = await client.post(
            "/api/auth/login", json={"email": f"u{i}@example.com", "password": "x"}
        )
        assert r.status_code == 401
    assert_limited(
        await client.post("/api/auth/login", json={"email": "u@example.com", "password": "x"})
    )


async def test_login_per_email(client):
    for _ in range(5):
        r = await client.post("/api/auth/login", json={"email": "a@example.com", "password": "x"})
        assert r.status_code == 401
    assert_limited(
        await client.post("/api/auth/login", json={"email": "A@example.com", "password": "x"})
    )
    # another email is unaffected
    other = await client.post("/api/auth/login", json={"email": "b@example.com", "password": "x"})
    assert other.status_code == 401


async def test_register_per_ip(client):
    for i in range(5):
        r = await client.post("/api/auth/register", json=signup_payload(f"u{i}@example.com"))
        assert r.status_code == 201
    assert_limited(await client.post("/api/auth/register", json=signup_payload("z@example.com")))


async def test_reset_per_ip(client):
    for _ in range(5):
        r = await client.post(
            "/api/auth/reset", json={"token": "bad", "password": "long enough pw"}
        )
        assert r.status_code == 400
    assert_limited(
        await client.post("/api/auth/reset", json={"token": "bad", "password": "long enough pw"})
    )


async def test_password_change_per_user(alice, bob):
    body = {"current_password": "wrong", "new_password": "brand new pass"}
    for _ in range(5):
        assert (await alice.post("/api/auth/password", json=body)).status_code == 403
    assert_limited(await alice.post("/api/auth/password", json=body))
    assert (await bob.post("/api/auth/password", json=body)).status_code == 403  # per user


async def test_item_create_per_user(alice):
    for i in range(60):
        r = await alice.post("/api/items", json={"url": f"https://example.com/{i}"})
        assert r.status_code == 201
    assert_limited(await alice.post("/api/items", json={"url": "https://example.com/over"}))


async def test_preview_and_refresh_per_user(alice):
    item = (await alice.post("/api/items", json={"url": "https://example.com/a"})).json()
    for _ in range(60):
        assert (
            await alice.post("/api/resources/preview", json={"url": "https://example.com/p"})
        ).status_code == 200
    assert_limited(
        await alice.post("/api/resources/preview", json={"url": "https://example.com/p"})
    )
    for _ in range(60):
        assert (await alice.post(f"/api/items/{item['id']}/refresh")).status_code == 200
    assert_limited(await alice.post(f"/api/items/{item['id']}/refresh"))


async def test_share_50_a_day_counts_recipients(alice):
    item = (await alice.post("/api/items", json={"url": "https://example.com/a"})).json()
    path = f"/api/items/{item['id']}/share"
    emails = [f"nobody{i}@example.com" for i in range(50)]
    assert (await alice.post(path, json={"emails": emails})).status_code == 200
    assert_limited(await alice.post(path, json={"emails": ["one-more@example.com"]}))


async def test_limits_are_per_process_state_that_tests_can_reset(client):
    from app.core.ratelimit import limiter

    for _ in range(5):
        await client.post("/api/auth/login", json={"email": "a@example.com", "password": "x"})
    limiter.reset()
    r = await client.post("/api/auth/login", json={"email": "a@example.com", "password": "x"})
    assert r.status_code == 401
    async with make_client() as c:  # same client IP in tests: shares the IP bucket
        assert (
            await c.post("/api/auth/login", json={"email": "c@example.com", "password": "x"})
        ).status_code == 401
