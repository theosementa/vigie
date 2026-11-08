import asyncio
import os
from collections.abc import AsyncIterator
from urllib.parse import urlparse

# Point the app at the test database BEFORE importing it.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://vigie:vigie@localhost:5432/vigie_test",
)
# The suite truncates tables and downgrades the schema: never let it near a real database.
_db_name = TEST_DATABASE_URL.rsplit("/", 1)[-1].split("?")[0]
if not _db_name.endswith("_test"):
    raise SystemExit(
        f"Refusing to run: TEST_DATABASE_URL points at {_db_name!r}, whose name must end with "
        "'_test' (the tests truncate every table and downgrade the schema)."
    )
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
TEST_SECRET_KEY = "test-secret-key-0123456789abcdef-0123456789abcdef"
os.environ["SECRET_KEY"] = TEST_SECRET_KEY
os.environ["REGISTRATION"] = "open"  # tests sign several users up; invite/closed set per test
os.environ.pop("PUBLIC_URL", None)
os.environ["COOKIE_SECURE"] = "false"

import asyncpg  # noqa: E402
import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

from alembic import command  # noqa: E402
from app.core.ratelimit import limiter  # noqa: E402
from app.db import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.metadata import Metadata, hostname_of  # noqa: E402

PUBLIC_IP = "93.184.216.34"


async def _ensure_database() -> None:
    url = make_url(TEST_DATABASE_URL)
    conn = await asyncpg.connect(
        user=url.username,
        password=url.password,
        host=url.host,
        port=url.port or 5432,
        database="postgres",
    )
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", url.database)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{url.database}"')
    finally:
        await conn.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _database() -> AsyncIterator[None]:
    await _ensure_database()
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
    await asyncio.to_thread(command.downgrade, cfg, "base")
    await asyncio.to_thread(command.upgrade, cfg, "head")
    yield
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables(_database: None) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE item_events, item_tags, tags, items, resources, users, "
                "instance_settings, invitations, password_resets RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture(autouse=True)
def _rate_limiter():
    """Rate limiting is off unless a test asks for it (`rate_limits` fixture)."""
    limiter.reset()
    limiter.enabled = False
    yield
    limiter.reset()
    limiter.enabled = True


@pytest.fixture
def rate_limits():
    limiter.reset()
    limiter.enabled = True


def pytest_configure(config):
    config.addinivalue_line("markers", "real_metadata: do not stub fetch_metadata")


@pytest.fixture(autouse=True)
def _fake_metadata(request, monkeypatch):
    """API tests never hit the network: metadata is stubbed unless `real_metadata` is set."""
    if request.node.get_closest_marker("real_metadata"):
        return

    async def fake(url: str) -> Metadata:
        host = urlparse(url).hostname or ""
        is_video = host == "youtube.com" or host.endswith(".youtube.com")
        return Metadata(
            url=url,
            type="video" if is_video else "article",
            title=f"Title for {url}",
            description=f"Description for {url}",
            image_url="https://img.example.com/x.jpg",
            site_name=hostname_of(url),
            duration_seconds=600 if is_video else None,
            reading_time_minutes=None if is_video else 4,
            ok=True,
        )

    monkeypatch.setattr("app.services.items.fetch_metadata", fake)
    monkeypatch.setattr("app.api.routes.items.fetch_metadata", fake)
    monkeypatch.setattr("app.api.routes.resources.fetch_metadata", fake)

    async def no_stars(url: str, **_: object) -> int | None:
        return None

    monkeypatch.setattr("app.services.stars.fetch_stars", no_stars)


def make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test", follow_redirects=False
    )


@pytest_asyncio.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    async with make_client() as c:
        yield c


async def register(c: httpx.AsyncClient, email: str, name: str | None = None) -> dict:
    first, _, last = (name or email.split("@")[0]).partition(" ")
    r = await c.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "correct horse",
            "first_name": first,
            "last_name": last or "Tester",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def set_mode(mode: str) -> None:
    """Set the instance registration mode directly in the database."""
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO instance_settings (id, registration_mode) VALUES (1, :m) "
                "ON CONFLICT (id) DO UPDATE SET registration_mode = :m"
            ),
            {"m": mode},
        )


async def sql(query: str, **params):
    """Run a statement on the test database, returning all rows (if any)."""
    async with engine.begin() as conn:
        result = await conn.execute(text(query), params)
        return list(result) if result.returns_rows else []


def signup_payload(email: str, **over) -> dict:
    return {
        "email": email,
        "password": "correct horse",
        "first_name": "Test",
        "last_name": "User",
        **over,
    }


@pytest_asyncio.fixture
async def alice() -> AsyncIterator[httpx.AsyncClient]:
    async with make_client() as c:
        c.user = await register(c, "alice@example.com", "Alice")  # type: ignore[attr-defined]
        yield c


@pytest_asyncio.fixture
async def bob() -> AsyncIterator[httpx.AsyncClient]:
    async with make_client() as c:
        c.user = await register(c, "bob@example.com", "Bob")  # type: ignore[attr-defined]
        yield c


@pytest.fixture
def public_dns(monkeypatch):
    """Every hostname resolves to a public IP; literal IPs resolve to themselves."""
    import ipaddress

    async def resolver(host: str, port: int) -> list[str]:
        try:
            ipaddress.ip_address(host)
            return [host]
        except ValueError:
            return [PUBLIC_IP]

    monkeypatch.setattr("app.services.url.resolve_host", resolver)
