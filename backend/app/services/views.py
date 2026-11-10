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
# Keys that may repeat (several types, several tags): kept sorted and deduplicated.
_MULTI = {"type", "tag"}


def canonical_query(raw: str) -> str:
    """Keep only the library filter keys with valid values, sorted, defaults removed.

    Returns "" when no filter is left. `type` and `tag` may repeat (deduplicated, tags
    case-insensitively, then sorted); for the other keys the first occurrence wins.
    """
    kept: dict[str, list[str]] = {}
    for key, value in parse_qsl(raw.removeprefix("?"), max_num_fields=50):
        if key in kept and key not in _MULTI:
            continue
        value = value.strip()
        if not value or value == _DEFAULTS.get(key):
            continue
        valid = (key in _ENUMS and value in _ENUMS[key]) or (
            key in _TEXT_LIMITS and len(value) <= _TEXT_LIMITS[key]
        )
        if not valid:
            continue
        values = kept.setdefault(key, [])
        if value.casefold() not in {v.casefold() for v in values}:
            values.append(value)
    pairs = [(key, value) for key in sorted(kept) for value in sorted(kept[key], key=str.casefold)]
    return urlencode(pairs)


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
