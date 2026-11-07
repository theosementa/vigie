from datetime import date

from fastapi import APIRouter, HTTPException, Query

from app.core.deps import CurrentUser, SessionDep
from app.schemas.stats import Granularity, Metric, Period, SummaryOut, TimeseriesOut
from app.services import stats as stats_service

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary", response_model=SummaryOut)
async def get_stats_summary(
    user: CurrentUser,
    session: SessionDep,
    period: Period = "week",
    offset: int = Query(default=0, le=0, ge=-1000),
) -> SummaryOut:
    return await stats_service.summary(session, user, period, offset)


@router.get("/timeseries", response_model=TimeseriesOut, response_model_exclude_none=True)
async def get_stats_timeseries(
    user: CurrentUser,
    session: SessionDep,
    metric: Metric,
    granularity: Granularity,
    from_: date = Query(alias="from"),
    to: date = Query(),
) -> TimeseriesOut:
    if from_ > to:
        raise HTTPException(422, "'from' must not be after 'to'")
    count = stats_service.bucket_count(
        stats_service.bucket_start(from_, granularity),
        stats_service.bucket_start(to, granularity),
        granularity,
    )
    if count > stats_service.MAX_BUCKETS:
        raise HTTPException(422, f"Range too large (max {stats_service.MAX_BUCKETS} buckets)")
    return await stats_service.timeseries(session, user, metric, granularity, from_, to)
