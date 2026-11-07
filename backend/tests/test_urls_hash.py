from app.services.url import normalize_url, url_hash
from tests.conftest import sql


async def test_url_longer_than_2048_is_rejected(alice):
    long_url = "https://example.com/" + "a" * 2040
    assert len(long_url) > 2048
    assert (await alice.post("/api/items", json={"url": long_url})).status_code == 422
    assert (await alice.post("/api/resources/preview", json={"url": long_url})).status_code == 422
    ok = "https://example.com/" + "a" * 2028
    assert len(ok) == 2048
    assert (await alice.post("/api/items", json={"url": ok})).status_code == 201


async def test_resources_are_deduplicated_on_url_hash(alice, bob):
    a = (await alice.post("/api/items", json={"url": "https://Example.com/p/?utm_source=x"})).json()
    b = (await bob.post("/api/items", json={"url": "https://example.com/p"})).json()
    assert a["resource"]["id"] == b["resource"]["id"]
    rows = await sql("SELECT url, url_hash FROM resources")
    assert len(rows) == 1
    assert rows[0].url_hash == url_hash(normalize_url("https://example.com/p"))
    assert len(rows[0].url_hash) == 64


async def test_url_column_has_no_unique_index_but_hash_does():
    rows = await sql(
        "SELECT indexdef FROM pg_indexes WHERE tablename = 'resources' AND indexdef LIKE '%UNIQUE%'"
    )
    defs = " ".join(r.indexdef for r in rows)
    assert "(url_hash)" in defs and "(url)" not in defs
