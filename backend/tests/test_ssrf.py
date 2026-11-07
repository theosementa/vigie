import asyncio

import pytest
import respx

from app.services.metadata import fetch_metadata
from app.services.url import FetchError, safe_fetch
from tests.conftest import PUBLIC_IP


def route(mock, host, path, **kwargs):
    return mock.get(f"https://{PUBLIC_IP}{path}", headers={"Host": host}, **kwargs)


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/",
        "http://127.0.0.1:8000/api/health",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.5/admin",
        "http://192.168.1.1/",
        "http://172.16.5.5/",
        "http://[::1]/",
        "http://[::ffff:10.0.0.1]/",
        "http://localhost/",
        "http://2130706433/",  # decimal form of 127.0.0.1
        "http://0.0.0.0/",
    ],
)
async def test_private_targets_refused(url):
    with respx.mock(assert_all_called=False) as mock:
        catch_all = mock.route().respond(200, text="secret")
        with pytest.raises(FetchError):
            await safe_fetch(url)
        assert not catch_all.called  # no request ever left


async def test_non_http_scheme_refused():
    with pytest.raises(FetchError):
        await safe_fetch("file:///etc/passwd")
    with pytest.raises(FetchError):
        await safe_fetch("ftp://example.com/x")


async def test_hostname_resolving_to_private_ip_refused(monkeypatch):
    async def resolver(host, port):
        return ["10.0.0.7"]

    with respx.mock(assert_all_called=False) as mock:
        catch_all = mock.route().respond(200)
        with pytest.raises(FetchError):
            await safe_fetch("https://evil.example.com/", resolver=resolver)
        assert not catch_all.called


async def test_mixed_public_and_private_resolution_refused():
    async def resolver(host, port):
        return [PUBLIC_IP, "127.0.0.1"]

    with pytest.raises(FetchError):
        await safe_fetch("https://rebind.example.com/", resolver=resolver)


async def test_connection_is_pinned_to_resolved_ip(public_dns):
    with respx.mock() as mock:
        r = route(mock, "example.com", "/ok").respond(
            200, text="hi", headers={"content-type": "text/plain"}
        )
        res = await safe_fetch("https://example.com/ok")
    assert res.text == "hi"
    request = r.calls.last.request
    assert request.url.host == PUBLIC_IP
    assert request.headers["host"] == "example.com"
    assert request.extensions["sni_hostname"] == "example.com"


async def test_redirect_to_private_ip_is_blocked(public_dns):
    with respx.mock(assert_all_called=False) as mock:
        route(mock, "example.com", "/r").respond(
            302, headers={"location": "http://169.254.169.254/"}
        )
        internal = mock.get("http://169.254.169.254/").respond(200, text="creds")
        with pytest.raises(FetchError):
            await safe_fetch("https://example.com/r")
        assert not internal.called


async def test_redirect_to_hostname_resolving_privately_is_blocked(monkeypatch):
    async def resolver(host, port):
        return [PUBLIC_IP] if host == "example.com" else ["10.0.0.1"]

    monkeypatch.setattr("app.services.url.resolve_host", resolver)
    with respx.mock(assert_all_called=False) as mock:
        route(mock, "example.com", "/r").respond(
            302, headers={"location": "https://intranet.corp/x"}
        )
        with pytest.raises(FetchError):
            await safe_fetch("https://example.com/r")


async def test_relative_redirect_followed(public_dns):
    with respx.mock() as mock:
        route(mock, "example.com", "/a").respond(301, headers={"location": "/b"})
        route(mock, "example.com", "/b").respond(
            200, text="done", headers={"content-type": "text/plain"}
        )
        res = await safe_fetch("https://example.com/a")
    assert res.text == "done"
    assert res.url == "https://example.com/b"


async def test_max_three_redirects(public_dns):
    with respx.mock(assert_all_called=False) as mock:
        for i in range(6):
            route(mock, "example.com", f"/{i}").respond(302, headers={"location": f"/{i + 1}"})
        with pytest.raises(FetchError, match="redirects"):
            await safe_fetch("https://example.com/0")
    # exactly 3 redirects is fine
    with respx.mock() as mock:
        for i in range(3):
            route(mock, "example.com", f"/{i}").respond(302, headers={"location": f"/{i + 1}"})
        route(mock, "example.com", "/3").respond(
            200, text="ok", headers={"content-type": "text/plain"}
        )
        assert (await safe_fetch("https://example.com/0")).text == "ok"


async def test_size_cap_enforced_while_streaming(public_dns):
    body = b"a" * 10_000
    with respx.mock() as mock:
        route(mock, "example.com", "/big").respond(
            200, content=body, headers={"content-type": "text/html"}
        )
        res = await safe_fetch("https://example.com/big", max_bytes=1000)
    assert len(res.text) == 1000


async def test_timeout_honoured(public_dns):
    async def slow(request):
        await asyncio.sleep(2)

    with respx.mock(assert_all_called=False) as mock:
        route(mock, "example.com", "/slow").mock(side_effect=slow)
        loop = asyncio.get_running_loop()
        start = loop.time()
        with pytest.raises(FetchError, match="Timeout"):
            await safe_fetch("https://example.com/slow", timeout=0.2)
        assert loop.time() - start < 1.5


async def test_metadata_for_private_url_falls_back_without_raising():
    meta = await fetch_metadata("http://127.0.0.1:8000/secret")
    assert meta.title == "127.0.0.1"
    assert not meta.ok
