import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Request
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import api_error
from app.core.security import new_reset_token
from app.models import InstanceSettings, PasswordReset, User

RESET_TOKEN_TTL = timedelta(hours=1)
_REGISTRATION_LOCK = 4_242_001  # pg advisory lock serialising signups (first-admin race)


async def lock_registration(session: AsyncSession) -> None:
    """Held until the end of the transaction: two first signups cannot both become admin."""
    await session.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _REGISTRATION_LOCK})


async def get_instance_settings(session: AsyncSession) -> InstanceSettings:
    """The single settings row, seeded from REGISTRATION the first time."""
    row = await session.get(InstanceSettings, 1)
    if row is None:
        await session.execute(
            insert(InstanceSettings)
            .values(id=1, registration_mode=settings.registration)
            .on_conflict_do_nothing()
        )
        await session.commit()
        row = await session.get(InstanceSettings, 1)
        assert row is not None
    return row


async def admin_count(session: AsyncSession) -> int:
    return await session.scalar(select(func.count()).where(User.role == "admin")) or 0


async def delete_account(session: AsyncSession, user: User) -> None:
    """Delete a user. Everything they own cascades in the database; invitations they created
    stay (`created_by` becomes NULL) and items they shared to others keep existing
    (`shared_by_user_id` becomes NULL). Refuses to remove the last admin of a shared instance."""
    if user.role == "admin":
        others = await session.scalar(select(func.count()).where(User.id != user.id)) or 0
        if others > 0 and await admin_count(session) <= 1:
            raise api_error(
                409,
                "last_admin",
                "You are the only admin: promote or remove the other accounts first.",
            )
    await session.execute(delete(User).where(User.id == user.id))
    await session.commit()


async def create_reset_link(
    session: AsyncSession, user_id: uuid.UUID, base_url: str
) -> tuple[str, datetime]:
    """Issue a one-time reset token (previous unused ones are voided); returns (url, expiry)."""
    token, token_hash = new_reset_token()
    expires_at = datetime.now(UTC) + RESET_TOKEN_TTL
    await session.execute(
        update(PasswordReset)
        .where(PasswordReset.user_id == user_id, PasswordReset.used_at.is_(None))
        .values(used_at=datetime.now(UTC))
    )
    session.add(PasswordReset(user_id=user_id, token_hash=token_hash, expires_at=expires_at))
    await session.commit()
    return f"{base_url.rstrip('/')}/reset-password?token={token}", expires_at


def public_base_url(request: Request) -> str:
    return settings.public_url or str(request.base_url)
