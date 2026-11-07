from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.deps import CurrentUser, SessionDep
from app.core.ratelimit import MINUTE, user_limit
from app.models import Item, Resource
from app.schemas.resource import PreviewIn, PreviewOut
from app.services.metadata import fetch_metadata
from app.services.url import InvalidUrlError, normalize_url, url_hash

router = APIRouter(prefix="/resources", tags=["resources"])


@router.post(
    "/preview",
    response_model=PreviewOut,
    dependencies=[Depends(user_limit("preview", 60, MINUTE))],
)
async def preview_resource(body: PreviewIn, user: CurrentUser, session: SessionDep) -> PreviewOut:
    try:
        url = normalize_url(body.url)
    except InvalidUrlError as exc:
        raise HTTPException(422, str(exc)) from exc

    resource = await session.scalar(select(Resource).where(Resource.url_hash == url_hash(url)))
    existing_item_id = None
    if resource is not None:
        existing = await session.scalar(
            select(Item).where(Item.user_id == user.id, Item.resource_id == resource.id)
        )
        data = PreviewOut.model_validate(resource, from_attributes=True)
        if existing is not None:
            existing_item_id = existing.id
            # the caller's effective type, like items do
            if existing.type_override:
                data.type = existing.type_override  # type: ignore[assignment]
            if existing.title_override:
                data.title = existing.title_override
    else:
        await session.commit()  # no transaction (or connection) held during the fetch
        meta = await fetch_metadata(url)
        data = PreviewOut(
            url=url,
            type=meta.type,  # type: ignore[arg-type]
            title=meta.title,
            description=meta.description,
            image_url=meta.image_url,
            site_name=meta.site_name,
            favicon_url=meta.favicon_url,
            author=meta.author,
            duration_seconds=meta.duration_seconds,
            reading_time_minutes=meta.reading_time_minutes,
            published_at=meta.published_at,
        )
    data.existing_item_id = existing_item_id
    return data
