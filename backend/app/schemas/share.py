from pydantic import BaseModel, Field, field_validator

from app.schemas.auth import normalize_email


class ShareIn(BaseModel):
    emails: list[str] = Field(min_length=1, max_length=50)
    message: str | None = Field(default=None, max_length=1000)

    @field_validator("emails")
    @classmethod
    def check_emails(cls, v: list[str]) -> list[str]:
        # syntax only, the same for every address: never depends on who has an account
        return [normalize_email(e) for e in v]


class ShareOut(BaseModel):
    # Every submitted address, whether or not it has an account: the response must never
    # reveal which emails are registered (see SECURITY.md).
    sent: list[str]
    # Submitted addresses not in the sender's own address book (always empty when they have
    # "save recipients automatically" on). Depends only on the sender's data.
    unknown_contacts: list[str]
