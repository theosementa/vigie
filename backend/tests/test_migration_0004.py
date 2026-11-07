import asyncio
import hashlib
import os
import uuid
from datetime import UTC, datetime

from alembic.config import Config
from sqlalchemy import text

from alembic import command
from app.db import engine


def _cfg() -> Config:
    root = os.path.join(os.path.dirname(__file__), "..")
    cfg = Config(os.path.join(root, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(root, "alembic"))
    return cfg


async def test_0004_upgrades_a_populated_0003_database():
    cfg = _cfg()
    await asyncio.to_thread(command.downgrade, cfg, "0003")

    users = {
        "old@example.com": ("Ada Lovelace King", datetime(2026, 1, 1, tzinfo=UTC)),
        "mono@example.com": ("Madonna", datetime(2026, 2, 1, tzinfo=UTC)),
        "blank@example.com": ("", datetime(2026, 3, 1, tzinfo=UTC)),
        "long@example.com": ("A" * 30 + " " + "B" * 69, datetime(2026, 4, 1, tzinfo=UTC)),
        "long2@example.com": ("A" * 70 + " " + "B" * 20, datetime(2026, 5, 1, tzinfo=UTC)),
    }
    ids = {e: uuid.uuid4() for e in users}
    res_id, item_id = uuid.uuid4(), uuid.uuid4()
    url = "https://example.com/" + "x" * 3000  # longer than a btree entry would like
    async with engine.begin() as conn:
        for email, (name, created) in users.items():
            await conn.execute(
                text(
                    "INSERT INTO users (id, email, password_hash, display_name, created_at) "
                    "VALUES (:i, :e, 'h', :n, :c)"
                ),
                {"i": ids[email], "e": email, "n": name, "c": created},
            )
        await conn.execute(
            text("INSERT INTO resources (id, url, type, title) VALUES (:i, :u, 'article', 't')"),
            {"i": res_id, "u": url},
        )
        await conn.execute(
            text(
                "INSERT INTO items (id, user_id, resource_id, status) "
                "VALUES (:i, :u, :r, 'to_watch')"
            ),
            {"i": item_id, "u": ids["old@example.com"], "r": res_id},
        )

    await asyncio.to_thread(command.upgrade, cfg, "head")

    async with engine.connect() as conn:
        rows = {
            r.email: r
            for r in await conn.execute(
                text("SELECT email, first_name, last_name, role, token_version FROM users")
            )
        }
        res = (await conn.execute(text("SELECT url, url_hash FROM resources"))).one()
        item = (await conn.execute(text("SELECT id FROM items"))).all()
        tables = {
            r[0]
            for r in await conn.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
            )
        }
        cols = {
            r[0]
            for r in await conn.execute(
                text("SELECT column_name FROM information_schema.columns WHERE table_name='users'")
            )
        }

    assert (rows["old@example.com"].first_name, rows["old@example.com"].last_name) == (
        "Ada",
        "Lovelace King",
    )
    assert (rows["mono@example.com"].first_name, rows["mono@example.com"].last_name) == (
        "Madonna",
        "",
    )
    assert rows["blank@example.com"].first_name == "blank"  # falls back to the email local part
    assert len(rows["long@example.com"].last_name) == 50  # truncated to the new limit
    assert len(rows["long2@example.com"].first_name) == 50
    # the oldest account of an existing instance becomes its admin
    assert {e: r.role for e, r in rows.items()} == {
        "old@example.com": "admin",
        "mono@example.com": "user",
        "blank@example.com": "user",
        "long@example.com": "user",
        "long2@example.com": "user",
    }
    assert all(r.token_version == 0 for r in rows.values())
    assert "display_name" not in cols
    assert {"instance_settings", "invitations", "password_resets"} <= tables
    assert res.url == url
    assert res.url_hash == hashlib.sha256(url.encode()).hexdigest()
    assert len(item) == 1  # data kept


async def test_0004_downgrade_restores_display_name_then_reupgrades():
    cfg = _cfg()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, first_name, last_name) "
                "VALUES (gen_random_uuid(), 'a@example.com', 'h', 'Ada', 'Lovelace')"
            )
        )
    await asyncio.to_thread(command.downgrade, cfg, "0003")
    async with engine.connect() as conn:
        name = await conn.scalar(text("SELECT display_name FROM users"))
    assert name == "Ada Lovelace"
    await asyncio.to_thread(command.upgrade, cfg, "head")
