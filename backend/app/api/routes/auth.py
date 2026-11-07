from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app.core.cookies import clear_session_cookie, set_session_cookie
from app.core.deps import CurrentUser, SessionDep
from app.core.errors import api_error
from app.core.ratelimit import HOUR, MINUTE, enforce, ip_limit, user_limit
from app.core.security import hash_password, hash_token, verify_password
from app.models import Invitation, PasswordReset, User
from app.schemas.auth import (
    LoginIn,
    PasswordChangeIn,
    PasswordConfirmIn,
    ProfileUpdate,
    RegisterIn,
    ResetIn,
    UserOut,
    is_special_use_email,
)
from app.services.accounts import delete_account, get_instance_settings, lock_registration

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
    set_session_cookie(request, response, user)
    return user


@router.post(
    "/login", response_model=UserOut, dependencies=[Depends(ip_limit("login", 10, MINUTE))]
)
async def login(body: LoginIn, request: Request, response: Response, session: SessionDep) -> User:
    enforce(f"login:email:{body.email}", 5, MINUTE)
    user = await session.scalar(select(User).where(User.email == body.email))
    # always verify, against a dummy hash for unknown emails: same work, same answer
    valid = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not valid:
        raise api_error(401, "invalid_credentials", "Invalid email or password")
    set_session_cookie(request, response, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response) -> None:
    clear_session_cookie(request, response)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    request: Request, response: Response, user: CurrentUser, session: SessionDep
) -> None:
    user.token_version += 1
    await session.commit()
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
    set_session_cookie(request, response, user)


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


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
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
    await session.commit()
    return user


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
