"""Instance-level counters for the admin. Aggregates only: nothing here reads item content."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Date, DateTime, Text, cast, distinct, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Invitation, Item, ItemEvent, User, UserSession
from app.schemas.analytics import (
    AnalyticsActive,
    AnalyticsOut,
    AnalyticsPoint,
    AnalyticsTotals,
    AnalyticsWindow,
)


def _now() -> datetime:  # patched in tests
    return datetime.now(UTC)


def _local_day(column, tz: str):
    return cast(func.timezone(cast(literal(tz), Text), column), Date)


def _local_midnight(d: date, tz: str):
    return func.timezone(cast(literal(tz), Text), cast(literal(d, Date), DateTime))


async def _by_day(session: AsyncSession, query) -> dict[date, int]:
    return {day: n for day, n in (await session.execute(query)).all()}


async def instance_analytics(session: AsyncSession, tz: str, days: int) -> AnalyticsOut:
    now = _now()
    today = now.astimezone(ZoneInfo(tz)).date()
    start = today - timedelta(days=days - 1)
    lo = _local_midnight(start, tz)

    async def count(query) -> int:
        return await session.scalar(query) or 0

    totals = AnalyticsTotals(
        accounts=await count(select(func.count()).select_from(User)),
        admins=await count(select(func.count()).where(User.role == "admin")),
        items=await count(select(func.count()).select_from(Item)),
        unseen_items=await count(select(func.count()).where(Item.status != "seen")),
        queued_items=await count(select(func.count()).where(Item.queue_position.is_not(None))),
        shared_items=await count(select(func.count()).where(Item.shared_by_user_id.is_not(None))),
        pending_invitations=await count(select(func.count()).where(Invitation.used_at.is_(None))),
    )

    async def active_since(delta: timedelta) -> int:
        return await count(
            select(func.count(distinct(UserSession.user_id))).where(
                UserSession.last_seen_at >= now - delta
            )
        )

    active = AnalyticsActive(
        day=await active_since(timedelta(days=1)),
        week=await active_since(timedelta(days=7)),
        month=await active_since(timedelta(days=30)),
    )

    ev_day = _local_day(ItemEvent.occurred_at, tz)

    def events_per_day(kind: str):
        return (
            select(ev_day, func.count())
            .where(ItemEvent.kind == kind, ItemEvent.occurred_at >= lo)
            .group_by(ev_day)
        )

    user_day = _local_day(User.created_at, tz)  # one expression, so one bind for SELECT/GROUP BY
    signups = await _by_day(
        session,
        select(user_day, func.count()).where(User.created_at >= lo).group_by(user_day),
    )
    added = await _by_day(session, events_per_day("added"))
    seen = await _by_day(session, events_per_day("seen"))
    shared = await _by_day(session, events_per_day("shared"))
    actives = await _by_day(
        session,
        select(ev_day, func.count(distinct(ItemEvent.user_id)))
        .where(ItemEvent.occurred_at >= lo)
        .group_by(ev_day),
    )

    series = [
        AnalyticsPoint(
            day=d,
            new_accounts=signups.get(d, 0),
            items_added=added.get(d, 0),
            items_seen=seen.get(d, 0),
            active_accounts=actives.get(d, 0),
        )
        for d in (start + timedelta(days=i) for i in range(days))
    ]
    window = AnalyticsWindow(
        new_accounts=sum(signups.values()),
        items_added=sum(added.values()),
        items_seen=sum(seen.values()),
        shares=sum(shared.values()),
    )
    return AnalyticsOut(
        days=days,
        timezone=tz,
        start=start,
        end=today,
        totals=totals,
        active=active,
        window=window,
        series=series,
    )
