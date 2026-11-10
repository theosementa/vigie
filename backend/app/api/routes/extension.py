from fastapi import APIRouter, Depends, Query, status

from app.core.deps import ItemsAddUser, SessionDep
from app.core.errors import ErrorResponse
from app.core.ratelimit import MINUTE, enforce, ip_limit
from app.schemas.item import ItemCreate, ItemOut
from app.schemas.resource import MAX_URL_LENGTH
from app.services.items import add_item, is_saved

# Endpoints for the browser extension: authenticated by a scoped bearer token, not the cookie.
router = APIRouter(
    prefix="/extension",
    tags=["extension"],
    responses={401: {"model": ErrorResponse}},
    dependencies=[Depends(ip_limit("extension", 120, MINUTE))],
)


@router.post(
    "/items",
    response_model=ItemOut,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse}},
)
async def add_item_from_extension(body: ItemCreate, user: ItemsAddUser, session: SessionDep):
    """Same as `POST /items` (same body, same answers), with a token holding `items:add`."""
    enforce(f"item_create:user:{user.id}", 60, MINUTE)  # shares the app's budget
    return await add_item(session, user, body)


@router.get("/items/saved")
async def is_page_saved(
    user: ItemsAddUser, session: SessionDep, url: str = Query(max_length=MAX_URL_LENGTH)
) -> dict[str, bool]:
    """Whether `url` is already in the caller's library (the extension's "saved" icon)."""
    return {"saved": await is_saved(session, user, url)}
