"""URL normalisation and SSRF-safe fetching."""

import asyncio
import ipaddress
import re
import socket
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import httpx

from app.core.config import settings

TRACKING_PARAMS = {"fbclid", "gclid"}
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"}
_YT_ID = re.compile(r"^[A-Za-z0-9_-]{6,20}$")
_DEFAULT_PORTS = {"http": 80, "https": 443}


class InvalidUrlError(ValueError):
    pass


class FetchError(Exception):
    pass


def youtube_canonical(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def extract_youtube_id(url: str) -> str | None:
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    candidate: str | None = None
    if host == "youtu.be":
        candidate = parts.path.lstrip("/").split("/")[0]
    elif host in YOUTUBE_HOSTS:
        segments = [s for s in parts.path.split("/") if s]
        if parts.path.rstrip("/") == "/watch":
            candidate = dict(parse_qsl(parts.query)).get("v")
        elif len(segments) >= 2 and segments[0] in {"shorts", "embed", "live", "v"}:
            candidate = segments[1]
    if candidate and _YT_ID.match(candidate):
        return candidate
    return None


def normalize_url(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        raise InvalidUrlError("Empty URL")
    if "://" not in raw:
        raw = "https://" + raw
    try:
        parts = urlsplit(raw)
        host = parts.hostname
        port = parts.port
    except ValueError as exc:
        raise InvalidUrlError("Invalid URL") from exc
    scheme = parts.scheme.lower()
    if scheme not in ("http", "https") or not host:
        raise InvalidUrlError("Only http and https URLs are supported")

    yt_id = extract_youtube_id(f"{scheme}://{host.lower()}{parts.path}?{parts.query}")
    if yt_id:
        return youtube_canonical(yt_id)

    host = host.lower()
    if ":" in host:  # IPv6 literal
        host = f"[{host}]"
    netloc = host
    if port and port != _DEFAULT_PORTS[scheme]:
        netloc = f"{host}:{port}"
    query = urlencode(
        [
            (k, v)
            for k, v in parse_qsl(parts.query, keep_blank_values=True)
            if not (k.lower().startswith("utm_") or k.lower() in TRACKING_PARAMS)
        ]
    )
    path = parts.path.rstrip("/")
    return urlunsplit((scheme, netloc, path, query, ""))


# --------------------------------------------------------------------------- SSRF


def is_public_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return addr.is_global and not addr.is_multicast


Resolver = Callable[[str, int], Awaitable[list[str]]]


async def resolve_host(host: str, port: int) -> list[str]:
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise FetchError(f"Cannot resolve {host}") from exc
    return list(dict.fromkeys(info[4][0] for info in infos))


async def pick_safe_ip(host: str, port: int, resolver: Resolver) -> str:
    """Resolve host and return a public IP; refuse if ANY address is non-public."""
    ips = await resolver(host, port)
    if not ips:
        raise FetchError(f"Cannot resolve {host}")
    for ip in ips:
        if not is_public_ip(ip):
            raise FetchError("Refusing to connect to a non-public address")
    return ips[0]


@dataclass
class FetchResult:
    url: str  # final URL after redirects
    content_type: str
    text: str


def _host_header(host: str, port: int | None, scheme: str) -> str:
    h = f"[{host}]" if ":" in host else host
    return f"{h}:{port}" if port and port != _DEFAULT_PORTS[scheme] else h


async def safe_fetch(
    url: str,
    *,
    accept: str = "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5",
    resolver: Resolver | None = None,
    max_bytes: int | None = None,
    timeout: float | None = None,
    max_redirects: int | None = None,
) -> FetchResult:
    """GET a URL with SSRF protection.

    - only http/https;
    - DNS resolved here, every address must be public, and the connection is pinned to the
      resolved IP (Host header + TLS SNI carry the original hostname);
    - redirects are followed manually and re-validated at every hop;
    - the body is read in a stream and cut at `max_bytes`;
    - a single deadline covers the whole call (all hops included).
    """
    resolver = resolver or resolve_host
    max_bytes = max_bytes or settings.fetch_max_bytes
    timeout = timeout or settings.fetch_timeout_seconds
    max_redirects = settings.fetch_max_redirects if max_redirects is None else max_redirects
    try:
        async with asyncio.timeout(timeout):
            return await _fetch_loop(url, accept, resolver, max_bytes, timeout, max_redirects)
    except TimeoutError as exc:
        raise FetchError("Timeout") from exc
    except httpx.HTTPError as exc:
        raise FetchError(f"HTTP error: {type(exc).__name__}") from exc


async def _fetch_loop(
    url: str,
    accept: str,
    resolver: Resolver,
    max_bytes: int,
    timeout: float,
    max_redirects: int,
) -> FetchResult:
    current = url
    async with httpx.AsyncClient(follow_redirects=False, timeout=timeout) as client:
        for _hop in range(max_redirects + 1):
            parts = urlsplit(current)
            scheme = parts.scheme.lower()
            host = parts.hostname
            if scheme not in ("http", "https") or not host:
                raise FetchError("Unsupported URL")
            port = parts.port or _DEFAULT_PORTS[scheme]
            ip = await pick_safe_ip(host, port, resolver)

            ip_host = f"[{ip}]" if ":" in ip else ip
            pinned = urlunsplit((scheme, f"{ip_host}:{port}", parts.path or "/", parts.query, ""))
            request = client.build_request(
                "GET",
                pinned,
                headers={
                    "Host": _host_header(host, parts.port, scheme),
                    "User-Agent": "Mozilla/5.0 (compatible; RadarBot/1.0)",
                    "Accept": accept,
                    "Accept-Language": "en,fr;q=0.8",
                },
                extensions={"sni_hostname": host},
            )
            response = await client.send(request, stream=True)
            try:
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("location")
                    if not location:
                        raise FetchError("Redirect without location")
                    current = urljoin(current, location)
                    continue
                if response.status_code >= 400:
                    raise FetchError(f"HTTP {response.status_code}")
                chunks: list[bytes] = []
                size = 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > max_bytes:
                        chunks.append(chunk[: max_bytes - (size - len(chunk))])
                        break
                    chunks.append(chunk)
                body = b"".join(chunks)
                ctype = response.headers.get("content-type", "").lower()
                encoding = response.charset_encoding or "utf-8"
                try:
                    text = body.decode(encoding, errors="replace")
                except LookupError:
                    text = body.decode("utf-8", errors="replace")
                return FetchResult(url=current, content_type=ctype, text=text)
            finally:
                await response.aclose()
    raise FetchError("Too many redirects")
