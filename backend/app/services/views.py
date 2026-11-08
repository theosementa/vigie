"""Saved views: canonical library queries and their ordering (`saved_views.position`).

Positions are 0-based and contiguous per user; every mutation leaves them compacted. A user has
few views, so the list is loaded, reordered in Python and renumbered (like the queue).
"""

import uuid
from typing import get_args
from urllib.parse import parse_qsl, urlencode

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SavedView
from app.schemas.item import ItemStatus
from app.schemas.resource import ItemType
from app.services.items import LengthBucket

MAX_VIEWS = 20
MAX_TAG = 50  # tag names
MAX_SEARCH = 200

# The library filters kept in a view, with their allowed values (None = free text). A value equal
# to the default (`status=to_watch`, `type=all`) is dropped: it is how the library URL looks too.
_ENUMS: dict[str, tuple[str, ...]] = {
    "status": get_args(ItemStatus),
    "type": get_args(ItemType),
    "length": get_args(LengthBucket),
}
_TEXT_LIMITS = {"tag": MAX_TAG, "q": MAX_SEARCH}
_DEFAULTS = {"status": "to_watch", "type": "all"}


def canonical_query(raw: str) -> str:
    """Keep only the library filter keys with valid values, sorted, defaults removed.

    Returns "" when no filter is left. The first occurrence of a repeated key wins.
    """
    kept: dict[str, str] = {}
    for key, value in parse_qsl(raw.removeprefix("?"), max_num_fields=50):
        if key in kept:
            continue
        value = value.strip()
        if not value or value == _DEFAULTS.get(key):
            continue
        if key in _ENUMS:
            if value in _ENUMS[key]:
                kept[key] = value
        elif key in _TEXT_LIMITS and len(value) <= _TEXT_LIMITS[key]:
            kept[key] = value
    return urlencode(sorted(kept.items()))


async def load_views(session: AsyncSession, user_id: uuid.UUID) -> list[SavedView]:
    """The user's views in order, row-locked to serialize concurrent edits."""
    stmt = (
        select(SavedView)
        .where(SavedView.user_id == user_id)
        .order_by(SavedView.position, SavedView.created_at, SavedView.id)
        .with_for_update()
    )
    return list(await session.scalars(stmt))


def renumber(views: list[SavedView]) -> None:
    for index, view in enumerate(views):
        if view.position != index:
            view.position = index
