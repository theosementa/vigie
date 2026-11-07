import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, SessionDep
from app.core.errors import api_error
from app.core.ratelimit import DAY, MINUTE, enforce, user_limit
from app.models import Item, ItemTag, Resource, Tag
from app.schemas.item import ItemCreate, ItemList, ItemOut, ItemStatus, ItemUpdate, RefreshOut
from app.schemas.resource import ItemType
from app.schemas.share import ShareIn, ShareOut
from app.services.events import record_event
from app.services.items import (
    apply_metadata,
    decode_cursor,
    encode_cursor,
    get_or_create_resource,
    item_to_out,
    resolve_tags,
)
from app.services.metadata import fetch_metadata
from app.services.queue import is_video, next_position, remove_from_queue
from app.services.share import share_item
from app.services.url import InvalidUrlError, normalize_url

router = APIRouter(prefix="/items", tags=["items"])


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def _get_owned(session: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID) -> Item:
    item = await session.scalar(select(Item).where(Item.id == item_id, Item.user_id == user_id))
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


def _set_status(item: Item, new_status: ItemStatus) -> str | None:
    """Apply a status change; returns the event kind of an actual transition (else None)."""
    if new_status == item.status:
        return None
    previous = item.status
    item.status = new_status
    item.seen_at = datetime.now(UTC) if new_status == "seen" else None
    if previous is None:  # brand new item, not a transition
        return None
    return "seen" if new_status == "seen" else "unseen"


@router.get("", response_model=ItemList)
async def list_items(
    user: CurrentUser,
    session: SessionDep,
    status_: ItemStatus | None = Query(default=None, alias="status"),
    type: ItemType | None = None,
    tag: str | None = None,
    q: str | None = None,
    shared: bool | None = None,
    queued: bool | None = None,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> ItemList:
    stmt = (
        select(Item).join(Resource, Resource.id == Item.resource_id).where(Item.user_id == user.id)
    )
    if status_:
        stmt = stmt.where(Item.status == status_)
    if type:
        stmt = stmt.where(func.coalesce(Item.type_override, Resource.type) == type)
    if shared is True:
        stmt = stmt.where(Item.shared_by_user_id.is_not(None))
    elif shared is False:
        stmt = stmt.where(Item.shared_by_user_id.is_(None))
    if queued is True:
        stmt = stmt.where(Item.queue_position.is_not(None))
    elif queued is False:
        stmt = stmt.where(Item.queue_position.is_(None))
    if tag:
        conds = [func.lower(Tag.name) == tag.strip().lower()]
        try:
            conds.append(Tag.id == uuid.UUID(tag))
        except ValueError:
            pass
        stmt = stmt.where(
            exists().where(
                ItemTag.item_id == Item.id,
                ItemTag.tag_id == Tag.id,
                Tag.user_id == user.id,
                or_(*conds),
            )
        )
    if q and q.strip():
        pattern = f"%{_escape_like(q.strip())}%"
        stmt = stmt.where(
            or_(
                Resource.title.ilike(pattern, escape="\\"),
                Resource.description.ilike(pattern, escape="\\"),
                Resource.site_name.ilike(pattern, escape="\\"),
                Item.notes.ilike(pattern, escape="\\"),
            )
        )
    if cursor:
        try:
            c_ts, c_id = decode_cursor(cursor)
        except Exception:
            raise HTTPException(422, "Invalid cursor") from None
        stmt = stmt.where(
            or_(
                Item.created_at < c_ts,
                and_(Item.created_at == c_ts, Item.id < c_id),
            )
        )
    stmt = stmt.order_by(Item.created_at.desc(), Item.id.desc()).limit(limit + 1)

    rows = list((await session.scalars(stmt)).unique())
    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        last = rows[-1]
        next_cursor = encode_cursor(last.created_at, last.id)
    return ItemList(items=[item_to_out(i) for i in rows], next_cursor=next_cursor)


@router.post(
    "",
    response_model=ItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(user_limit("item_create", 60, MINUTE))],
)
async def create_item(body: ItemCreate, user: CurrentUser, session: SessionDep) -> ItemOut:
    try:
        url = normalize_url(body.url)
    except InvalidUrlError as exc:
        raise HTTPException(422, str(exc)) from exc

    resource = await get_or_create_resource(session, url)
    existing = await session.scalar(
        select(Item.id).where(Item.user_id == user.id, Item.resource_id == resource.id)
    )
    if existing is not None:
        await session.rollback()
        raise api_error(
            status.HTTP_409_CONFLICT,
            "already_in_library",
            "Already in your library",
            item_id=str(existing),
        )

    item = Item(
        id=uuid.uuid4(),
        user_id=user.id,
        resource_id=resource.id,
        notes=(body.notes or None),
        type_override=body.type if body.type and body.type != resource.type else None,
    )
    item.tags = await resolve_tags(session, user.id, body.tags)
    _set_status(item, "to_watch")
    if body.status == "seen":
        _set_status(item, "seen")
    effective_type = item.type_override or resource.type
    if body.queue and item.status != "seen" and effective_type == "video":
        item.queue_position = await next_position(session, user.id)
    session.add(item)
    record_event(session, user_id=user.id, item_id=item.id, resource_id=resource.id, kind="added")
    if item.status == "seen":
        record_event(
            session,
            user_id=user.id,
            item_id=item.id,
            resource_id=resource.id,
            kind="seen",
            occurred_at=item.seen_at,
        )
    user_id, resource_id = user.id, resource.id  # rollback expires ORM attributes
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(
            select(Item.id).where(Item.user_id == user_id, Item.resource_id == resource_id)
        )
        raise api_error(
            status.HTTP_409_CONFLICT,
            "already_in_library",
            "Already in your library",
            item_id=str(existing) if existing else None,
        ) from None
    await session.refresh(item)
    return item_to_out(item)


@router.get("/{item_id}", response_model=ItemOut)
async def get_item(item_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> ItemOut:
    return item_to_out(await _get_owned(session, user.id, item_id))


@router.patch("/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: uuid.UUID, body: ItemUpdate, user: CurrentUser, session: SessionDep
) -> ItemOut:
    item = await _get_owned(session, user.id, item_id)
    fields = body.model_fields_set
    if "status" in fields and body.status:
        kind = _set_status(item, body.status)
        if body.status == "seen":
            await remove_from_queue(session, item)
        if kind:
            record_event(
                session,
                user_id=user.id,
                item_id=item.id,
                resource_id=item.resource_id,
                kind=kind,
                occurred_at=item.seen_at if kind == "seen" else None,
            )
    if "notes" in fields:
        item.notes = body.notes or None
    if "type" in fields and body.type:
        item.type_override = None if body.type == item.resource.type else body.type
        if not is_video(item):
            await remove_from_queue(session, item)
    if "tags" in fields and body.tags is not None:
        item.tags = await resolve_tags(session, user.id, body.tags)
    await session.commit()
    await session.refresh(item)
    return item_to_out(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    item = await _get_owned(session, user.id, item_id)
    record_event(
        session,
        user_id=user.id,
        item_id=item.id,
        resource_id=item.resource_id,
        kind="deleted",
        was_seen=item.status == "seen",
    )
    await remove_from_queue(session, item)
    await session.delete(item)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{item_id}/refresh",
    response_model=RefreshOut,
    dependencies=[Depends(user_limit("item_refresh", 60, MINUTE))],
)
async def refresh_item(item_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> RefreshOut:
    item = await _get_owned(session, user.id, item_id)
    url = item.resource.url
    await session.commit()  # no transaction (or connection) held during the fetch
    meta = await fetch_metadata(url)
    if not meta.ok:  # keep the previous data when the refetch failed
        return RefreshOut(refreshed=False, reason="fetch_failed", item=item_to_out(item))
    apply_metadata(item.resource, meta)
    await session.commit()
    await session.refresh(item)
    return RefreshOut(refreshed=True, item=item_to_out(item))


@router.post("/{item_id}/share", response_model=ShareOut)
async def share(
    item_id: uuid.UUID, body: ShareIn, user: CurrentUser, session: SessionDep
) -> ShareOut:
    item = await _get_owned(session, user.id, item_id)
    recipients = {e.strip().lower() for e in body.emails if e.strip()}
    enforce(f"share:user:{user.id}", 50, DAY, cost=len(recipients))
    return await share_item(session, user, item, body.emails, body.message)
