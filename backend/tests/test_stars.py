from datetime import timedelta

from sqlalchemy import update

from app.db import SessionLocal
from app.models import Resource
from app.services import stars as stars_service
from app.services.stars import fetch_stars, repo_slug

REPO = "https://github.com/owner/repo"


def test_repo_slug():
    assert repo_slug(REPO) == ("github.com", "owner", "repo")
    assert repo_slug("https://www.gitlab.com/o/r.git") == ("gitlab.com", "o", "r")
    assert repo_slug("https://github.com/owner/repo/issues") is None
    assert repo_slug("https://example.com/owner/repo") is None


async def _repo_item(client, url=REPO):
    item = (await client.post("/api/items", json={"url": url, "type": "repo"})).json()
    return item


async def _stars(client):
    return {
        i["resource"]["url"]: i["resource"]["stars"]
        for i in (await client.get("/api/items")).json()["items"]
    }


async def test_stale_repo_stars_are_refreshed_on_listing(alice, monkeypatch):
    calls: list[str] = []

    async def fake(url: str, **_: object) -> int | None:
        calls.append(url)
        return 120

    monkeypatch.setattr(stars_service, "fetch_stars", fake)
    await _repo_item(alice)
    assert (await _stars(alice))[REPO] == 120
    # fresh now: a second visit does not hit the network again
    assert (await _stars(alice))[REPO] == 120
    assert calls == [REPO]


async def test_stars_older_than_the_ttl_are_refetched(alice, monkeypatch):
    values = iter([10, 25])

    async def fake(url: str, **_: object) -> int | None:
        return next(values)

    monkeypatch.setattr(stars_service, "fetch_stars", fake)
    await _repo_item(alice)
    assert (await _stars(alice))[REPO] == 10
    async with SessionLocal() as s:
        await s.execute(
            update(Resource).values(
                stars_fetched_at=Resource.stars_fetched_at
                - stars_service.STARS_TTL
                - timedelta(minutes=1)
            )
        )
        await s.commit()
    assert (await _stars(alice))[REPO] == 25


async def test_a_failed_lookup_keeps_the_previous_count(alice, monkeypatch):
    answers = iter([77, None])

    async def fake(url: str, **_: object) -> int | None:
        return next(answers)

    monkeypatch.setattr(stars_service, "fetch_stars", fake)
    await _repo_item(alice)
    assert (await _stars(alice))[REPO] == 77
    async with SessionLocal() as s:
        await s.execute(
            update(Resource).values(
                stars_fetched_at=Resource.stars_fetched_at
                - stars_service.STARS_TTL
                - timedelta(minutes=1)
            )
        )
        await s.commit()
    assert (await _stars(alice))[REPO] == 77


async def test_non_repositories_are_left_alone(alice, monkeypatch):
    async def boom(url: str, **_: object) -> int | None:
        raise AssertionError("no lookup expected")

    monkeypatch.setattr(stars_service, "fetch_stars", boom)
    await alice.post("/api/items", json={"url": "https://example.com/post"})
    assert (await _stars(alice))["https://example.com/post"] is None


async def test_fetch_stars_ignores_non_repository_urls():
    assert await fetch_stars("https://example.com/a/b") is None
