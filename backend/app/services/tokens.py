"""API tokens: generate (hashed at rest), look up, revoke."""

import secrets
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import api_error
from app.core.security import hash_token
from app.models import ApiToken
from app.models.api_token import SCOPE_ITEMS_ADD

TOKEN_PREFIX = "vgt_"
MAX_TOKENS = 10


async def create_token(
    session: AsyncSession, user_id: uuid.UUID, name: str
) -> tuple[ApiToken, str]:
    """Returns the stored row and the secret, which is not recoverable afterwards."""
    count = await session.scalar(
        select(func.count()).select_from(ApiToken).where(ApiToken.user_id == user_id)
    )
    if (count or 0) >= MAX_TOKENS:
        raise api_error(
            409, "tokens_limit", f"You can have up to {MAX_TOKENS} tokens. Revoke one first."
        )
    secret = TOKEN_PREFIX + secrets.token_urlsafe(32)
    row = ApiToken(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        token_hash=hash_token(secret),
        prefix=secret[: len(TOKEN_PREFIX) + 4],
        scope=SCOPE_ITEMS_ADD,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row, secret


async def find_token(session: AsyncSession, secret: str) -> ApiToken | None:
    if not secret.startswith(TOKEN_PREFIX) or len(secret) > 200:
        return None
    return await session.scalar(select(ApiToken).where(ApiToken.token_hash == hash_token(secret)))
