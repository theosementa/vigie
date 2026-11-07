"""ASGI middleware: after a successful write, tell the user's other devices to refresh.

Doing it here (not in each route) means no write path can forget to notify. The topics come
from the URL; the user comes from `scope["state"]`, set by the auth dependency.
"""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.services import realtime

_WRITES = {"POST", "PUT", "PATCH", "DELETE"}

# (path prefix, topics) - first match wins
_TOPICS: tuple[tuple[str, list[str]], ...] = (
    ("/api/items", ["items", "queue", "tags", "stats"]),
    ("/api/queue", ["items", "queue"]),
    ("/api/tags", ["tags", "items"]),
    ("/api/resources", ["items"]),
    ("/api/auth/me", ["me", "stats"]),
    ("/api/auth/", ["sessions", "me"]),
)


def topics_for(path: str) -> list[str]:
    return next((topics for prefix, topics in _TOPICS if path.startswith(prefix)), [])


class RealtimeMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in _WRITES:
            await self.app(scope, receive, send)
            return

        status = 0

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        await self.app(scope, receive, send_wrapper)
        user_id = scope.get("state", {}).get("user_id")
        if user_id is not None and 200 <= status < 400:
            if topics := topics_for(scope["path"]):
                realtime.publish(user_id, topics)
