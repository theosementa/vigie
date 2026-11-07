from fastapi import Request, Response

from app.core.config import settings
from app.core.security import create_access_token
from app.models import User


def _secure(request: Request) -> bool:
    if settings.cookie_secure == "auto":
        # uvicorn's proxy headers make request.url.scheme the scheme the browser used
        return request.url.scheme == "https"
    return settings.cookie_secure == "true"


def set_session_cookie(request: Request, response: Response, user: User) -> None:
    response.set_cookie(
        settings.cookie_name,
        create_access_token(str(user.id), user.token_version),
        max_age=settings.jwt_expire_days * 86400,
        httponly=True,
        samesite="lax",
        secure=_secure(request),
        path="/",
    )


def clear_session_cookie(request: Request, response: Response) -> None:
    response.delete_cookie(
        settings.cookie_name,
        path="/",
        httponly=True,
        samesite="lax",
        secure=_secure(request),
    )
