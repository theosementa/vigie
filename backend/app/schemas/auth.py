import re
import uuid
from datetime import datetime
from functools import lru_cache
from typing import Annotated, Literal, get_args
from zoneinfo import available_timezones

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.models.user import Locale, MobileLayout, Theme
from app.schemas.resource import ItemType

# Not-so-private names (RFC 6761 / 8375 and homelab habits). Accepted in `invite` and `closed`
# instances (homelabs), refused in `open` ones, where the address could never be reached.
SPECIAL_USE_SUFFIXES = (".local", ".lan", ".home.arpa", ".test", ".internal")

Role = Literal["admin", "user"]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


@lru_cache(maxsize=1)
def _known_timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def validate_timezone(value: str) -> str:
    value = value.strip()
    if value not in _known_timezones():
        raise ValueError("Invalid IANA timezone")
    return value


_DOMAIN = re.compile(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}")


def is_special_use_email(email: str) -> bool:
    domain = email.rpartition("@")[2].lower()
    return any(domain.endswith(s) for s in SPECIAL_USE_SUFFIXES)


def normalize_email(value: str) -> str:
    """Validate and lower-case an address. Whether a special-use domain is acceptable depends on
    the instance's registration mode, which the route checks."""
    value = value.strip()
    local, _, domain = value.rpartition("@")
    try:
        if is_special_use_email(value):
            # email-validator refuses these names outright: validate the local part against a
            # stand-in domain and the domain syntax ourselves.
            domain = domain.lower()
            if not _DOMAIN.fullmatch(domain):
                raise EmailNotValidError("The part after the @-sign is not a valid domain.")
            checked = validate_email(f"{local}@example.com", check_deliverability=False)
            return f"{checked.local_part}@{domain}".lower()
        return validate_email(value, check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:
        raise ValueError(str(exc)) from None


class _EmailIn(BaseModel):
    email: str = Field(max_length=320)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return normalize_email(v)


class RegisterIn(_EmailIn):
    password: str = Field(min_length=8, max_length=128)
    first_name: Name
    last_name: Name
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def check_timezone(cls, v: str | None) -> str | None:
        return validate_timezone(v) if v else None


class ProfileUpdate(BaseModel):
    first_name: Name | None = None
    last_name: Name | None = None
    timezone: str | None = Field(default=None, max_length=64)
    locale: Locale | None = None
    theme: Theme | None = None
    mobile_layout: MobileLayout | None = None
    hidden_types: list[ItemType] | None = None

    @field_validator("hidden_types")
    @classmethod
    def check_hidden_types(cls, v: list[ItemType] | None) -> list[ItemType] | None:
        if v is None:
            return None
        unique = list(dict.fromkeys(v))
        if len(unique) >= len(get_args(ItemType)):
            raise ValueError("At least one type must stay visible")
        return unique

    @field_validator("timezone")
    @classmethod
    def check_timezone(cls, v: str | None) -> str | None:
        return None if v is None else validate_timezone(v)


class LoginIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.strip().lower()


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class PasswordConfirmIn(BaseModel):
    password: str


class ResetIn(BaseModel):
    token: str = Field(max_length=200)
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    role: Role
    timezone: str
    locale: Locale
    theme: Theme
    mobile_layout: MobileLayout
    hidden_types: list[ItemType]
    created_at: datetime


class SessionOut(BaseModel):
    """A signed-in device."""

    id: uuid.UUID
    device: str
    ip: str | None
    created_at: datetime
    last_seen_at: datetime
    current: bool


class UserRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
