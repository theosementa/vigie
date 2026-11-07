"""Operator commands: `vigie reset-password <email>` (or `python -m app.cli ...`)."""

import argparse
import asyncio
import sys

from sqlalchemy import select

from app.core.config import settings
from app.db import SessionLocal, engine
from app.models import User
from app.services.accounts import create_reset_link

_FALLBACK_BASE = "http://localhost"


async def reset_password(email: str) -> int:
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.email == email.strip().lower()))
        if user is None:
            print(f"No account with the email {email!r}.", file=sys.stderr)
            return 1
        base = settings.public_url or _FALLBACK_BASE
        url, _ = await create_reset_link(session, user.id, base)
    if not settings.public_url:
        print(
            "PUBLIC_URL is not set: replace the host below with your instance URL.", file=sys.stderr
        )
    print(url)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vigie")
    sub = parser.add_subparsers(dest="command", required=True)
    reset = sub.add_parser(
        "reset-password", help="print a one-time password-reset link (valid 1 h)"
    )
    reset.add_argument("email")
    args = parser.parse_args(argv)

    async def run() -> int:
        try:
            return await reset_password(args.email)
        finally:
            await engine.dispose()

    return asyncio.run(run())


if __name__ == "__main__":
    sys.exit(main())
