import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class TokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)

    @field_validator("name")
    @classmethod
    def _clean(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("A token needs a name.")
        return value


class TokenOut(BaseModel):
    """A token as listed: never the secret, only its first characters."""

    id: uuid.UUID
    name: str
    prefix: str
    scope: str
    created_at: datetime
    last_used_at: datetime | None


class TokenCreated(TokenOut):
    """The answer to a creation: the only time the secret is shown."""

    token: str
