"""Metadata extraction (OpenGraph, YouTube oEmbed, reading time). Never raises."""

import json
import logging
import math
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.parse import quote, urljoin, urlsplit

from selectolax.lexbor import LexborHTMLParser as HTMLParser

from app.services.url import FetchError, extract_youtube_id, safe_fetch

log = logging.getLogger(__name__)

WORDS_PER_MINUTE = 230
_ISO_DURATION = re.compile(r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$")
_LENGTH_SECONDS = re.compile(r'"lengthSeconds"\s*:\s*"(\d+)"')
_VIDEO_HOSTS = ("vimeo.com", "dailymotion.com", "twitch.tv")


@dataclass
class Metadata:
    url: str
    type: str = "article"
    title: str = ""
    description: str | None = None
    image_url: str | None = None
    site_name: str | None = None
    favicon_url: str | None = None
    author: str | None = None
    duration_seconds: int | None = None
    reading_time_minutes: int | None = None
    published_at: datetime | None = None
    ok: bool = False  # False = fallback only (nothing could be fetched)


_REPO_HOSTS = ("github.com", "gitlab.com", "codeberg.org")


def _is_repo(url: str) -> bool:
    """`host/<owner>/<repo>` on GitHub, GitLab or Codeberg; deeper pages are articles."""
    parts = urlsplit(url)
    if (parts.hostname or "").removeprefix("www.") not in _REPO_HOSTS:
        return False
    return len([p for p in parts.path.split("/") if p]) == 2


def hostname_of(url: str) -> str:
    host = urlsplit(url).hostname or url
    return host.removeprefix("www.")


def parse_iso_duration(value: str | None) -> int | None:
    if not value:
        return None
    m = _ISO_DURATION.match(value.strip())
    if not m or not any(m.groups()):
        return None
    days, hours, minutes, seconds = m.groups()
    total = (
        int(days or 0) * 86400
        + int(hours or 0) * 3600
        + int(minutes or 0) * 60
        + math.floor(float(seconds or 0))
    )
    return total or None


def _meta(tree: HTMLParser, *names: str) -> str | None:
    for name in names:
        for attr in ("property", "name", "itemprop"):
            node = tree.css_first(f'meta[{attr}="{name}"]')
            if node is not None:
                content = (node.attributes.get("content") or "").strip()
                if content:
                    return content
    return None


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _reading_time(tree: HTMLParser) -> int | None:
    root = tree.css_first("article") or tree.css_first("main") or tree.body
    if root is None:
        return None
    for node in root.css("script, style, noscript, nav, footer, header"):
        node.decompose()
    words = len(root.text(separator=" ").split())
    if words < 50:
        return None
    return max(1, round(words / WORDS_PER_MINUTE))


def parse_html(html: str, page_url: str, meta: Metadata) -> None:
    """Fill `meta` from an HTML document (only overriding empty fields for the base data)."""
    tree = HTMLParser(html)
    title = _meta(tree, "og:title", "twitter:title")
    if not title:
        node = tree.css_first("title")
        title = node.text().strip() if node else None
    if title:
        meta.title = " ".join(title.split())
    meta.description = _meta(tree, "og:description", "twitter:description", "description")
    image = _meta(tree, "og:image", "og:image:url", "twitter:image", "twitter:image:src")
    if image:
        meta.image_url = urljoin(page_url, image)
    meta.site_name = _meta(tree, "og:site_name", "application-name") or meta.site_name
    meta.author = _meta(tree, "author", "article:author") or meta.author
    meta.published_at = _parse_datetime(
        _meta(tree, "article:published_time", "datePublished", "og:published_time")
    )

    icon = None
    for node in tree.css("link[rel]"):
        rel = (node.attributes.get("rel") or "").lower().split()
        if "icon" in rel and node.attributes.get("href"):
            icon = node.attributes["href"]
            break
    meta.favicon_url = urljoin(page_url, icon) if icon else urljoin(page_url, "/favicon.ico")

    og_type = (_meta(tree, "og:type") or "").lower()
    host = hostname_of(page_url)
    if og_type.startswith("video") or any(host.endswith(h) for h in _VIDEO_HOSTS):
        meta.type = "video"
    duration = parse_iso_duration(_meta(tree, "duration", "video:duration"))
    if duration is None:
        raw = _meta(tree, "og:video:duration", "video:duration")
        if raw and raw.isdigit():
            duration = int(raw)
    if duration:
        meta.duration_seconds = duration
        meta.type = "video"
    if meta.type == "article":
        if _is_repo(page_url):
            meta.type = "repo"
            meta.site_name = meta.site_name or "GitHub"
        elif urlsplit(page_url).path.strip("/") == "":  # a home page, not a post
            meta.type = "website"
        else:
            meta.reading_time_minutes = _reading_time(tree)


def parse_youtube_duration(html: str) -> int | None:
    m = _LENGTH_SECONDS.search(html)
    if m:
        value = int(m.group(1))
        if value > 0:
            return value
    tree = HTMLParser(html)
    return parse_iso_duration(_meta(tree, "duration"))


async def _fetch_youtube(url: str, video_id: str, meta: Metadata) -> None:
    meta.type = "video"
    meta.site_name = "YouTube"
    meta.favicon_url = "https://www.youtube.com/favicon.ico"
    meta.image_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    try:
        res = await safe_fetch(
            f"https://www.youtube.com/oembed?url={quote(url, safe='')}&format=json",
            accept="application/json",
        )
        data = json.loads(res.text)
        meta.title = data.get("title") or meta.title
        meta.author = data.get("author_name") or meta.author
        meta.image_url = data.get("thumbnail_url") or meta.image_url
        meta.ok = bool(meta.title)
    except (FetchError, ValueError, AttributeError) as exc:
        log.info("youtube oembed failed for %s: %s", url, exc)

    try:
        page = await safe_fetch(url)
        meta.duration_seconds = parse_youtube_duration(page.text)
        if not meta.title:
            page_meta = Metadata(url=url)
            parse_html(page.text, page.url, page_meta)
            if page_meta.title:
                meta.title = page_meta.title
                meta.description = page_meta.description
                meta.ok = True
        elif meta.description is None:
            tree = HTMLParser(page.text)
            meta.description = _meta(tree, "og:description", "description")
        if meta.duration_seconds:
            meta.ok = True
    except FetchError as exc:
        log.info("youtube page fetch failed for %s: %s", url, exc)


async def fetch_metadata(url: str) -> Metadata:
    """Best-effort metadata. Any failure degrades to a hostname title."""
    meta = Metadata(url=url, title=hostname_of(url))
    try:
        video_id = extract_youtube_id(url)
        if video_id:
            meta.title = ""
            await _fetch_youtube(url, video_id, meta)
        else:
            res = await safe_fetch(url)
            if "html" in res.content_type or not res.content_type:
                parse_html(res.text, res.url, meta)
                meta.ok = True
    except FetchError as exc:
        log.info("metadata fetch failed for %s: %s", url, exc)
    except Exception:  # never block item creation
        log.exception("unexpected metadata failure for %s", url)
    if not meta.title:
        meta.title = hostname_of(url)
    return meta
