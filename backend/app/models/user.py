import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

ROLES = ("admin", "user")


class Locale(StrEnum):
    AUTO = "auto"
    EN = "en"
    FR = "fr"


class Theme(StrEnum):
    SYSTEM = "system"
    DARK = "dark"
    LIGHT = "light"


class MobileLayout(StrEnum):
    LIST = "list"
    GRID = "grid"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'user')", name="ck_users_role"),
        CheckConstraint("locale IN ('auto', 'en', 'fr')", name="ck_users_locale"),
        CheckConstraint("theme IN ('system', 'dark', 'light')", name="ck_users_theme"),
        CheckConstraint("mobile_layout IN ('list', 'grid')", name="ck_users_mobile_layout"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(50))
    last_name: Mapped[str] = mapped_column(String(50), server_default=text("''"), default="")
    role: Mapped[str] = mapped_column(String(20), server_default=text("'user'"), default="user")
    # bumped to revoke every session (password change, "log out everywhere")
    token_version: Mapped[int] = mapped_column(Integer, server_default=text("0"), default=0)
    # IANA name, used to bucket statistics by local day/week
    timezone: Mapped[str] = mapped_column(String(64), server_default=text("'UTC'"), default="UTC")
    # interface preferences, kept on the account so they follow the user across devices
    locale: Mapped[str] = mapped_column(
        String(10), server_default=text("'auto'"), default=Locale.AUTO
    )
    theme: Mapped[str] = mapped_column(
        String(10), server_default=text("'system'"), default=Theme.SYSTEM
    )
    mobile_layout: Mapped[str] = mapped_column(
        String(10), server_default=text("'list'"), default=MobileLayout.LIST
    )
    # whether the "Repository" type is offered (filter chip, type pickers); off for non-developers
    show_repos: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
