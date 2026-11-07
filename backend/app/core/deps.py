import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import api_error
from app.core.security import decode_access_token
from app.db import get_session
from app.models import User, UserSession

SessionDep = Annotated[AsyncSession, Depends(get_session)]
LAST_SEEN_EVERY = timedelta(minutes=5)


def _unauthorized():
    return api_error(401, "not_authenticated", "Not authenticated")


async def get_current_user(request: Request, session: SessionDep) -> User:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        raise _unauthorized()
    decoded = decode_access_token(token)
    if decoded is None:
        raise _unauthorized()
    try:
        user_id, session_id = uuid.UUID(decoded[0]), uuid.UUID(decoded[2])
    except ValueError:
        raise _unauthorized() from None
    user = await session.get(User, user_id)
    if user is None or user.token_version != decoded[1]:
        raise _unauthorized()
    device = await session.get(UserSession, session_id)
    if device is None or device.user_id != user.id:
        raise _unauthorized()  # revoked from another device
    now = datetime.now(UTC)
    if now - device.last_seen_at > LAST_SEEN_EVERY:
        device.last_seen_at = now  # throttled: not a write on every request
        await session.commit()
    request.state.user_id = user.id  # read by the realtime middleware
    request.state.session_id = session_id
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        # 404, not 403: the admin routes must not reveal their existence
        raise api_error(404, "not_found", "Not found")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
