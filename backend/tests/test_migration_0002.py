import asyncio
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


def ts(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC)


async def test_backfill_builds_events_from_existing_items():
    cfg = _cfg()
    await asyncio.to_thread(command.downgrade, cfg, "0001")

    alice, bob = uuid.uuid4(), uuid.uuid4()
    res_a, res_b = uuid.uuid4(), uuid.uuid4()
    own_seen, own_todo, received = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    async with engine.begin() as conn:
        for uid, email in ((alice, "alice@example.com"), (bob, "bob@example.com")):
            await conn.execute(
                text(
                    "INSERT INTO users (id, email, password_hash, display_name) "
                    "VALUES (:i, :e, 'x', 'u')"
                ),
                {"i": uid, "e": email},
            )
        for rid, url in ((res_a, "https://a.example.com"), (res_b, "https://b.example.com")):
            await conn.execute(
                text(
                    "INSERT INTO resources (id, url, type, title) VALUES (:i, :u, 'article', 't')"
                ),
                {"i": rid, "u": url},
            )
        rows = [
            # id, user, resource, status, shared_by, created_at, seen_at
            (own_seen, alice, res_a, "seen", None, ts(2026, 1, 1), ts(2026, 1, 3)),
            (own_todo, alice, res_b, "to_watch", None, ts(2026, 1, 2), None),
            (received, bob, res_b, "seen", alice, ts(2026, 1, 5), ts(2026, 1, 6)),
        ]
        for i, u, r, st, sb, ca, sa in rows:
            await conn.execute(
                text(
                    "INSERT INTO items (id, user_id, resource_id, status, shared_by_user_id, "
                    "created_at, seen_at) VALUES (:i, :u, :r, :st, :sb, :ca, :sa)"
                ),
                {"i": i, "u": u, "r": r, "st": st, "sb": sb, "ca": ca, "sa": sa},
            )

    await asyncio.to_thread(command.upgrade, cfg, "head")

    async with engine.connect() as conn:
        res = await conn.execute(
            text("SELECT user_id, item_id, kind, occurred_at, other_user_id FROM item_events")
        )
        events = {(r.user_id, r.item_id, r.kind): r for r in res}
        timezone = await conn.scalar(text("SELECT timezone FROM users LIMIT 1"))

    assert timezone == "UTC"
    assert len(events) == 6  # 3 added + 2 seen + 1 shared

    assert events[(alice, own_seen, "added")].occurred_at == ts(2026, 1, 1)
    assert events[(alice, own_seen, "added")].other_user_id is None
    assert events[(alice, own_seen, "seen")].occurred_at == ts(2026, 1, 3)
    assert events[(alice, own_todo, "added")].occurred_at == ts(2026, 1, 2)
    assert (alice, own_todo, "seen") not in events

    got = events[(bob, received, "added")]
    assert got.occurred_at == ts(2026, 1, 5) and got.other_user_id == alice
    assert events[(bob, received, "seen")].occurred_at == ts(2026, 1, 6)

    # alice's `shared` event points at her own item for that resource
    sent = events[(alice, own_todo, "shared")]
    assert sent.occurred_at == ts(2026, 1, 5) and sent.other_user_id == bob
