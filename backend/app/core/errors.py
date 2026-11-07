from typing import Any

from fastapi import HTTPException


def api_error(
    status_code: int,
    code: str,
    message: str,
    *,
    headers: dict[str, str] | None = None,
    **extra: Any,
) -> HTTPException:
    """HTTPException whose detail is `{"code": <stable code>, "message": <English sentence>}`."""
    return HTTPException(
        status_code, detail={"code": code, "message": message, **extra}, headers=headers
    )
