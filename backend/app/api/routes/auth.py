import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError

from app.core.config import email_allowed, settings
from app.core.cookies import clear_session_cookie, set_session_cookie
from app.core.deps import CurrentUser, SessionDep
from app.core.errors import api_error
from app.core.ratelimit import HOUR, MINUTE, enforce, ip_limit, user_limit
from app.core.security import (
    decode_access_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models import Invitation, PasswordReset, User, UserSession
from app.schemas.auth import (
    LoginIn,
    PasswordChangeIn,
    PasswordConfirmIn,
    ProfileUpdate,
    RegisterIn,
    ResetIn,
    SessionOut,
    UserOut,
    is_special_use_email,
)
from app.services import realtime
from app.services.accounts import delete_account, get_instance_settings, lock_registration
from app.services.sessions import revoke_sessions, start_session

router = APIRouter(prefix="/auth", tags=["auth"])

_DUMMY_HASH = hash_password("dummy-password-for-timing")


def _email_taken():
    return api_error(status.HTTP_409_CONFLICT, "email_taken", "Email already registered")


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(ip_limit("register", 5, HOUR))],
)
async def register(
    body: RegisterIn, request: Request, response: Response, session: SessionDep
) -> User:
    if not email_allowed(body.email):
        raise api_error(403, "email_not_allowed", "This address is not allowed on this instance.")
    mode = (await get_instance_settings(session)).registration_mode
    await lock_registration(session)  # serialises signups until commit
    is_first = not await session.scalar(select(func.count()).select_from(User))
    invitation: Invitation | None = None

    if mode == "open" and is_special_use_email(body.email):
        await session.rollback()
        raise api_error(
            422,
            "email_domain_not_allowed",
            "This email domain cannot receive mail; use a real address.",
        )
    if not is_first:
        if mode == "closed":
            await session.rollback()
            raise api_error(403, "registration_closed", "Registration is closed on this instance.")
        if mode == "invite":
            invitation = await session.scalar(
                select(Invitation).where(
                    Invitation.email == body.email, Invitation.used_at.is_(None)
                )
            )
            if invitation is None:
                await session.rollback()
                raise api_error(403, "not_invited", "This email address has not been invited.")

    if await session.scalar(select(User.id).where(User.email == body.email)):
        await session.rollback()
        raise _email_taken()
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role="admin" if is_first else "user",
        token_version=0,
        timezone=body.timezone or "UTC",
    )
    session.add(user)
    if invitation is not None:
        invitation.used_at = datetime.now(UTC)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise _email_taken() from None
    await start_session(request, response, session, user)
    return user


@router.post(
    "/login", response_model=UserOut, dependencies=[Depends(ip_limit("login", 10, MINUTE))]
)
async def login(body: LoginIn, request: Request, response: Response, session: SessionDep) -> User:
    enforce(f"login:email:{body.email}", 5, MINUTE)
    user = await session.scalar(select(User).where(User.email == body.email))
    if user is not None and not email_allowed(user.email):
        user = None  # off the allow list: indistinguishable from an unknown address
    # always verify, against a dummy hash for unknown emails: same work, same answer
    valid = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not valid:
        raise api_error(401, "invalid_credentials", "Invalid email or password")
    await start_session(request, response, session, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, session: SessionDep) -> None:
    token = request.cookies.get(settings.cookie_name)
    decoded = decode_access_token(token) if token else None
    if decoded is not None:
        try:
            sid = uuid.UUID(decoded[2])
        except ValueError:
            sid = None
        if sid is not None:
            await session.execute(delete(UserSession).where(UserSession.id == sid))
            await session.commit()
            realtime.revoke([sid])
    clear_session_cookie(request, response)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    request: Request, response: Response, user: CurrentUser, session: SessionDep
) -> None:
    user.token_version += 1
    await session.commit()
    await revoke_sessions(session, user.id)
    clear_session_cookie(request, response)


@router.post(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(user_limit("password", 5, MINUTE))],
)
async def change_password(
    body: PasswordChangeIn,
    request: Request,
    response: Response,
    user: CurrentUser,
    session: SessionDep,
) -> None:
    if not verify_password(body.current_password, user.password_hash):
        raise api_error(403, "wrong_password", "The current password is incorrect.")
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1  # every other session is revoked
    await session.commit()
    current: uuid.UUID = request.state.session_id
    await revoke_sessions(session, user.id, keep=current)
    set_session_cookie(request, response, user, current)  # the caller stays signed in


@router.post(
    "/reset",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(ip_limit("reset", 5, HOUR))],
)
async def reset_password(body: ResetIn, session: SessionDep) -> None:
    now = datetime.now(UTC)
    reset = await session.scalar(
        select(PasswordReset)
        .where(PasswordReset.token_hash == hash_token(body.token))
        .with_for_update()
    )
    if reset is None or reset.used_at is not None or reset.expires_at <= now:
        raise api_error(400, "invalid_reset_token", "This reset link is invalid or has expired.")
    reset.used_at = now
    await session.execute(
        update(User)
        .where(User.id == reset.user_id)
        .values(password_hash=hash_password(body.password), token_version=User.token_version + 1)
    )
    await session.commit()
    await revoke_sessions(session, reset.user_id)


@router.get("/me", response_model=UserOut)
async def get_me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(body: ProfileUpdate, user: CurrentUser, session: SessionDep) -> User:
    fields = body.model_fields_set
    if "first_name" in fields and body.first_name is not None:
        user.first_name = body.first_name
    if "last_name" in fields and body.last_name is not None:
        user.last_name = body.last_name
    if "timezone" in fields and body.timezone is not None:
        user.timezone = body.timezone
    if "locale" in fields and body.locale is not None:
        user.locale = body.locale
    if "theme" in fields and body.theme is not None:
        user.theme = body.theme
    if "mobile_layout" in fields and body.mobile_layout is not None:
        user.mobile_layout = body.mobile_layout
    if "hidden_types" in fields and body.hidden_types is not None:
        user.hidden_types = body.hidden_types
    if "auto_create_contacts" in fields and body.auto_create_contacts is not None:
        user.auto_create_contacts = body.auto_create_contacts
    await session.commit()
    return user


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    request: Request, user: CurrentUser, session: SessionDep
) -> list[SessionOut]:
    current: uuid.UUID = request.state.session_id
    rows = await session.scalars(
        select(UserSession)
        .where(UserSession.user_id == user.id)
        .order_by(UserSession.last_seen_at.desc())
    )
    return [
        SessionOut(
            id=r.id,
            device=r.device,
            ip=r.ip,
            created_at=r.created_at,
            last_seen_at=r.last_seen_at,
            current=r.id == current,
        )
        for r in rows
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: uuid.UUID,
    request: Request,
    response: Response,
    user: CurrentUser,
    session: SessionDep,
) -> None:
    target = await session.get(UserSession, session_id)
    if target is None or target.user_id != user.id:
        raise api_error(404, "not_found", "Device not found")
    await session.delete(target)
    await session.commit()
    realtime.revoke([session_id])
    if session_id == request.state.session_id:
        clear_session_cookie(request, response)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    body: PasswordConfirmIn,
    request: Request,
    response: Response,
    user: CurrentUser,
    session: SessionDep,
) -> None:
    if not verify_password(body.password, user.password_hash):
        raise api_error(403, "wrong_password", "The password is incorrect.")
    await delete_account(session, user)
    clear_session_cookie(request, response)
