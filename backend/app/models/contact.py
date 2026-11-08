import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Contact(Base):
    """An entry in a user's private address book: any address, named however they like."""

    __tablename__ = "contacts"
    __table_args__ = (UniqueConstraint("owner_user_id", "email", name="uq_contacts_owner_email"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    email: Mapped[str] = mapped_column(String(320))  # lower-cased
    name: Mapped[str | None] = mapped_column(String(100))  # only what the owner typed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ShareLog(Base):
    """One row per address a user shared something with, registered or not."""

    __tablename__ = "share_log"
    __table_args__ = (
        Index("ix_share_log_sender_recipient_at", "sender_user_id", "recipient_email", "shared_at"),
        Index("ix_share_log_recipient_at", "recipient_user_id", "shared_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sender_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    recipient_email: Mapped[str] = mapped_column(String(320))
    # filled only when the item was delivered to an account; never exposed to the sender
    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resources.id"))
    message: Mapped[str | None] = mapped_column(Text)
    shared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
