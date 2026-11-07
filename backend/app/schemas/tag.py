import uuid

from pydantic import BaseModel, ConfigDict


class TagRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class TagOut(TagRef):
    item_count: int
