import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, SessionDep
from app.core.errors import ErrorResponse, api_error
from app.core.ratelimit import MINUTE, enforce
from app.models import Contact, Item, Resource, ShareLog, User
from app.schemas.contact import (
    ContactIn,
    ContactOut,
    ContactUpdate,
    HistoryEntry,
    HistoryPage,
    HistoryResource,
)

router = APIRouter(prefix="/contacts", tags=["contacts"], responses={404: {"model": ErrorResponse}})


async def _get_owned(session: AsyncSession, user_id: uuid.UUID, contact_id: uuid.UUID) -> Contact:
    contact = await session.scalar(
        select(Contact).where(Contact.id == contact_id, Contact.owner_user_id == user_id)
    )
    if contact is None:
        raise api_error(404, "contact_not_found", "Contact not found.")
    return contact


@router.get("", response_model=list[ContactOut])
async def list_contacts(user: CurrentUser, session: SessionDep) -> list[ContactOut]:
    contacts = list(await session.scalars(select(Contact).where(Contact.owner_user_id == user.id)))
    # Activity in both directions, from the user's own sends and from what accounts delivered
    # to them. Nothing here depends on whether an address has an account.
    sent = await session.execute(
        select(ShareLog.recipient_email, func.count(), func.max(ShareLog.shared_at))
        .where(ShareLog.sender_user_id == user.id)
        .group_by(ShareLog.recipient_email)
    )
    activity: dict[str, tuple[int, datetime]] = {e: (n, at) for e, n, at in sent}
    received = await session.execute(
        select(User.email, func.count(), func.max(ShareLog.shared_at))
        .join(User, User.id == ShareLog.sender_user_id)
        .where(ShareLog.recipient_user_id == user.id)
        .group_by(User.email)
    )
    for email, n, at in received:
        count, last = activity.get(email, (0, at))
        activity[email] = (count + n, max(last, at))

    out = [
        ContactOut(
            id=c.id,
            email=c.email,
            name=c.name,
            created_at=c.created_at,
            last_shared_at=activity[c.email][1] if c.email in activity else None,
            share_count=activity[c.email][0] if c.email in activity else 0,
        )
        for c in contacts
    ]
    epoch = datetime.min.replace(tzinfo=UTC)
    out.sort(key=lambda c: (c.last_shared_at or epoch, c.created_at), reverse=True)
    return out


@router.post("", response_model=ContactOut)
async def create_contact(body: ContactIn, user: CurrentUser, session: SessionDep) -> ContactOut:
    enforce(f"contacts:user:{user.id}", 60, MINUTE)
    await session.execute(
        pg_insert(Contact)
        .values(id=uuid.uuid4(), owner_user_id=user.id, email=body.email, name=body.name)
        .on_conflict_do_nothing(constraint="uq_contacts_owner_email")
    )
    await session.commit()
    contacts = await list_contacts(user, session)
    return next(c for c in contacts if c.email == body.email)


@router.patch("/{contact_id}", response_model=ContactOut)
async def update_contact(
    contact_id: uuid.UUID, body: ContactUpdate, user: CurrentUser, session: SessionDep
) -> ContactOut:
    contact = await _get_owned(session, user.id, contact_id)
    contact.name = body.name
    await session.commit()
    contacts = await list_contacts(user, session)
    return next(c for c in contacts if c.id == contact_id)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(contact_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    # The share log stays: adding the address again brings its history back.
    contact = await _get_owned(session, user.id, contact_id)
    await session.delete(contact)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{contact_id}/history", response_model=HistoryPage)
async def contact_history(
    contact_id: uuid.UUID,
    user: CurrentUser,
    session: SessionDep,
    before: datetime | None = None,
    limit: int = Query(30, ge=1, le=100),
) -> HistoryPage:
    contact = await _get_owned(session, user.id, contact_id)

    def query(direction: str):
        stmt = (
            select(ShareLog, Resource, Item)
            .join(Resource, Resource.id == ShareLog.resource_id)
            .outerjoin(Item, (Item.user_id == user.id) & (Item.resource_id == ShareLog.resource_id))
            .order_by(ShareLog.shared_at.desc(), ShareLog.id)
            .limit(limit + 1)
        )
        if direction == "sent":
            stmt = stmt.where(
                ShareLog.sender_user_id == user.id, ShareLog.recipient_email == contact.email
            )
        else:
            # what that account chose to deliver to me: it already knows I have an account
            stmt = stmt.join(User, User.id == ShareLog.sender_user_id).where(
                ShareLog.recipient_user_id == user.id, User.email == contact.email
            )
        if before is not None:
            stmt = stmt.where(ShareLog.shared_at < before)
        return stmt

    rows: list[HistoryEntry] = []
    for direction in ("sent", "received"):
        for log, resource, item in (await session.execute(query(direction))).all():
            rows.append(
                HistoryEntry(
                    id=log.id,
                    direction=direction,  # type: ignore[arg-type]
                    at=log.shared_at,
                    message=log.message,
                    resource=HistoryResource(
                        title=(item.title_override if item and item.title_override else None)
                        or resource.title,
                        type=(item.type_override if item and item.type_override else None)
                        or resource.type,  # type: ignore[arg-type]
                        image_url=resource.image_url,
                        url=resource.url,
                    ),
                    my_item_id=item.id if item else None,
                )
            )
    rows.sort(key=lambda e: e.at, reverse=True)
    page = rows[:limit]
    more = len(rows) > limit
    return HistoryPage(entries=page, next_before=page[-1].at if more and page else None)
