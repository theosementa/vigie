import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Contact, Item, ShareLog, User
from app.schemas.share import ShareOut
from app.services import realtime
from app.services.events import record_event


async def share_item(
    session: AsyncSession, sender: User, item: Item, emails: list[str], message: str | None
) -> ShareOut:
    recipient_ids: list[uuid.UUID] = []
    sent: list[str] = []  # identical for known and unknown addresses (no account oracle)
    others: list[str] = []  # every submitted address except the sender's own

    seen_emails: set[str] = set()
    for raw in emails:
        email = raw.strip().lower()
        if not email or email in seen_emails:
            continue
        seen_emails.add(email)
        sent.append(email)

        if email == sender.email:
            continue
        others.append(email)

        recipient = await session.scalar(select(User).where(User.email == email))
        # One log row per address, known or not, so the sender's history looks the same either
        # way. The recipient is recorded only when something was delivered, and never shown back.
        log = ShareLog(
            sender_user_id=sender.id,
            recipient_email=email,
            resource_id=item.resource_id,
            message=message,
        )
        session.add(log)
        if recipient is None:
            continue

        existing = await session.scalar(
            select(Item).where(Item.user_id == recipient.id, Item.resource_id == item.resource_id)
        )
        if existing is not None:
            if existing.shared_by_user_id is None:
                existing.shared_by_user_id = sender.id
                existing.share_message = message
                log.recipient_user_id = recipient.id
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
        log.recipient_user_id = recipient.id
        recipient_ids.append(recipient.id)

    # Only the sender's own address book decides what is "unknown": no account oracle.
    known = set(
        await session.scalars(
            select(Contact.email).where(
                Contact.owner_user_id == sender.id, Contact.email.in_(others)
            )
        )
    )
    unknown = [e for e in others if e not in known]
    if unknown and sender.auto_create_contacts:
        await session.execute(
            pg_insert(Contact)
            .values([{"id": uuid.uuid4(), "owner_user_id": sender.id, "email": e} for e in unknown])
            .on_conflict_do_nothing(constraint="uq_contacts_owner_email")
        )
        unknown = []

    await session.commit()
    for recipient_id in recipient_ids:
        realtime.publish(recipient_id, ["items", "stats", "tags", "contacts"])
    realtime.publish(sender.id, ["contacts"])
    return ShareOut(sent=sent, unknown_contacts=unknown)
