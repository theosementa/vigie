import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

Period = Literal["week", "month", "year"]
Metric = Literal["seen", "added", "watch_time", "backlog"]
Granularity = Literal["day", "week", "month"]


class StatsBlock(BaseModel):
    articles_read: int
    videos_seen: int
    items_added: int
    watch_seconds: int
    reading_minutes: int


class TagCount(BaseModel):
    name: str
    count: int


class SourceCount(BaseModel):
    site_name: str
    count: int


class SharerCount(BaseModel):
    user_id: uuid.UUID
    display_name: str
    count: int


class SharesStats(BaseModel):
    sent: int
    received: int
    by_user: list[SharerCount]


class StreakStats(BaseModel):
    current: int
    best: int


class SummaryOut(BaseModel):
    period: Period
    offset: int
    timezone: str
    start: date
    end: date  # exclusive
    current: StatsBlock
    previous: StatsBlock
    top_tags: list[TagCount]
    top_sources: list[SourceCount]
    shares: SharesStats
    streak: StreakStats
    videos_without_duration: int


class TimeseriesPoint(BaseModel):
    bucket: date
    value: int
    articles: int | None = None
    videos: int | None = None


class TimeseriesOut(BaseModel):
    metric: Metric
    granularity: Granularity
    timezone: str
    points: list[TimeseriesPoint]
