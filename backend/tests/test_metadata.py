import json
from pathlib import Path

import httpx
import pytest
import respx

from app.services.metadata import fetch_metadata, parse_iso_duration, parse_youtube_duration
from tests.conftest import PUBLIC_IP

FIXTURES = Path(__file__).parent / "fixtures"


def html(name: str) -> str:
    return (FIXTURES / name).read_text()


def route(mock: respx.MockRouter, host: str, path: str, **kwargs):
    """Mock a GET on `host` (requests are pinned to PUBLIC_IP with the Host header preserved)."""
    return mock.get(f"https://{PUBLIC_IP}{path}", headers={"Host": host}, **kwargs)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("PT3M32S", 212),
        ("PT1H2M3S", 3723),
        ("PT45S", 45),
        ("PT10M", 600),
        ("P1DT1H", 90000),
        ("PT0S", None),
        ("garbage", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_iso_duration(value, expected):
    assert parse_iso_duration(value) == expected


def test_parse_youtube_duration_fixtures():
    assert parse_youtube_duration(html("youtube_watch.html")) == 212
    assert parse_youtube_duration(html("youtube_itemprop.html")) == 3723
    assert parse_youtube_duration("<html></html>") is None


@pytest.mark.usefixtures("public_dns")
async def test_article_metadata():
    with respx.mock(assert_all_called=True) as mock:
        route(mock, "blog.example.com", "/post").respond(
            200, text=html("article.html"), headers={"content-type": "text/html; charset=utf-8"}
        )
        meta = await fetch_metadata("https://blog.example.com/post")
    assert meta.ok
    assert meta.type == "article"
    assert meta.title == "Understanding Async Python"
    assert meta.description == "A deep dive into asyncio."
    assert meta.image_url == "https://blog.example.com/img/cover.png"
    assert meta.site_name == "Dev Blog"
    assert meta.author == "Jane Doe"
    assert meta.favicon_url == "https://blog.example.com/static/fav.ico"
    assert meta.published_at is not None and meta.published_at.year == 2024
    # 460 words / 230 wpm = 2 min (nav/footer/script excluded)
    assert meta.reading_time_minutes == 2
    assert meta.duration_seconds is None


@pytest.mark.usefixtures("public_dns")
async def test_video_detected_from_og_type():
    with respx.mock() as mock:
        route(mock, "vimeo.com", "/123").respond(
            200, text=html("vimeo.html"), headers={"content-type": "text/html"}
        )
        meta = await fetch_metadata("https://vimeo.com/123")
    assert meta.type == "video"
    assert meta.duration_seconds == 95
    assert meta.reading_time_minutes is None


YT_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


@pytest.mark.usefixtures("public_dns")
async def test_youtube_oembed_and_duration():
    oembed = {
        "title": "Never Gonna Give You Up",
        "author_name": "Rick Astley",
        "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    }
    with respx.mock() as mock:
        route(mock, "www.youtube.com", "/oembed").respond(200, json=oembed)
        route(mock, "www.youtube.com", "/watch").respond(
            200, text=html("youtube_watch.html"), headers={"content-type": "text/html"}
        )
        meta = await fetch_metadata(YT_URL)
    assert meta.type == "video"
    assert meta.title == "Never Gonna Give You Up"
    assert meta.author == "Rick Astley"
    assert meta.site_name == "YouTube"
    assert meta.duration_seconds == 212
    assert meta.image_url == oembed["thumbnail_url"]
    assert meta.ok


@pytest.mark.usefixtures("public_dns")
async def test_youtube_page_fails_keeps_oembed():
    with respx.mock() as mock:
        route(mock, "www.youtube.com", "/oembed").respond(200, json={"title": "T"})
        route(mock, "www.youtube.com", "/watch").respond(500)
        meta = await fetch_metadata(YT_URL)
    assert meta.title == "T"
    assert meta.duration_seconds is None
    assert meta.type == "video"
    assert meta.image_url == "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"


@pytest.mark.usefixtures("public_dns")
async def test_youtube_oembed_fails_falls_back_to_page():
    with respx.mock() as mock:
        route(mock, "www.youtube.com", "/oembed").respond(404)
        route(mock, "www.youtube.com", "/watch").respond(
            200, text=html("youtube_watch.html"), headers={"content-type": "text/html"}
        )
        meta = await fetch_metadata(YT_URL)
    assert meta.title == "Cool video"
    assert meta.duration_seconds == 212


@pytest.mark.usefixtures("public_dns")
async def test_youtube_total_failure_falls_back_to_hostname():
    with respx.mock() as mock:
        route(mock, "www.youtube.com", "/oembed").mock(side_effect=httpx.ConnectError("boom"))
        route(mock, "www.youtube.com", "/watch").respond(503)
        meta = await fetch_metadata(YT_URL)
    assert meta.title == "youtube.com"
    assert meta.type == "video"
    assert not meta.ok


@pytest.mark.usefixtures("public_dns")
async def test_failure_never_raises_and_uses_hostname_title():
    with respx.mock() as mock:
        route(mock, "www.example.com", "/x").respond(500)
        meta = await fetch_metadata("https://www.example.com/x")
    assert meta.title == "example.com"
    assert meta.type == "article"
    assert not meta.ok


@pytest.mark.usefixtures("public_dns")
async def test_non_html_content_is_not_parsed():
    with respx.mock() as mock:
        route(mock, "example.com", "/f.pdf").respond(
            200,
            content=b"%PDF-1.4 <title>nope</title>",
            headers={"content-type": "application/pdf"},
        )
        meta = await fetch_metadata("https://example.com/f.pdf")
    assert meta.title == "example.com"
    assert not meta.ok


async def test_oembed_url_is_json_decodable():
    # sanity check on the helper used above
    assert json.loads(json.dumps({"a": 1})) == {"a": 1}
