from pydantic import BaseModel, Field


class ShareIn(BaseModel):
    emails: list[str] = Field(min_length=1, max_length=50)
    message: str | None = Field(default=None, max_length=1000)


class ShareOut(BaseModel):
    # Every submitted address, whether or not it has an account: the response must never
    # reveal which emails are registered (see SECURITY.md).
    sent: list[str]
