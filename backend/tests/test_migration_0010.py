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


async def test_0010_turns_show_repos_into_hidden_types_and_back():
    cfg = _cfg()
    await asyncio.to_thread(command.downgrade, cfg, "0009")
    async with engine.begin() as conn:
        for email, show in (("dev@example.com", True), ("novice@example.com", False)):
            await conn.execute(
                text(
                    "INSERT INTO users (id, email, password_hash, first_name, show_repos) "
                    "VALUES (:i, :e, 'h', 'X', :s)"
                ),
                {"i": uuid.uuid4(), "e": email, "s": show},
            )

    await asyncio.to_thread(command.upgrade, cfg, "head")
    async with engine.connect() as conn:
        rows = (await conn.execute(text("SELECT email, hidden_types FROM users"))).all()
    assert {r.email: r.hidden_types for r in rows} == {
        "dev@example.com": [],
        "novice@example.com": ["repo"],
    }

    await asyncio.to_thread(command.downgrade, cfg, "0009")
    async with engine.connect() as conn:
        rows = (await conn.execute(text("SELECT email, show_repos FROM users"))).all()
    assert {r.email: r.show_repos for r in rows} == {
        "dev@example.com": True,
        "novice@example.com": False,
    }
    await asyncio.to_thread(command.upgrade, cfg, "head")
