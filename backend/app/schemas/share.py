from pydantic import BaseModel, Field


class ShareIn(BaseModel):
    emails: list[str] = Field(min_length=1, max_length=50)
    message: str | None = Field(default=None, max_length=1000)


class ShareOut(BaseModel):
    shared: list[str]
    not_found: list[str]
    already_had: list[str]
