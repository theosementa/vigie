import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

# What a token may do. Each scope names one capability; the browser extension needs only this one.
SCOPE_ITEMS_ADD = "items:add"


class ApiToken(Base):
    """A revocable, scoped credential for a client that cannot hold the cookie session.

    Only the SHA-256 of the secret is stored (the secret is high-entropy, so a fast hash is
    enough); the user sees it once, at creation. `prefix` is the first characters, to tell
    tokens apart in the list.
    """

    __tablename__ = "api_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(60))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    prefix: Mapped[str] = mapped_column(String(12))
    scope: Mapped[str] = mapped_column(String(40), default=SCOPE_ITEMS_ADD)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
