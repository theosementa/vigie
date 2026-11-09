import base64
import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, and_, case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import api_error
from app.models import Item, Resource, Tag, User
from app.schemas.item import ItemCreate, ItemOut, ItemStatus
from app.schemas.resource import ResourceOut
from app.services.events import record_event
from app.services.metadata import Metadata, fetch_metadata
from app.services.queue import next_position
from app.services.url import InvalidUrlError, normalize_url, url_hash

LengthBucket = Literal["short", "medium", "long"]

SHORT_BELOW_SECONDS = 600
LONG_ABOVE_SECONDS = 1800


def effective_length_seconds(
    item_type: str, duration_seconds: int | None, reading_time_minutes: int | None
) -> int | None:
    """Length in seconds from the effective type; None when the type has none or it is unknown."""
    if item_type in ("video", "podcast"):
        return duration_seconds
    if item_type == "article" and reading_time_minutes is not None:
        return reading_time_minutes * 60
    return None


def length_bucket(seconds: int | None) -> LengthBucket | None:
    if seconds is None:
        return None
    if seconds < SHORT_BELOW_SECONDS:
        return "short"
    return "medium" if seconds <= LONG_ABOVE_SECONDS else "long"


def length_seconds_sql() -> ColumnElement[int]:
    """SQL twin of `effective_length_seconds`, over items joined to their resource."""
    item_type = func.coalesce(Item.type_override, Resource.type)
    return case(
        (item_type.in_(("video", "podcast")), Resource.duration_seconds),
        (item_type == "article", Resource.reading_time_minutes * 60),
        else_=None,
    )


def length_bucket_sql(bucket: LengthBucket) -> ColumnElement[bool]:
    seconds = length_seconds_sql()
    if bucket == "short":
        return seconds < SHORT_BELOW_SECONDS
    if bucket == "medium":
        return and_(seconds >= SHORT_BELOW_SECONDS, seconds <= LONG_ABOVE_SECONDS)
    return seconds > LONG_ABOVE_SECONDS


def item_to_out(item: Item) -> ItemOut:
    out = ItemOut.model_validate(
        {
            "id": item.id,
            "status": item.status,
            "notes": item.notes,
            "tags": item.tags,
            "shared_by": item.shared_by,
            "share_message": item.share_message,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "seen_at": item.seen_at,
            "queue_position": item.queue_position,
            "resource": ResourceOut.model_validate(item.resource, from_attributes=True),
        },
        from_attributes=True,
    )
    if item.type_override:  # effective type for this user
        out.resource.type = item.type_override  # type: ignore[assignment]
    if item.title_override:  # custom title for this user
        out.resource.title = item.title_override
    return out


def apply_metadata(resource: Resource, meta: Metadata) -> None:
    resource.type = meta.type
    resource.title = meta.title
    resource.description = meta.description
    resource.image_url = meta.image_url
    resource.site_name = meta.site_name
    resource.favicon_url = meta.favicon_url
    resource.author = meta.author
    resource.duration_seconds = meta.duration_seconds
    resource.reading_time_minutes = meta.reading_time_minutes
    resource.published_at = meta.published_at
    if meta.stars is not None:
        resource.stars = meta.stars
        resource.stars_fetched_at = datetime.now().astimezone()
    elif meta.type != "repo":
        resource.stars = None
        resource.stars_fetched_at = None
    resource.fetched_at = datetime.now().astimezone()


async def get_or_create_resource(session: AsyncSession, url: str) -> Resource:
    """Find the resource of `url`, fetching its metadata when it is new.

    The network is never touched while a transaction is open: the read transaction is ended
    before the fetch, and the insert runs in a fresh, short one.
    """
    digest = url_hash(url)
    resource = await session.scalar(select(Resource).where(Resource.url_hash == digest))
    if resource is not None:
        return resource
    await session.commit()  # release the connection: nothing is held during the fetch
    meta = await fetch_metadata(url)
    resource = Resource(url=url, url_hash=digest)
    apply_metadata(resource, meta)
    try:
        async with session.begin_nested():
            session.add(resource)
            await session.flush()
    except IntegrityError:  # concurrent insert of the same URL
        existing = await session.scalar(select(Resource).where(Resource.url_hash == digest))
        if existing is None:
            raise
        return existing
    return resource


def clean_tag_names(names: list[str]) -> list[str]:
    seen: dict[str, str] = {}
    for raw in names:
        name = " ".join(raw.split())[:50]
        if name and name.lower() not in seen:
            seen[name.lower()] = name
    return list(seen.values())


async def resolve_tags(session: AsyncSession, user_id: uuid.UUID, names: list[str]) -> list[Tag]:
    cleaned = clean_tag_names(names)
    if not cleaned:
        return []
    rows = await session.scalars(
        select(Tag).where(
            Tag.user_id == user_id, func.lower(Tag.name).in_([n.lower() for n in cleaned])
        )
    )
    by_lower = {t.name.lower(): t for t in rows}
    tags: list[Tag] = []
    for name in cleaned:
        tag = by_lower.get(name.lower())
        if tag is None:
            tag = Tag(user_id=user_id, name=name)
            session.add(tag)
        tags.append(tag)
    await session.flush()
    return tags


def encode_cursor(created_at: datetime, item_id: uuid.UUID) -> str:
    return base64.urlsafe_b64encode(f"{created_at.isoformat()}|{item_id}".encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    ts, _, ident = raw.partition("|")
    return datetime.fromisoformat(ts), uuid.UUID(ident)


def set_status(item: Item, new_status: ItemStatus) -> str | None:
    """Apply a status change; returns the event kind of an actual transition (else None)."""
    if new_status == item.status:
        return None
    previous = item.status
    item.status = new_status
    item.seen_at = datetime.now(UTC) if new_status == "seen" else None
    if previous is None:  # brand new item, not a transition
        return None
    return "seen" if new_status == "seen" else "unseen"


async def add_item(session: AsyncSession, user: User, body: ItemCreate) -> ItemOut:
    """Add a URL to the library: the "add item" flow of the app and of the extension."""
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
    set_status(item, "to_watch")
    if body.status == "seen":
        set_status(item, "seen")
    if body.queue and item.status != "seen":
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
