import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

ROLES = ("admin", "user")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('admin', 'user')", name="ck_users_role"),)

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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
