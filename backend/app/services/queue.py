"""Watch queue: an ordered list of the user's video items (`items.queue_position`).

Positions are 0-based and contiguous per user; every mutation here leaves them compacted.
The queue is small, so it is loaded, reordered in Python and renumbered.
"""

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value

from app.models import Item


def is_video(item: Item) -> bool:
    """Effective type (per-user override first, like COALESCE(type_override, resource.type))."""
    return (item.type_override or item.resource.type) == "video"


async def load_queue(session: AsyncSession, user_id: uuid.UUID) -> list[Item]:
    """The user's queued items in order, row-locked to serialize concurrent queue edits."""
    stmt = (
        select(Item)
        .where(Item.user_id == user_id, Item.queue_position.is_not(None))
        .order_by(Item.queue_position, Item.created_at, Item.id)
        .with_for_update(of=Item)
    )
    return list((await session.scalars(stmt)).unique())


async def next_position(session: AsyncSession, user_id: uuid.UUID) -> int:
    """Position at the end of the (compacted) queue."""
    count = await session.scalar(
        select(func.count())
        .select_from(Item)
        .where(Item.user_id == user_id, Item.queue_position.is_not(None))
    )
    return count or 0


async def _renumber(session: AsyncSession, queue: list[Item]) -> None:
    for index, item in enumerate(queue):
        if item.queue_position == index:
            continue
        # explicit updated_at: reordering the queue is not an edit of the item
        await session.execute(
            update(Item)
            .where(Item.id == item.id)
            .values(queue_position=index, updated_at=Item.updated_at)
            .execution_options(synchronize_session=False)
        )
        set_committed_value(item, "queue_position", index)


async def add_to_queue(session: AsyncSession, item: Item, position: int | None = None) -> None:
    """Queue `item` (at the end by default).

    If already queued, it only moves when `position` is given.

    The caller checks that the item is a video.
    """
    queue = await load_queue(session, item.user_id)
    if item in queue:
        if position is None:
            return
        queue.remove(item)
    index = len(queue) if position is None else max(0, min(position, len(queue)))
    queue.insert(index, item)
    await _renumber(session, queue)


async def move_in_queue(session: AsyncSession, item: Item, position: int) -> bool:
    """Move a queued item to `position` (clamped). Returns False if the item is not queued."""
    queue = await load_queue(session, item.user_id)
    if item not in queue:
        return False
    queue.remove(item)
    queue.insert(max(0, min(position, len(queue))), item)
    await _renumber(session, queue)
    return True


async def remove_from_queue(session: AsyncSession, item: Item) -> None:
    """Dequeue `item` (no-op if not queued) and compact the positions behind it."""
    if item.queue_position is None:
        return
    queue = await load_queue(session, item.user_id)
    if item in queue:
        queue.remove(item)
    await session.execute(
        update(Item)
        .where(Item.id == item.id)
        .values(queue_position=None, updated_at=Item.updated_at)
        .execution_options(synchronize_session=False)
    )
    set_committed_value(item, "queue_position", None)
    await _renumber(session, queue)
