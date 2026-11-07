"""Live updates: an in-process fan-out of "something changed" signals to a user's open devices.

One uvicorn process serves the API, so memory is enough. With several workers this module is
the only thing to replace (Postgres LISTEN/NOTIFY keeps the same publish / subscribe shape).

Events carry no data, only topics ("items", "queue", "me", ...): the client refetches what it shows.
"""

import asyncio
import json
import uuid
from dataclasses import dataclass, field

QUEUE_SIZE = 64


@dataclass(frozen=True)
class Event:
    name: str  # "sync" | "revoked"
    data: str = "{}"


@dataclass(eq=False)
class Subscriber:
    user_id: uuid.UUID
    session_id: uuid.UUID
    queue: asyncio.Queue[Event] = field(default_factory=lambda: asyncio.Queue(QUEUE_SIZE))


_subscribers: dict[uuid.UUID, set[Subscriber]] = {}


def subscribe(user_id: uuid.UUID, session_id: uuid.UUID) -> Subscriber:
    sub = Subscriber(user_id, session_id)
    _subscribers.setdefault(user_id, set()).add(sub)
    return sub


def unsubscribe(sub: Subscriber) -> None:
    subs = _subscribers.get(sub.user_id)
    if subs is None:
        return
    subs.discard(sub)
    if not subs:
        del _subscribers[sub.user_id]


def _push(sub: Subscriber, event: Event) -> None:
    try:
        sub.queue.put_nowait(event)
    except asyncio.QueueFull:
        # A stalled client: drop the backlog and tell it to refetch everything.
        while not sub.queue.empty():
            sub.queue.get_nowait()
        sub.queue.put_nowait(Event("sync", json.dumps({"topics": ["*"]})))


def publish(user_id: uuid.UUID, topics: list[str]) -> None:
    """Tell every open device of `user_id` that these topics changed."""
    event = Event("sync", json.dumps({"topics": topics}))
    for sub in list(_subscribers.get(user_id, ())):
        _push(sub, event)


def revoke(session_ids: list[uuid.UUID]) -> None:
    """The given sessions were signed out: their open streams get `revoked`, then close."""
    wanted = set(session_ids)
    for subs in list(_subscribers.values()):
        for sub in list(subs):
            if sub.session_id in wanted:
                _push(sub, Event("revoked"))


def subscriber_count(user_id: uuid.UUID) -> int:
    return len(_subscribers.get(user_id, ()))
