import uuid

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, SessionDep
from app.core.errors import ErrorResponse
from app.models import Item
from app.schemas.item import ItemOut, QueueAdd, QueueMove, QueueOut
from app.services import queue as queue_service
from app.services.items import item_to_out

router = APIRouter(prefix="/queue", tags=["queue"], responses={404: {"model": ErrorResponse}})


async def _get_owned(session: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID) -> Item:
    item = await session.scalar(select(Item).where(Item.id == item_id, Item.user_id == user_id))
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


@router.get("", response_model=QueueOut)
async def get_queue(user: CurrentUser, session: SessionDep) -> QueueOut:
    stmt = (
        select(Item)
        .where(Item.user_id == user.id, Item.queue_position.is_not(None))
        .order_by(Item.queue_position, Item.created_at, Item.id)
    )
    rows = (await session.scalars(stmt)).unique()
    return QueueOut(items=[item_to_out(i) for i in rows])


@router.post("", response_model=ItemOut)
async def add_to_queue(body: QueueAdd, user: CurrentUser, session: SessionDep) -> ItemOut:
    item = await _get_owned(session, user.id, body.item_id)
    if not queue_service.is_video(item):
        raise HTTPException(422, "Only videos can be queued")
    await queue_service.add_to_queue(session, item, body.position)
    await session.commit()
    await session.refresh(item)
    return item_to_out(item)


@router.patch("/{item_id}", response_model=ItemOut)
async def move_in_queue(
    item_id: uuid.UUID, body: QueueMove, user: CurrentUser, session: SessionDep
) -> ItemOut:
    item = await _get_owned(session, user.id, item_id)
    if not await queue_service.move_in_queue(session, item, body.position):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not in queue")
    await session.commit()
    await session.refresh(item)
    return item_to_out(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_queue_item(item_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    item = await _get_owned(session, user.id, item_id)
    await queue_service.remove_from_queue(session, item)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
