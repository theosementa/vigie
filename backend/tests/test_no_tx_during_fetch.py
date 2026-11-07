"""VISION principle 5: no outbound request while a transaction / connection is open."""

import pytest

from app.db import engine
from app.services.metadata import Metadata


@pytest.fixture
def pool_probe(monkeypatch):
    """Replace every fetch with a stub that records how many DB connections are checked out."""
    seen: list[int] = []

    async def fake(url: str) -> Metadata:
        seen.append(engine.pool.checkedout())
        return Metadata(url=url, title="t", ok=True)

    for target in (
        "app.services.items.fetch_metadata",
        "app.api.routes.items.fetch_metadata",
        "app.api.routes.resources.fetch_metadata",
    ):
        monkeypatch.setattr(target, fake)
    return seen


async def test_probe_sees_connections_when_they_are_held(alice):
    # sanity check of the probe itself: inside a request's own transaction it reads 1
    async with engine.connect() as conn:
        assert engine.pool.checkedout() == 1
        await conn.rollback()


async def test_create_item_holds_no_connection_during_fetch(alice, pool_probe):
    r = await alice.post("/api/items", json={"url": "https://example.com/new"})
    assert r.status_code == 201
    assert pool_probe == [0]


async def test_preview_holds_no_connection_during_fetch(alice, pool_probe):
    r = await alice.post("/api/resources/preview", json={"url": "https://example.com/new"})
    assert r.status_code == 200
    assert pool_probe == [0]


async def test_refresh_holds_no_connection_during_fetch(alice, pool_probe):
    item = (await alice.post("/api/items", json={"url": "https://example.com/new"})).json()
    pool_probe.clear()
    r = await alice.post(f"/api/items/{item['id']}/refresh")
    assert r.status_code == 200 and r.json()["refreshed"] is True
    assert pool_probe == [0]
    assert r.json()["item"]["resource"]["title"] == "t"


async def test_session_is_not_in_a_transaction_during_fetch(alice, monkeypatch):
    """Same property seen from the session itself."""
    from app.db import get_session
    from app.main import app

    states: list[bool] = []
    holder = {}

    async def spying_session():
        async for s in get_session():
            holder["s"] = s
            yield s

    async def fake(url: str) -> Metadata:
        states.append(holder["s"].in_transaction())
        return Metadata(url=url, title="t", ok=True)

    monkeypatch.setattr("app.services.items.fetch_metadata", fake)
    app.dependency_overrides[get_session] = spying_session
    try:
        r = await alice.post("/api/items", json={"url": "https://example.com/session"})
    finally:
        app.dependency_overrides.pop(get_session, None)
    assert r.status_code == 201
    assert states == [False]
