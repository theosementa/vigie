from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict


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


class ErrorDetail(BaseModel):
    """The `detail` of an error raised by the API. Some errors add fields (e.g. `item_id`)."""

    model_config = ConfigDict(extra="allow")

    code: str
    message: str


class ErrorResponse(BaseModel):
    """Body of a 4xx answer raised by the API: `{"detail": {"code", "message", ...}}`."""

    detail: ErrorDetail
