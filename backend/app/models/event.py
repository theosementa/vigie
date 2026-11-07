import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

EVENT_KINDS = ("added", "seen", "unseen", "deleted", "shared")


class ItemEvent(Base):
    """Append-only journal of what happened to a user's items (feeds the statistics)."""

    __tablename__ = "item_events"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('added', 'seen', 'unseen', 'deleted', 'shared')", name="ck_item_events_kind"
        ),
        Index("ix_item_events_user_occurred", "user_id", "occurred_at"),
        Index("ix_item_events_user_kind_occurred", "user_id", "kind", "occurred_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # no FK: events must survive the deletion of the item
    item_id: Mapped[uuid.UUID]
    resource_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resources.id"))
    kind: Mapped[str] = mapped_column(String(20))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # `shared`: the recipient; `added` created by a share: the sharer
    other_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    # `deleted` only: was the item `seen` when it was deleted (backlog accounting)
    was_seen: Mapped[bool | None] = mapped_column(Boolean)
