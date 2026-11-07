import asyncio
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.core.deps import CurrentUser, SessionDep
from app.services import realtime

router = APIRouter(tags=["stream"])

HEARTBEAT_SECONDS = 20  # keeps proxies (Caddy, Cloudflare) from closing an idle connection


async def event_stream(sub: realtime.Subscriber) -> AsyncIterator[str]:
    try:
        yield "retry: 3000\n\n"
        yield "event: ready\ndata: {}\n\n"
        while True:
            try:
                event = await asyncio.wait_for(sub.queue.get(), HEARTBEAT_SECONDS)
            except TimeoutError:
                yield ": ping\n\n"
                continue
            yield f"event: {event.name}\ndata: {event.data}\n\n"
            if event.name == "revoked":
                return
    finally:
        realtime.unsubscribe(sub)


@router.get(
    "/stream",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def stream(request: Request, user: CurrentUser, session: SessionDep) -> StreamingResponse:
    """Server-Sent Events: a `sync` event ({"topics": [...]}) when something changed on another
    device, and `revoked` when this device was signed out. Authenticated by the session cookie."""
    session_id: uuid.UUID = request.state.session_id
    await session.close()  # do not hold a database connection for the life of the stream
    sub = realtime.subscribe(user.id, session_id)
    return StreamingResponse(
        event_stream(sub),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
