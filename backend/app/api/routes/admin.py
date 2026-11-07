import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.core.deps import AdminUser, SessionDep, require_admin
from app.core.errors import ErrorResponse, api_error
from app.models import InstanceSettings, Invitation, Item, User
from app.schemas.admin import (
    AdminUserOut,
    InvitationIn,
    InvitationOut,
    ResetLinkOut,
    SettingsOut,
    SettingsUpdate,
)
from app.services.accounts import (
    create_reset_link,
    delete_account,
    get_instance_settings,
    public_base_url,
)

# Non-admins get a 404 on every route here, so the section stays hidden.
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
    responses={404: {"model": ErrorResponse}},
)


@router.get("/settings", response_model=SettingsOut)
async def get_admin_settings(session: SessionDep) -> InstanceSettings:
    return await get_instance_settings(session)


@router.patch("/settings", response_model=SettingsOut)
async def update_admin_settings(
    body: SettingsUpdate, admin: AdminUser, session: SessionDep
) -> InstanceSettings:
    row = await get_instance_settings(session)
    row.registration_mode = body.registration_mode
    row.updated_by = admin.id
    row.updated_at = datetime.now(UTC)
    await session.commit()
    return row


@router.get("/invitations", response_model=list[InvitationOut])
async def list_admin_invitations(session: SessionDep) -> list[Invitation]:
    rows = await session.scalars(select(Invitation).order_by(Invitation.created_at.desc()))
    return list(rows)


@router.post("/invitations", response_model=InvitationOut)
async def create_admin_invitation(
    body: InvitationIn, response: Response, admin: AdminUser, session: SessionDep
) -> Invitation:
    """Idempotent: inviting an address twice returns the existing invitation (200)."""
    inserted = await session.scalar(
        insert(Invitation)
        .values(id=uuid.uuid4(), email=body.email, created_by=admin.id)
        .on_conflict_do_nothing(index_elements=["email"])
        .returning(Invitation.id)
    )
    await session.commit()
    invitation = await session.scalar(select(Invitation).where(Invitation.email == body.email))
    assert invitation is not None
    response.status_code = status.HTTP_201_CREATED if inserted else status.HTTP_200_OK
    return invitation


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_invitation(invitation_id: uuid.UUID, session: SessionDep) -> None:
    invitation = await session.get(Invitation, invitation_id)
    if invitation is None:
        raise api_error(404, "invitation_not_found", "Invitation not found")
    await session.delete(invitation)
    await session.commit()


@router.get("/users", response_model=list[AdminUserOut])
async def list_admin_users(session: SessionDep) -> list[AdminUserOut]:
    count = func.count(Item.id)
    rows = await session.execute(
        select(User, count)
        .outerjoin(Item, Item.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at, User.id)
    )
    return [
        AdminUserOut(
            id=u.id,
            first_name=u.first_name,
            last_name=u.last_name,
            email=u.email,
            role=u.role,  # type: ignore[arg-type]
            created_at=u.created_at,
            item_count=n,
        )
        for u, n in rows
    ]


async def _get_user(session: SessionDep, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise api_error(404, "user_not_found", "User not found")
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_user(user_id: uuid.UUID, admin: AdminUser, session: SessionDep) -> None:
    if user_id == admin.id:
        raise api_error(
            400, "cannot_delete_self", "Delete your own account from your profile settings."
        )
    await delete_account(session, await _get_user(session, user_id))


@router.post("/users/{user_id}/reset-link", response_model=ResetLinkOut)
async def create_admin_reset_link(
    user_id: uuid.UUID, request: Request, session: SessionDep
) -> ResetLinkOut:
    user = await _get_user(session, user_id)
    url, expires_at = await create_reset_link(session, user.id, public_base_url(request))
    return ResetLinkOut(url=url, expires_at=expires_at)
