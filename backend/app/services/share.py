import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Item, User
from app.schemas.share import ShareOut
from app.services import realtime
from app.services.events import record_event


async def share_item(
    session: AsyncSession, sender: User, item: Item, emails: list[str], message: str | None
) -> ShareOut:
    recipient_ids: list[uuid.UUID] = []
    sent: list[str] = []  # identical for known and unknown addresses (no account oracle)

    seen_emails: set[str] = set()
    for raw in emails:
        email = raw.strip().lower()
        if not email or email in seen_emails:
            continue
        seen_emails.add(email)
        sent.append(email)

        recipient = await session.scalar(select(User).where(User.email == email))
        if recipient is None or recipient.id == sender.id:
            continue

        existing = await session.scalar(
            select(Item).where(Item.user_id == recipient.id, Item.resource_id == item.resource_id)
        )
        if existing is not None:
            if existing.shared_by_user_id is None:
                existing.shared_by_user_id = sender.id
                existing.share_message = message
            continue

        new_id = uuid.uuid4()
        session.add(
            Item(
                id=new_id,
                user_id=recipient.id,
                resource_id=item.resource_id,
                status="to_watch",
                type_override=item.type_override,
                title_override=item.title_override,
                shared_by_user_id=sender.id,
                share_message=message,
            )
        )
        record_event(
            session,
            user_id=sender.id,
            item_id=item.id,
            resource_id=item.resource_id,
            kind="shared",
            other_user_id=recipient.id,
        )
        record_event(
            session,
            user_id=recipient.id,
            item_id=new_id,
            resource_id=item.resource_id,
            kind="added",
            other_user_id=sender.id,
        )
        recipient_ids.append(recipient.id)

    await session.commit()
    for recipient_id in recipient_ids:
        realtime.publish(recipient_id, ["items", "stats", "tags"])
    return ShareOut(sent=sent)
