from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.deps import CurrentUser, SessionDep
from app.models import ItemTag, Tag
from app.schemas.tag import TagOut

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
async def list_tags(user: CurrentUser, session: SessionDep) -> list[TagOut]:
    count = func.count(ItemTag.item_id)
    rows = await session.execute(
        select(Tag.id, Tag.name, count)
        .join(ItemTag, ItemTag.tag_id == Tag.id)
        .where(Tag.user_id == user.id)
        .group_by(Tag.id, Tag.name)
        .order_by(func.lower(Tag.name))
    )
    return [TagOut(id=r[0], name=r[1], item_count=r[2]) for r in rows]
