import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import normalize_email

RegistrationMode = Literal["invite", "open", "closed"]


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    registration_mode: RegistrationMode
    updated_at: datetime
    updated_by: uuid.UUID | None


class SettingsUpdate(BaseModel):
    registration_mode: RegistrationMode


class InvitationIn(BaseModel):
    email: str = Field(max_length=320)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return normalize_email(v)


class InvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    created_by: uuid.UUID | None
    created_at: datetime
    used_at: datetime | None


class AdminUserOut(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    role: Literal["admin", "user"]
    created_at: datetime
    item_count: int


class ResetLinkOut(BaseModel):
    url: str
    expires_at: datetime
