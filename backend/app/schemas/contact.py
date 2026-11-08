import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.schemas.auth import normalize_email
from app.schemas.resource import ItemType

# What the owner typed. Empty means "no name" (the UI falls back to the address).
ContactName = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]


class ContactIn(BaseModel):
    email: str = Field(max_length=320)
    name: ContactName | None = None

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return normalize_email(v)

    @field_validator("name")
    @classmethod
    def blank_name(cls, v: str | None) -> str | None:
        return v or None


class ContactUpdate(BaseModel):
    name: ContactName | None = None

    @field_validator("name")
    @classmethod
    def blank_name(cls, v: str | None) -> str | None:
        return v or None


class ContactOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    created_at: datetime
    last_shared_at: datetime | None
    share_count: int


class HistoryResource(BaseModel):
    title: str
    type: ItemType
    image_url: str | None
    url: str


class HistoryEntry(BaseModel):
    id: uuid.UUID
    direction: Literal["sent", "received"]
    at: datetime
    message: str | None
    resource: HistoryResource
    # the reader's own item for this resource, when they still have it
    my_item_id: uuid.UUID | None


class HistoryPage(BaseModel):
    entries: list[HistoryEntry]
    # pass as `before` to get older entries; null when this is the oldest page
    next_before: datetime | None
