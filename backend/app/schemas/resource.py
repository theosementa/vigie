import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ItemType = Literal["article", "video", "website", "repo"]
MAX_URL_LENGTH = 2048


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    type: ItemType
    title: str
    description: str | None = None
    image_url: str | None = None
    site_name: str | None = None
    favicon_url: str | None = None
    author: str | None = None
    duration_seconds: int | None = None
    reading_time_minutes: int | None = None
    published_at: datetime | None = None
    fetched_at: datetime


class PreviewIn(BaseModel):
    url: str = Field(max_length=MAX_URL_LENGTH)


class PreviewOut(BaseModel):
    url: str
    type: ItemType
    title: str
    description: str | None = None
    image_url: str | None = None
    site_name: str | None = None
    favicon_url: str | None = None
    author: str | None = None
    duration_seconds: int | None = None
    reading_time_minutes: int | None = None
    published_at: datetime | None = None
    existing_item_id: uuid.UUID | None = None
