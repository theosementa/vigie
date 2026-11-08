"""Star counts of repositories (GitHub, GitLab, Codeberg), fetched from their public APIs.

A count goes stale, so the library refreshes the ones older than `STARS_TTL` when it is listed.
Nothing here ever raises: a failed lookup keeps the previous count.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from urllib.parse import quote, urlsplit

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Item
from app.services.url import FetchError, safe_fetch

log = logging.getLogger(__name__)

REPO_HOSTS = ("github.com", "gitlab.com", "codeberg.org")
STARS_TTL = timedelta(hours=6)
RETRY_AFTER = timedelta(minutes=15)  # after a failed lookup, try again sooner than the TTL
MAX_PER_REQUEST = 10
BUDGET_SECONDS = 3.0


def repo_slug(url: str) -> tuple[str, str, str] | None:
    """`(host, owner, repo)` of `host/<owner>/<repo>`; deeper pages are not repositories."""
    parts = urlsplit(url)
    host = (parts.hostname or "").removeprefix("www.")
    if host not in REPO_HOSTS:
        return None
    segments = [p for p in parts.path.split("/") if p]
    if len(segments) != 2:
        return None
    return host, segments[0], segments[1].removesuffix(".git")


def _api_url(host: str, owner: str, repo: str) -> tuple[str, str]:
    """The API endpoint of a repository and the JSON field holding its stars."""
    if host == "github.com":
        return f"https://api.github.com/repos/{quote(owner)}/{quote(repo)}", "stargazers_count"
    if host == "gitlab.com":
        return (
            f"https://gitlab.com/api/v4/projects/{quote(f'{owner}/{repo}', safe='')}",
            "star_count",
        )
    return f"https://codeberg.org/api/v1/repos/{quote(owner)}/{quote(repo)}", "stars_count"


async def fetch_stars(url: str, *, timeout: float = BUDGET_SECONDS) -> int | None:
    slug = repo_slug(url)
    if slug is None:
        return None
    api, field = _api_url(*slug)
    try:
        res = await safe_fetch(api, accept="application/json", timeout=timeout)
        value = json.loads(res.text).get(field)
    except (FetchError, ValueError, AttributeError) as exc:
        log.info("stars lookup failed for %s: %s", url, exc)
        return None
    return value if isinstance(value, int) and value >= 0 else None


def is_stale(stars_fetched_at: datetime | None, now: datetime) -> bool:
    return stars_fetched_at is None or now - stars_fetched_at > STARS_TTL


async def refresh_stale_stars(session: AsyncSession, items: list[Item]) -> None:
    """Refresh, in place, the star counts of the repositories among `items` that went stale.

    At most `MAX_PER_REQUEST` per call, in parallel and within `BUDGET_SECONDS`, so a library
    full of old repositories fills in over a few visits instead of blocking one. No transaction
    is held while the network is used.
    """
    now = datetime.now().astimezone()
    stale = {}
    for item in items:
        r = item.resource
        if (item.type_override or r.type) != "repo" or repo_slug(r.url) is None:
            continue
        if is_stale(r.stars_fetched_at, now):
            stale.setdefault(r.id, r)
    targets = list(stale.values())[:MAX_PER_REQUEST]
    if not targets:
        return

    await session.commit()  # release the connection: nothing is held during the lookups
    counts = await asyncio.gather(*(fetch_stars(r.url) for r in targets))
    done = datetime.now().astimezone()
    for resource, stars in zip(targets, counts, strict=True):
        if stars is not None:
            resource.stars = stars
            resource.stars_fetched_at = done
        else:  # keep the previous count and try again soon
            resource.stars_fetched_at = done - (STARS_TTL - RETRY_AFTER)
    session.add_all(targets)
    await session.commit()
