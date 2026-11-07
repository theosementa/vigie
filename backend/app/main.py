from fastapi import APIRouter, FastAPI

from app.api.routes import auth, items, queue, resources, stats, tags

api = APIRouter(prefix="/api")


@api.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


api.include_router(auth.router)
api.include_router(resources.router)
api.include_router(items.router)
api.include_router(queue.router)
api.include_router(tags.router)
api.include_router(stats.router)

app = FastAPI(title="radar API", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.include_router(api)
