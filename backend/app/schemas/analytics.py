from datetime import date

from pydantic import BaseModel

ANALYTICS_DAYS = (7, 30, 90)


class AnalyticsTotals(BaseModel):
    accounts: int
    admins: int
    items: int
    unseen_items: int
    queued_items: int
    shared_items: int
    pending_invitations: int


class AnalyticsActive(BaseModel):
    """Distinct accounts with a signed-in device seen in the last day / week / month."""

    day: int
    week: int
    month: int


class AnalyticsWindow(BaseModel):
    """Activity summed over the requested window."""

    new_accounts: int
    items_added: int
    items_seen: int
    shares: int


class AnalyticsPoint(BaseModel):
    day: date
    new_accounts: int
    items_added: int
    items_seen: int
    active_accounts: int


class AnalyticsOut(BaseModel):
    days: int
    timezone: str
    start: date
    end: date  # inclusive (today in `timezone`)
    totals: AnalyticsTotals
    active: AnalyticsActive
    window: AnalyticsWindow
    series: list[AnalyticsPoint]
