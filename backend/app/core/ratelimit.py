"""In-process sliding-window rate limiter.

State lives in the memory of one process: with several workers each has its own counters
(limits become per worker). That is fine for the single-worker default deployment.
Memory is bounded: expired hits are dropped on every check and the key table is capped.
"""

import math
import time
from collections import deque
from collections.abc import Awaitable, Callable

from fastapi import Request

from app.core.deps import CurrentUser
from app.core.errors import api_error

MAX_KEYS = 50_000


class RateLimiter:
    def __init__(self, max_keys: int = MAX_KEYS) -> None:
        self.enabled = True
        self._max_keys = max_keys
        self._hits: dict[str, tuple[float, deque[float]]] = {}  # key -> (window, timestamps)

    def reset(self) -> None:
        self._hits.clear()

    def hit(self, key: str, limit: int, window: float, cost: int = 1) -> float | None:
        """Record `cost` hits; returns None when allowed, else seconds until a slot frees up."""
        if not self.enabled:
            return None
        now = time.monotonic()
        entry = self._hits.get(key)
        stamps = entry[1] if entry else deque()
        while stamps and stamps[0] <= now - window:
            stamps.popleft()
        if len(stamps) + cost > limit:
            self._hits[key] = (window, stamps)
            return max(0.0, stamps[0] + window - now) if stamps else window
        stamps.extend([now] * cost)
        self._hits[key] = (window, stamps)
        if len(self._hits) > self._max_keys:
            self._sweep(now)
        return None

    def _sweep(self, now: float) -> None:
        for k in [k for k, (w, s) in self._hits.items() if not s or s[-1] <= now - w]:
            del self._hits[k]
        while len(self._hits) > self._max_keys:  # still full: drop the oldest keys
            del self._hits[next(iter(self._hits))]


limiter = RateLimiter()


def enforce(key: str, limit: int, window: float, cost: int = 1) -> None:
    retry = limiter.hit(key, limit, window, cost)
    if retry is not None:
        raise api_error(
            429,
            "rate_limited",
            "Too many requests, try again later.",
            headers={"Retry-After": str(max(1, math.ceil(retry)))},
        )


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def ip_limit(name: str, limit: int, window: float) -> Callable[[Request], Awaitable[None]]:
    """Dependency limiting a route per client IP."""

    async def dependency(request: Request) -> None:
        enforce(f"{name}:ip:{client_ip(request)}", limit, window)

    return dependency


def user_limit(name: str, limit: int, window: float) -> Callable[..., Awaitable[None]]:
    """Dependency limiting a route per authenticated user."""

    async def dependency(user: CurrentUser) -> None:
        enforce(f"{name}:user:{user.id}", limit, window)

    return dependency


MINUTE = 60
HOUR = 3600
DAY = 86400
