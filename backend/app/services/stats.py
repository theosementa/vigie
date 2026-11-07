from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Date, DateTime, Text, cast, func, literal, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models import Item, ItemEvent, ItemTag, Resource, Tag, User
from app.schemas.stats import (
    Granularity,
    Metric,
    Period,
    SharerCount,
    SharesStats,
    SourceCount,
    StatsBlock,
    StreakStats,
    SummaryOut,
    TagCount,
    TimeseriesOut,
    TimeseriesPoint,
)

TOP_LIMIT = 5
MAX_BUCKETS = 400

# Interpolated into SQL: only ever taken from this closed mapping (never from user input).
_STEP = {"day": "1 day", "week": "1 week", "month": "1 month"}


def _now() -> datetime:  # patched in tests
    return datetime.now(UTC)


def local_today(tz: str) -> date:
    return _now().astimezone(ZoneInfo(tz)).date()


# --- period / bucket arithmetic (local dates) ---------------------------------------------------


def period_bounds(period: Period, today: date, offset: int) -> tuple[date, date]:
    """[start, end) of the period `offset` periods away from the one containing `today`."""
    if period == "week":
        start = today - timedelta(days=today.weekday()) + timedelta(weeks=offset)
        return start, start + timedelta(weeks=1)
    if period == "month":
        idx = today.year * 12 + today.month - 1 + offset
        (y1, m1), (y2, m2) = divmod(idx, 12), divmod(idx + 1, 12)
        return date(y1, m1 + 1, 1), date(y2, m2 + 1, 1)
    year = today.year + offset
    return date(year, 1, 1), date(year + 1, 1, 1)


def bucket_start(d: date, granularity: Granularity) -> date:
    if granularity == "week":
        return d - timedelta(days=d.weekday())
    if granularity == "month":
        return d.replace(day=1)
    return d


def next_bucket(d: date, granularity: Granularity) -> date:
    """Start of the bucket following the one starting at `d`."""
    if granularity == "week":
        return d + timedelta(weeks=1)
    if granularity == "month":
        return date(d.year + d.month // 12, d.month % 12 + 1, 1)
    return d + timedelta(days=1)


def bucket_count(lo: date, last: date, granularity: Granularity) -> int:
    if granularity == "day":
        return (last - lo).days + 1
    if granularity == "week":
        return (last - lo).days // 7 + 1
    return (last.year - lo.year) * 12 + last.month - lo.month + 1


# --- summary ------------------------------------------------------------------------------------


def _tz(user: User) -> ColumnElement:
    return cast(literal(user.timezone), Text)


def _local_ts(user: User, d: date) -> ColumnElement:
    """Local midnight of `d` in the user's timezone, as a timestamptz."""
    return func.timezone(_tz(user), cast(literal(d, Date), DateTime))


def _effective_type() -> ColumnElement:
    return func.coalesce(Item.type_override, Resource.type)


def _seen_filters(user: User, start: date, end: date) -> list[ColumnElement[bool]]:
    return [
        Item.user_id == user.id,
        Item.status == "seen",
        Item.seen_at >= _local_ts(user, start),
        Item.seen_at < _local_ts(user, end),
    ]


def _event_filters(user: User, kind: str, start: date, end: date) -> list[ColumnElement[bool]]:
    return [
        ItemEvent.user_id == user.id,
        ItemEvent.kind == kind,
        ItemEvent.occurred_at >= _local_ts(user, start),
        ItemEvent.occurred_at < _local_ts(user, end),
    ]


async def _block(
    session: AsyncSession, user: User, start: date, end: date
) -> tuple[StatsBlock, int]:
    """Counters of a period, and the number of seen videos without a duration."""
    eff = _effective_type()
    row = (
        await session.execute(
            select(
                func.count().filter(eff == "article"),
                func.count().filter(eff == "video"),
                func.coalesce(func.sum(Resource.duration_seconds).filter(eff == "video"), 0),
                func.coalesce(func.sum(Resource.reading_time_minutes).filter(eff == "article"), 0),
                func.count().filter(eff == "video", Resource.duration_seconds.is_(None)),
            )
            .select_from(Item)
            .join(Resource, Resource.id == Item.resource_id)
            .where(*_seen_filters(user, start, end))
        )
    ).one()
    added = await session.scalar(
        select(func.count()).where(*_event_filters(user, "added", start, end))
    )
    block = StatsBlock(
        articles_read=row[0],
        videos_seen=row[1],
        items_added=added or 0,
        watch_seconds=int(row[2]),
        reading_minutes=int(row[3]),
    )
    return block, row[4]


async def _top_tags(session: AsyncSession, user: User, start: date, end: date) -> list[TagCount]:
    count = func.count()
    rows = await session.execute(
        select(Tag.name, count)
        .select_from(Item)
        .join(ItemTag, ItemTag.item_id == Item.id)
        .join(Tag, Tag.id == ItemTag.tag_id)
        .where(*_seen_filters(user, start, end))
        .group_by(Tag.id, Tag.name)
        .order_by(count.desc(), Tag.name)
        .limit(TOP_LIMIT)
    )
    return [TagCount(name=n, count=c) for n, c in rows]


async def _top_sources(
    session: AsyncSession, user: User, start: date, end: date
) -> list[SourceCount]:
    count = func.count()
    rows = await session.execute(
        select(Resource.site_name, count)
        .select_from(Item)
        .join(Resource, Resource.id == Item.resource_id)
        .where(*_seen_filters(user, start, end), Resource.site_name.is_not(None))
        .group_by(Resource.site_name)
        .order_by(count.desc(), Resource.site_name)
        .limit(TOP_LIMIT)
    )
    return [SourceCount(site_name=n, count=c) for n, c in rows]


async def _shares(session: AsyncSession, user: User, start: date, end: date) -> SharesStats:
    sent = await session.scalar(
        select(func.count()).where(*_event_filters(user, "shared", start, end))
    )
    received_filters = [
        *_event_filters(user, "added", start, end),
        ItemEvent.other_user_id.is_not(None),
    ]
    received = await session.scalar(select(func.count()).where(*received_filters))
    count = func.count()
    rows = await session.execute(
        select(User.id, User.first_name, User.last_name, count)
        .select_from(ItemEvent)
        .join(User, User.id == ItemEvent.other_user_id)
        .where(*received_filters)
        .group_by(User.id, User.first_name, User.last_name)
        .order_by(count.desc(), User.first_name, User.last_name)
    )
    return SharesStats(
        sent=sent or 0,
        received=received or 0,
        by_user=[
            SharerCount(user_id=i, first_name=f, last_name=ln, count=c) for i, f, ln, c in rows
        ],
    )


_STREAK_SQL = text(
    """
    WITH days AS (
        SELECT CAST(occurred_at AT TIME ZONE CAST(:tz AS text) AS date) AS d
        FROM item_events
        WHERE user_id = :uid AND kind IN ('seen', 'unseen')
        GROUP BY 1
        HAVING COUNT(*) FILTER (WHERE kind = 'seen') > COUNT(*) FILTER (WHERE kind = 'unseen')
    ),
    grp AS (
        SELECT d, d - CAST(ROW_NUMBER() OVER (ORDER BY d) AS int) AS g FROM days
    ),
    islands AS (
        SELECT MAX(d) AS last_day, COUNT(*) AS n FROM grp GROUP BY g
    )
    SELECT
        COALESCE(MAX(n), 0) AS best,
        COALESCE(
            (SELECT n FROM islands WHERE last_day >= CAST(:yesterday AS date)
             ORDER BY last_day DESC LIMIT 1),
            0
        ) AS current
    FROM islands
    """
)


async def _streak(session: AsyncSession, user: User, today: date) -> StreakStats:
    row = (
        await session.execute(
            _STREAK_SQL,
            {"tz": user.timezone, "uid": user.id, "yesterday": today - timedelta(days=1)},
        )
    ).one()
    return StreakStats(current=int(row.current), best=int(row.best))


async def summary(session: AsyncSession, user: User, period: Period, offset: int) -> SummaryOut:
    today = local_today(user.timezone)
    start, end = period_bounds(period, today, offset)
    prev_start, prev_end = period_bounds(period, today, offset - 1)

    current, without_duration = await _block(session, user, start, end)
    previous, _ = await _block(session, user, prev_start, prev_end)
    return SummaryOut(
        period=period,
        offset=offset,
        timezone=user.timezone,
        start=start,
        end=end,
        current=current,
        previous=previous,
        top_tags=await _top_tags(session, user, start, end),
        top_sources=await _top_sources(session, user, start, end),
        shares=await _shares(session, user, start, end),
        streak=await _streak(session, user, today),
        videos_without_duration=without_duration,
    )


# --- timeseries ---------------------------------------------------------------------------------

_SEEN_SQL = """
    SELECT CAST(date_trunc('{g}', i.seen_at AT TIME ZONE CAST(:tz AS text)) AS date) AS b,
           COUNT(*) FILTER (WHERE COALESCE(i.type_override, r.type) = 'article') AS articles,
           COUNT(*) FILTER (WHERE COALESCE(i.type_override, r.type) = 'video') AS videos,
           COALESCE(SUM(r.duration_seconds)
                    FILTER (WHERE COALESCE(i.type_override, r.type) = 'video'), 0) AS watch
    FROM items i JOIN resources r ON r.id = i.resource_id
    WHERE i.user_id = :uid AND i.status = 'seen'
      AND i.seen_at >= (CAST(CAST(:lo AS date) AS timestamp) AT TIME ZONE CAST(:tz AS text))
      AND i.seen_at < (CAST(CAST(:hi AS date) AS timestamp) AT TIME ZONE CAST(:tz AS text))
    GROUP BY 1
"""

_ADDED_SQL = """
    SELECT CAST(date_trunc('{g}', e.occurred_at AT TIME ZONE CAST(:tz AS text)) AS date) AS b,
           COUNT(*) AS n
    FROM item_events e
    WHERE e.user_id = :uid AND e.kind = 'added'
      AND e.occurred_at >= (CAST(CAST(:lo AS date) AS timestamp) AT TIME ZONE CAST(:tz AS text))
      AND e.occurred_at < (CAST(CAST(:hi AS date) AS timestamp) AT TIME ZONE CAST(:tz AS text))
    GROUP BY 1
"""

# Backlog = to_watch items: added +1, unseen +1, seen -1, deleted -1 unless it was seen.
_BACKLOG_SQL = """
    SELECT CAST(date_trunc('{g}', e.occurred_at AT TIME ZONE CAST(:tz AS text)) AS date) AS b,
           SUM(CASE e.kind
                   WHEN 'added' THEN 1
                   WHEN 'unseen' THEN 1
                   WHEN 'seen' THEN -1
                   WHEN 'deleted' THEN CASE WHEN COALESCE(e.was_seen, false) THEN 0 ELSE -1 END
                   ELSE 0
               END) AS n
    FROM item_events e
    WHERE e.user_id = :uid
      AND e.occurred_at < (CAST(CAST(:hi AS date) AS timestamp) AT TIME ZONE CAST(:tz AS text))
    GROUP BY 1
"""


def _series_sql(granularity: Granularity, data_sql: str, columns: str, joined: str) -> str:
    step = _STEP[granularity]
    return f"""
        WITH series AS (
            SELECT CAST(gs AS date) AS b
            FROM generate_series(
                CAST(CAST(:lo AS date) AS timestamp),
                CAST(CAST(:last AS date) AS timestamp),
                INTERVAL '{step}'
            ) AS gs
        ),
        data AS ({data_sql.format(g=granularity)})
        SELECT s.b AS bucket, {columns}
        FROM series s {joined}
        ORDER BY s.b
    """


async def timeseries(
    session: AsyncSession,
    user: User,
    metric: Metric,
    granularity: Granularity,
    from_: date,
    to: date,
) -> TimeseriesOut:
    lo = bucket_start(from_, granularity)
    last = bucket_start(to, granularity)
    hi = next_bucket(last, granularity)
    params = {"tz": user.timezone, "uid": user.id, "lo": lo, "last": last, "hi": hi}

    if metric == "seen" or metric == "watch_time":
        sql = _series_sql(
            granularity,
            _SEEN_SQL,
            "COALESCE(d.articles, 0) AS articles, COALESCE(d.videos, 0) AS videos, "
            "COALESCE(d.watch, 0) AS watch",
            "LEFT JOIN data d ON d.b = s.b",
        )
        rows = (await session.execute(text(sql), params)).all()
        if metric == "seen":
            points = [
                TimeseriesPoint(
                    bucket=r.bucket,
                    value=r.articles + r.videos,
                    articles=r.articles,
                    videos=r.videos,
                )
                for r in rows
            ]
        else:
            points = [TimeseriesPoint(bucket=r.bucket, value=int(r.watch)) for r in rows]
    elif metric == "added":
        sql = _series_sql(
            granularity, _ADDED_SQL, "COALESCE(d.n, 0) AS n", "LEFT JOIN data d ON d.b = s.b"
        )
        rows = (await session.execute(text(sql), params)).all()
        points = [TimeseriesPoint(bucket=r.bucket, value=int(r.n)) for r in rows]
    else:  # backlog: cumulative sum of the deltas up to the end of each bucket
        sql = _series_sql(
            granularity,
            _BACKLOG_SQL,
            "COALESCE((SELECT SUM(d.n) FROM data d WHERE d.b <= s.b), 0) AS n",
            "",
        )
        rows = (await session.execute(text(sql), params)).all()
        points = [TimeseriesPoint(bucket=r.bucket, value=int(r.n)) for r in rows]

    return TimeseriesOut(
        metric=metric, granularity=granularity, timezone=user.timezone, points=points
    )
