import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ItemEvent


def record_event(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    item_id: uuid.UUID,
    resource_id: uuid.UUID,
    kind: str,
    occurred_at: datetime | None = None,
    other_user_id: uuid.UUID | None = None,
    was_seen: bool | None = None,
) -> None:
    """Add an event to the session; it is committed with the change that caused it."""
    session.add(
        ItemEvent(
            user_id=user_id,
            item_id=item_id,
            resource_id=resource_id,
            kind=kind,
            occurred_at=occurred_at or datetime.now(UTC),
            other_user_id=other_user_id,
            was_seen=was_seen,
        )
    )
