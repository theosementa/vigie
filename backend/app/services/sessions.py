"""Signed-in devices: create, describe and revoke sessions."""

import re
import uuid

from fastapi import Request, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cookies import set_session_cookie
from app.models import User, UserSession
from app.services import realtime

_BROWSERS = (
    ("Edge", re.compile(r"Edg(e|A|iOS)?/")),
    ("Opera", re.compile(r"OPR/|Opera")),
    ("Firefox", re.compile(r"Firefox/|FxiOS/")),
    ("Chrome", re.compile(r"Chrome/|CriOS/")),
    ("Safari", re.compile(r"Safari/")),
)
_SYSTEMS = (
    ("iPhone", re.compile(r"iPhone")),
    ("iPad", re.compile(r"iPad")),
    ("Android", re.compile(r"Android")),
    ("Mac", re.compile(r"Macintosh|Mac OS X")),
    ("Windows", re.compile(r"Windows")),
    ("Linux", re.compile(r"Linux|X11")),
)


def describe_device(user_agent: str | None) -> str:
    """A short, human label such as "Safari · iPhone" (best effort: the User-Agent is untrusted)."""
    ua = (user_agent or "")[:500]
    browser = next((name for name, rx in _BROWSERS if rx.search(ua)), None)
    system = next((name for name, rx in _SYSTEMS if rx.search(ua)), None)
    return " · ".join(p for p in (browser, system) if p) or "Unknown device"


async def start_session(
    request: Request, response: Response, session: AsyncSession, user: User
) -> UserSession:
    """Record the device, commit, and set the session cookie that points at it."""
    row = UserSession(
        id=uuid.uuid4(),
        user_id=user.id,
        device=describe_device(request.headers.get("user-agent")),
        ip=request.client.host if request.client else None,
    )
    session.add(row)
    await session.commit()
    request.state.user_id = user.id  # lets the realtime middleware notify this user's devices
    set_session_cookie(request, response, user, row.id)
    return row


async def revoke_sessions(
    session: AsyncSession, user_id: uuid.UUID, *, keep: uuid.UUID | None = None
) -> None:
    """Delete the user's sessions (all, or all but `keep`) and kick their open streams."""
    stmt = select(UserSession.id).where(UserSession.user_id == user_id)
    if keep is not None:
        stmt = stmt.where(UserSession.id != keep)
    ids = list((await session.scalars(stmt)).all())
    if not ids:
        return
    await session.execute(delete(UserSession).where(UserSession.id.in_(ids)))
    await session.commit()
    realtime.revoke(ids)
