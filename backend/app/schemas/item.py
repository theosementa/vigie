import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.auth import UserRef
from app.schemas.resource import ItemType, ResourceOut
from app.schemas.tag import TagRef

ItemStatus = Literal["to_watch", "seen"]


class ItemCreate(BaseModel):
    url: str
    type: ItemType | None = None
    status: ItemStatus = "to_watch"
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] = Field(default_factory=list, max_length=30)
    queue: bool = False


class ItemUpdate(BaseModel):
    type: ItemType | None = None
    status: ItemStatus | None = None
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] | None = Field(default=None, max_length=30)


class ItemOut(BaseModel):
    id: uuid.UUID
    status: ItemStatus
    notes: str | None
    tags: list[TagRef]
    shared_by: UserRef | None
    share_message: str | None
    created_at: datetime
    updated_at: datetime
    seen_at: datetime | None
    queue_position: int | None
    resource: ResourceOut


class ItemList(BaseModel):
    items: list[ItemOut]
    next_cursor: str | None


class QueueAdd(BaseModel):
    item_id: uuid.UUID
    position: int | None = None


class QueueMove(BaseModel):
    position: int


class QueueOut(BaseModel):
    items: list[ItemOut]
