import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, SessionDep
from app.core.errors import ErrorResponse
from app.core.ratelimit import DAY, MINUTE, enforce, user_limit
from app.models import Item, ItemEvent, ItemTag, Resource, Tag, User
from app.schemas.item import (
    ItemCreate,
    ItemEventOut,
    ItemList,
    ItemOut,
    ItemStatus,
    ItemUpdate,
    PersonName,
    RefreshOut,
)
from app.schemas.resource import ItemType
from app.schemas.share import ShareIn, ShareOut
from app.services.events import record_event
from app.services.items import (
    LengthBucket,
    add_item,
    apply_metadata,
    decode_cursor,
    encode_cursor,
    item_to_out,
    length_bucket_sql,
    length_seconds_sql,
    resolve_tags,
    set_status,
)
from app.services.metadata import fetch_metadata
from app.services.queue import remove_from_queue
from app.services.share import share_item
from app.services.stars import refresh_stale_stars

router = APIRouter(prefix="/items", tags=["items"], responses={404: {"model": ErrorResponse}})


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def _get_owned(session: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID) -> Item:
    item = await session.scalar(select(Item).where(Item.id == item_id, Item.user_id == user_id))
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


MAX_FILTER_VALUES = 50  # values of a repeated filter (type, tag)


@router.get("", response_model=ItemList)
async def list_items(
    user: CurrentUser,
    session: SessionDep,
    status_: ItemStatus | None = Query(default=None, alias="status"),
    type: list[ItemType] | None = Query(default=None, max_length=MAX_FILTER_VALUES),
    tag: list[str] | None = Query(default=None, max_length=MAX_FILTER_VALUES),
    q: str | None = None,
    shared: bool | None = None,
    queued: bool | None = None,
    length: LengthBucket | None = None,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> ItemList:
    stmt = (
        select(Item).join(Resource, Resource.id == Item.resource_id).where(Item.user_id == user.id)
    )
    if status_:
        stmt = stmt.where(Item.status == status_)
    if type:
        # several types: an item of any of them
        stmt = stmt.where(func.coalesce(Item.type_override, Resource.type).in_(set(type)))
    if shared is True:
        stmt = stmt.where(Item.shared_by_user_id.is_not(None))
    elif shared is False:
        stmt = stmt.where(Item.shared_by_user_id.is_(None))
    if queued is True:
        stmt = stmt.where(Item.queue_position.is_not(None))
    elif queued is False:
        stmt = stmt.where(Item.queue_position.is_(None))
    tags = [t.strip() for t in tag or [] if t.strip()]
    if tags:
        # several tags: an item carrying any of them (by name, case-insensitive, or by id)
        conds = [func.lower(Tag.name).in_({t.lower() for t in tags})]
        ids = []
        for t in tags:
            try:
                ids.append(uuid.UUID(t))
            except ValueError:
                pass
        if ids:
            conds.append(Tag.id.in_(ids))
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
                Item.title_override.ilike(pattern, escape="\\"),
                Resource.description.ilike(pattern, escape="\\"),
                Resource.site_name.ilike(pattern, escape="\\"),
                Item.notes.ilike(pattern, escape="\\"),
            )
        )
    length_unknown = None
    if length:
        # counted under the other filters, before the length one narrows them
        length_unknown = await session.scalar(
            select(func.count()).select_from(stmt.where(length_seconds_sql().is_(None)).subquery())
        )
        stmt = stmt.where(length_bucket_sql(length))
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
    await refresh_stale_stars(session, rows)
    return ItemList(
        items=[item_to_out(i) for i in rows],
        next_cursor=next_cursor,
        length_unknown=length_unknown,
    )


@router.post(
    "",
    response_model=ItemOut,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse}},
    dependencies=[Depends(user_limit("item_create", 60, MINUTE))],
)
async def create_item(body: ItemCreate, user: CurrentUser, session: SessionDep) -> ItemOut:
    return await add_item(session, user, body)


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
        kind = set_status(item, body.status)
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
    if "title" in fields:
        title = " ".join((body.title or "").split())
        item.title_override = None if not title or title == item.resource.title else title
    if "type" in fields and body.type:
        item.type_override = None if body.type == item.resource.type else body.type
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


@router.get("/{item_id}/events", response_model=list[ItemEventOut])
async def list_item_events(
    item_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> list[ItemEventOut]:
    """The item's journal, oldest first."""
    await _get_owned(session, user.id, item_id)
    rows = await session.execute(
        select(ItemEvent, User.first_name, User.last_name)
        .outerjoin(User, User.id == ItemEvent.other_user_id)
        .where(ItemEvent.user_id == user.id, ItemEvent.item_id == item_id)
        .order_by(ItemEvent.occurred_at, ItemEvent.id)
    )
    return [
        ItemEventOut(
            kind=event.kind,
            occurred_at=event.occurred_at,
            other_user=PersonName(first_name=first, last_name=last) if first is not None else None,
        )
        for event, first, last in rows
    ]


@router.post("/{item_id}/share", response_model=ShareOut)
async def share_item_by_email(
    item_id: uuid.UUID, body: ShareIn, user: CurrentUser, session: SessionDep
) -> ShareOut:
    item = await _get_owned(session, user.id, item_id)
    recipients = {e.strip().lower() for e in body.emails if e.strip()}
    enforce(f"share:user:{user.id}", 50, DAY, cost=len(recipients))
    return await share_item(session, user, item, body.emails, body.message)
