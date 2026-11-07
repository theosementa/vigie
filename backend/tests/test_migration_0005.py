import asyncio
import os
import uuid

from alembic.config import Config
from sqlalchemy import text

from alembic import command
from app.db import engine


def _cfg() -> Config:
    root = os.path.join(os.path.dirname(__file__), "..")
    cfg = Config(os.path.join(root, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(root, "alembic"))
    return cfg


async def _columns() -> set[str]:
    async with engine.connect() as conn:
        rows = await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name='users'")
        )
        return {r[0] for r in rows}


async def test_0005_upgrades_existing_users_and_downgrades():
    cfg = _cfg()
    await asyncio.to_thread(command.downgrade, cfg, "0004")
    assert not {"locale", "theme"} & await _columns()

    uid = uuid.uuid4()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, first_name) "
                "VALUES (:i, 'old@example.com', 'h', 'Old')"
            ),
            {"i": uid},
        )

    await asyncio.to_thread(command.upgrade, cfg, "head")
    async with engine.connect() as conn:
        row = (await conn.execute(text("SELECT locale, theme, first_name FROM users"))).one()
    assert (row.locale, row.theme, row.first_name) == ("auto", "system", "Old")

    async with engine.begin() as conn:
        await conn.execute(text("UPDATE users SET locale='fr', theme='dark'"))
    # the check constraints reject unknown values
    try:
        async with engine.begin() as conn:
            await conn.execute(text("UPDATE users SET theme='blue'"))
        raised = False
    except Exception:
        raised = True
    assert raised

    await asyncio.to_thread(command.downgrade, cfg, "0004")
    assert not {"locale", "theme"} & await _columns()
    async with engine.connect() as conn:
        assert (await conn.execute(text("SELECT count(*) FROM users"))).scalar() == 1
    await asyncio.to_thread(command.upgrade, cfg, "head")
