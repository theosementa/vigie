import uuid

from fastapi import APIRouter, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, SessionDep
from app.core.errors import ErrorResponse, api_error
from app.models import SavedView
from app.schemas.view import ViewIn, ViewOut, ViewUpdate
from app.services import views as views_service

router = APIRouter(prefix="/views", tags=["views"], responses={404: {"model": ErrorResponse}})


def _name_taken():
    return api_error(409, "view_name_taken", "You already have a view with this name.")


def _check_name_free(views: list[SavedView], name: str, *, except_id: uuid.UUID | None = None):
    if any(v.name.lower() == name.lower() and v.id != except_id for v in views):
        raise _name_taken()


async def _commit(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError:  # a concurrent request took the name
        await session.rollback()
        raise _name_taken() from None


@router.get("", response_model=list[ViewOut])
async def list_views(user: CurrentUser, session: SessionDep) -> list[SavedView]:
    return list(
        await session.scalars(
            select(SavedView)
            .where(SavedView.user_id == user.id)
            .order_by(SavedView.position, SavedView.created_at, SavedView.id)
        )
    )


@router.post("", response_model=ViewOut, status_code=status.HTTP_201_CREATED)
async def create_view(body: ViewIn, user: CurrentUser, session: SessionDep) -> SavedView:
    query = views_service.canonical_query(body.query)
    if not query:
        raise api_error(422, "view_empty", "A view needs at least one filter.")
    views = await views_service.load_views(session, user.id)
    if len(views) >= views_service.MAX_VIEWS:
        raise api_error(409, "views_limit", "You reached the limit of saved views.")
    _check_name_free(views, body.name)
    view = SavedView(user_id=user.id, name=body.name, query=query, position=len(views))
    session.add(view)
    await _commit(session)
    await session.refresh(view)
    return view


@router.patch("/{view_id}", response_model=ViewOut)
async def update_view(
    view_id: uuid.UUID, body: ViewUpdate, user: CurrentUser, session: SessionDep
) -> SavedView:
    views = await views_service.load_views(session, user.id)
    view = next((v for v in views if v.id == view_id), None)
    if view is None:
        raise api_error(404, "view_not_found", "View not found.")
    if body.name is not None:
        _check_name_free(views, body.name, except_id=view.id)
        view.name = body.name
    if body.position is not None:
        views.remove(view)
        views.insert(min(body.position, len(views)), view)
        views_service.renumber(views)
    await _commit(session)
    await session.refresh(view)
    return view


@router.delete("/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_view(view_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    views = await views_service.load_views(session, user.id)
    view = next((v for v in views if v.id == view_id), None)
    if view is None:
        raise api_error(404, "view_not_found", "View not found.")
    views.remove(view)
    await session.delete(view)
    views_service.renumber(views)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
