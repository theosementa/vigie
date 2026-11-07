import base64
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Item, Resource, Tag
from app.schemas.item import ItemOut
from app.schemas.resource import ResourceOut
from app.services.metadata import Metadata, fetch_metadata
from app.services.url import url_hash


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
