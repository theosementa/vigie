import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

ViewName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class ViewIn(BaseModel):
    name: ViewName
    # library filters as a URL query string, e.g. "tag=pos&type=video" (canonicalised by the server)
    query: str = Field(max_length=1000)


class ViewUpdate(BaseModel):
    name: ViewName | None = None
    position: int | None = Field(default=None, ge=0)


class ViewOut(BaseModel):
    id: uuid.UUID
    name: str
    query: str  # canonical
    position: int
    created_at: datetime
