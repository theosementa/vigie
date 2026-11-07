import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.resource import Resource
from app.models.tag import Tag
from app.models.user import User


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("user_id", "resource_id", name="uq_items_user_resource"),
        Index("ix_items_user_status_created", "user_id", "status", "created_at"),
        Index("ix_items_user_seen_at", "user_id", "seen_at"),
        Index(
            "ix_items_user_queue_position",
            "user_id",
            "queue_position",
            postgresql_where=text("queue_position IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    resource_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resources.id"))
    status: Mapped[str] = mapped_column(String(20), default="to_watch")
    # per-user override of resources.type (the resource itself is shared between users)
    type_override: Mapped[str | None] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text)
    shared_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    share_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # watch queue: 0-based, contiguous per user; NULL = not queued
    queue_position: Mapped[int | None] = mapped_column(Integer)

    resource: Mapped[Resource] = relationship(lazy="joined")
    shared_by: Mapped[User | None] = relationship(foreign_keys=[shared_by_user_id], lazy="joined")
    tags: Mapped[list[Tag]] = relationship(
        secondary="item_tags", lazy="selectin", order_by=Tag.name
    )
