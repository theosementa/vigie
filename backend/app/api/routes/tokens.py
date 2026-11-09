import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select

from app.core.deps import CurrentUser, SessionDep
from app.core.errors import ErrorResponse, api_error
from app.core.ratelimit import HOUR, user_limit
from app.models import ApiToken
from app.schemas.token import TokenCreate, TokenCreated, TokenOut
from app.services.tokens import create_token

# Managed from the signed-in app only: a token can never create or revoke tokens.
router = APIRouter(prefix="/tokens", tags=["tokens"], responses={404: {"model": ErrorResponse}})


@router.get("", response_model=list[TokenOut])
async def list_tokens(user: CurrentUser, session: SessionDep) -> list[ApiToken]:
    return list(
        await session.scalars(
            select(ApiToken).where(ApiToken.user_id == user.id).order_by(ApiToken.created_at.desc())
        )
    )


@router.post(
    "",
    response_model=TokenCreated,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse}},
    dependencies=[Depends(user_limit("token_create", 20, HOUR))],
)
async def generate_token(body: TokenCreate, user: CurrentUser, session: SessionDep):
    row, secret = await create_token(session, user.id, body.name)
    return TokenCreated(
        id=row.id,
        name=row.name,
        prefix=row.prefix,
        scope=row.scope,
        created_at=row.created_at,
        last_used_at=row.last_used_at,
        token=secret,
    )


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_token(token_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    token = await session.scalar(
        select(ApiToken).where(ApiToken.id == token_id, ApiToken.user_id == user.id)
    )
    if token is None:
        raise api_error(404, "not_found", "Token not found")
    await session.delete(token)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
