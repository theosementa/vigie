from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI

from app.api.routes import (
    admin,
    auth,
    contacts,
    extension,
    items,
    queue,
    resources,
    stats,
    stream,
    tags,
    tokens,
    views,
)
from app.core.config import check_secret_key, settings
from app.core.errors import ErrorResponse
from app.core.realtime import RealtimeMiddleware

api = APIRouter(prefix="/api", responses={401: {"model": ErrorResponse}})


@api.get("/health", tags=["health"])
async def get_health() -> dict[str, str]:
    return {"status": "ok"}


api.include_router(auth.router)
api.include_router(admin.router)
api.include_router(resources.router)
api.include_router(items.router)
api.include_router(queue.router)
api.include_router(tags.router)
api.include_router(contacts.router)
api.include_router(views.router)
api.include_router(tokens.router)
api.include_router(extension.router)
api.include_router(stats.router)
api.include_router(stream.router)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    check_secret_key(settings.secret_key)  # refuse to start with a missing / weak secret
    yield


app = FastAPI(
    title="Vigie API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
    # operation ids are the route function names (unique, descriptive): the front end's
    # generated client exposes them
    generate_unique_id_function=lambda route: route.name,
)
app.include_router(api)
app.add_middleware(RealtimeMiddleware)
