# Vigie API contract

Base path: `/api`. JSON only. Fields are `snake_case`, ids are UUID strings, datetimes are ISO 8601 with
timezone (`2026-11-05T08:00:00.123456Z` style offsets).

Auth is a JWT stored in an httpOnly cookie `vigie_session` (SameSite=Lax; `Secure` per `COOKIE_SECURE`, see
[Configuration](#configuration)). The token carries `sub` (user id) and `ver` (the user's `token_version`):
a token whose `ver` is no longer current is rejected. The browser sends the cookie automatically (same
origin, no CORS). Every route except `/health`, `/auth/register`, `/auth/login`, `/auth/logout` and
`/auth/reset` answers `401 not_authenticated` without a valid session. Interactive docs: `/api/docs`.

## Errors

Errors raised by the API are `{"detail": {"code": "<stable_code>", "message": "<English sentence>", ...}}`.
Front ends branch on `code` and translate; `message` is for logs. Some errors add fields (see the table).
Pydantic validation errors stay FastAPI's `422 {"detail": [{"loc", "msg", "type"}]}` array. Legacy plain
`detail` strings remain on a few older `404`/`422` errors (item not found, invalid URL/cursor, queue and
stats range errors). Another user's item always answers `404`, identical to a non-existent id.

| Code | Status | Meaning |
|---|---|---|
| `not_authenticated` | 401 | No / invalid / expired / revoked session |
| `invalid_credentials` | 401 | Login failed (same answer for an unknown email and a wrong password) |
| `wrong_password` | 403 | Current password wrong (password change, account deletion) |
| `not_invited` | 403 | `invite` mode: the email is not on the invitation list |
| `registration_closed` | 403 | `closed` mode |
| `email_not_allowed` | 403 | `ALLOWED_EMAILS` is set and the email is not on it (signup, invitation). Login and existing sessions answer `invalid_credentials` / `not_authenticated` instead |
| `email_taken` | 409 | An account already uses this email |
| `email_domain_not_allowed` | 422 | Special-use domain (`.local`, `.lan`, `.home.arpa`, `.test`, `.internal`) while the instance is `open` |
| `invalid_reset_token` | 400 | Reset token unknown, expired (1 h) or already used |
| `last_admin` | 409 | Deleting the only admin while other accounts exist |
| `cannot_delete_self` | 400 | Admin route used on one's own account |
| `already_in_library` | 409 | `POST /items` duplicate; adds `item_id` |
| `rate_limited` | 429 | Too many requests; `Retry-After` header (seconds) |
| `not_found` | 404 | Admin routes called by a non-admin (they look absent) |
| `user_not_found` | 404 | Admin: unknown user id |
| `invitation_not_found` | 404 | Admin: unknown invitation id |

## OpenAPI and codegen

`/api/openapi.json` is the contract. `operationId` is the route function name (`list_items`, `create_item`,
`get_stats_summary`, ...), unique across the API. Every route declares its response model (or is a body-less
`204`); enums are string unions. Raised errors are documented on the routes as `ErrorResponse`
(`{ "detail": ErrorDetail }`, `ErrorDetail = { "code", "message", ...extras }`); `422` stays FastAPI's
validation error. To export the document without a database or `SECRET_KEY`:

```
cd backend && uv run python -m app.openapi_export > ../frontend/src/api/openapi.json
```

## Rate limits

In-process sliding windows keyed by client IP (`request.client.host`: behind Caddy, uvicorn's proxy
headers make it the real client IP) or by user id. They live in the memory of one process: with several
workers each keeps its own counters, which is fine for the single-worker default. Over the limit: `429
rate_limited` with `Retry-After`.

| Route | Limit |
|---|---|
| `POST /auth/login` | 10 / min / IP and 5 / min / email |
| `POST /auth/register` | 5 / hour / IP |
| `POST /auth/reset` | 5 / hour / IP |
| `POST /auth/password` | 5 / min / user |
| `POST /resources/preview`, `POST /items`, `POST /items/{id}/refresh` | 60 / min / user, each its own bucket |
| `POST /items/{id}/share` | 50 recipients / day / user |

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | local `vigie` db | `postgresql+asyncpg://...` |
| `SECRET_KEY` | none, required | JWT signing key. The app refuses to start if it is missing, shorter than 32 chars or a known default. `openssl rand -hex 32` |
| `JWT_EXPIRE_DAYS` | `30` | Session lifetime |
| `COOKIE_SECURE` | `auto` | `auto` (Secure when the request scheme is https, as seen through proxy headers), `true`, `false` |
| `REGISTRATION` | `invite` | `invite` / `open` / `closed`: initial mode of a fresh instance only; afterwards the admin owns it |
| `PUBLIC_URL` | unset | e.g. `https://vigie.example.org`; base of reset links (falls back to the request's base URL) |
| `FETCH_TIMEOUT_SECONDS`, `FETCH_MAX_BYTES`, `FETCH_MAX_REDIRECTS` | `5`, 2 MiB, `3` | Metadata fetching |
| `TEST_DATABASE_URL` | `postgresql+asyncpg://vigie:vigie@localhost:5432/vigie_test` | Tests only; the database name must end with `_test` |

CLI: `vigie reset-password <email>` (or `python -m app.cli reset-password <email>`) prints a one-time reset
link valid 1 hour, e.g. `docker compose exec api vigie reset-password alice@example.com`.

## Types

```jsonc
// ItemType = "article" | "video"      ItemStatus = "to_watch" | "seen"
User     = { "id": "uuid", "email": "a@b.com", "first_name": "Alice", "last_name": "Liddell", "role": "admin" | "user", "timezone": "Europe/Paris", "locale": "auto" | "en" | "fr", "theme": "system" | "dark" | "light", "mobile_layout": "list" | "grid", "hidden_types": [], "created_at": "..." }
Tag      = { "id": "uuid", "name": "python" }
Resource = {
  "id": "uuid", "url": "https://example.com/post",          // normalized
  "type": "article",                                         // effective type for the current user
  "title": "...", "description": "..."|null, "image_url": "..."|null,
  "site_name": "..."|null, "favicon_url": "..."|null, "author": "..."|null,
  "duration_seconds": 212|null,          // videos
  "reading_time_minutes": 4|null,        // articles
  "published_at": "..."|null, "fetched_at": "..."
}
Item = {
  "id": "uuid", "status": "to_watch", "notes": "..."|null,
  "tags": [Tag],
  "shared_by": { "id": "uuid", "first_name": "Alice", "last_name": "Liddell", "email": "alice@example.com" } | null,
  "share_message": "..."|null,
  "created_at": "...", "updated_at": "...", "seen_at": "..."|null,
  "queue_position": 0|null,             // 0-based rank in the watch queue, null = not queued
  "resource": Resource
}
```

URL normalization (server side, on every URL it receives): scheme/host lowercased, default port dropped,
`utm_*`/`fbclid`/`gclid` params removed, fragment removed, trailing slash removed, `youtu.be`,
`m.youtube.com`, `/shorts/`, `/embed/` mapped to `https://www.youtube.com/watch?v=ID`. A missing scheme
defaults to `https://`.

## Health

`GET /api/health` -> `200 {"status": "ok"}` (no auth)

## Auth

### `POST /api/auth/register` -> 201
```json
{ "email": "alice@example.com", "password": "min 8 chars", "first_name": "Alice", "last_name": "Liddell",
  "timezone": "Europe/Paris" }
```
`first_name` and `last_name` are required, trimmed, 1-50 chars each. `timezone` optional, an IANA name
(defaults to `"UTC"`). Email is lowercased. Sets the session cookie. Response: `User`.
The first account of an instance with no users becomes `admin`, whatever the mode. After that:
`invite` mode needs an invitation for the email (case-insensitive, marked used on signup) else
`403 not_invited`; `closed` -> `403 registration_closed`; `open` -> anyone. Special-use email domains are
accepted in `invite`/`closed`, refused (`422 email_domain_not_allowed`) in `open`.
Other errors: `409 email_taken`, `422` invalid input, `429`.

### `POST /api/auth/login` -> 200
```json
{ "email": "alice@example.com", "password": "..." }
```
Response: `User` + session cookie. `401 invalid_credentials` for an unknown email and for a wrong password
alike (a dummy hash is verified for unknown emails so timing does not differ). `429`.

### `POST /api/auth/logout` -> 204
Signs out this device only (deletes its session) and clears the cookie. Works with or without a session.

### `POST /api/auth/logout-all` -> 204
Bumps `token_version` and deletes every session of the user (every device, including this one), and clears the cookie.

### `POST /api/auth/password` -> 204
```json
{ "current_password": "...", "new_password": "min 8 chars" }
```
Bumps `token_version`, deletes the user's other sessions (devices) and re-issues the caller's cookie.
`403 wrong_password`, `422`, `429`.

### `POST /api/auth/reset` -> 204 (no session needed)
```json
{ "token": "from the reset link", "password": "min 8 chars" }
```
Sets the password, bumps `token_version`, marks the token used. `400 invalid_reset_token` when unknown,
expired (1 h) or already used. Tokens are random, stored hashed (SHA-256), single use. A reset link is
`<PUBLIC_URL or base URL>/reset-password?token=...`; admins create one with
`POST /api/admin/users/{id}/reset-link`, operators with the CLI.

### `GET /api/auth/me` -> 200 `User`, or `401` when there is no session.

### `PATCH /api/auth/me` -> 200 `User`
```json
{ "first_name": "Alicia", "last_name": "L", "timezone": "America/New_York", "locale": "fr", "theme": "dark", "mobile_layout": "grid", "hidden_types": ["repo"] }
```
All fields optional (omitted = unchanged). `422` for an empty / over-long name or a timezone that is not a
known IANA name (`zoneinfo`). `locale` (`auto` | `en` | `fr`, default `auto`) and `theme` (`system` | `dark` | `light`, default `system`) and
`mobile_layout` (`list` | `grid`, default `list`: how the library shows on a phone) are
stored on the account; any other value is a `422`. `hidden_types` (list of `article` | `video` | `website` | `repo`, default `[]`) hides
those types from the filter chips and the type pickers (existing items stay in the library); `422` if it
would hide every type. The timezone drives "day", "week" and streaks in the statistics.

### `GET /api/auth/sessions` -> 200 `Session[]`
The devices signed in to the account, most recently active first.
```json
[{ "id": "uuid", "device": "Safari · iPhone", "ip": "203.0.113.4" | null, "created_at": "...", "last_seen_at": "...", "current": true }]
```
`device` is derived from the User-Agent at sign-in. `last_seen_at` is refreshed at most every 5 minutes.
Each login or registration creates a session; the cookie's JWT carries its id (`sid`), so a token without a live
session is a `401`.

### `DELETE /api/auth/sessions/{id}` -> 204
Signs that device out at once (its live stream gets `revoked`). `404` if it is not one of yours.
Revoking the current session also clears the cookie.

### `DELETE /api/auth/me` -> 204
```json
{ "password": "..." }
```
Immediate and irreversible: the user's items, tags, events and sessions are deleted. Invitations they
created stay (`created_by` becomes null); items they shared to others stay with `shared_by` null.
`403 wrong_password`; `409 last_admin` if they are the only admin and other accounts exist.

## Live updates

### `GET /api/stream` -> 200 `text/event-stream`
Server-Sent Events, authenticated by the session cookie (`401` without one). One connection per open
device; the client keeps it while signed in. Events carry no data, only what to refetch:

```
event: ready     data: {}                              (connected)
event: sync      data: {"topics": ["items","queue"]}   (something changed on another device)
event: revoked   data: {}                              (this device was signed out; the stream then closes)
: ping                                                  (comment, every 20 s: keeps proxies from closing it)
```
Topics: `items`, `queue`, `tags`, `stats`, `me`, `sessions`, or `*` (refetch everything, sent when a slow
client's backlog was dropped). A `sync` is sent to **all** of the user's open streams after any successful
`POST`/`PUT`/`PATCH`/`DELETE` (the originating device included), and to the recipients of a share. Events
are not replayed: after a reconnect the client refetches everything.

The hub is in memory (`app/services/realtime.py`), which is right for the single uvicorn process the image
runs. Behind a reverse proxy the stream must not be buffered (`X-Accel-Buffering: no` is set; with Caddy
`flush_interval -1`) and idle timeouts must exceed 20 s.

## Admin

All routes require `role = admin`; anyone else gets `404 not_found` (the section looks absent). Admins
never see library content.

- `GET /api/admin/settings` -> `{ "registration_mode": "invite|open|closed", "updated_at", "updated_by" }`
- `PATCH /api/admin/settings` `{ "registration_mode": "open" }` -> same shape. Never affects existing accounts.
- `GET /api/admin/invitations` -> `[{ "id", "email", "created_by", "created_at", "used_at" }]` (`used_at` set = account created)
- `POST /api/admin/invitations` `{ "email" }` -> `201` new, or `200` with the existing invitation (idempotent)
- `DELETE /api/admin/invitations/{id}` -> 204 (`404 invitation_not_found`)
- `GET /api/admin/analytics?days=7|30|90` (default 30; other values `422 invalid_days`) -> counters for this instance only, never library content: `{ "days", "timezone", "start", "end", "totals": { "accounts", "admins", "items", "unseen_items", "queued_items", "shared_items", "pending_invitations" }, "active": { "day", "week", "month" } (accounts with a device seen in the last 24 h / 7 / 30 days), "window": { "new_accounts", "items_added", "items_seen", "shares" }, "series": [{ "day", "new_accounts", "items_added", "items_seen", "active_accounts" }] }` (one point per day, zero-filled, days in the admin's time zone)
- `GET /api/admin/users` -> `[{ "id", "first_name", "last_name", "email", "role", "created_at", "item_count" }]`
- `DELETE /api/admin/users/{id}` -> 204, same rules as self-deletion; `400 cannot_delete_self`, `404 user_not_found`
- `POST /api/admin/users/{id}/reset-link` -> `{ "url": "https://.../reset-password?token=...", "expires_at" }`;
  voids that user's previous unused links

## Resources

### `POST /api/resources/preview` -> 200
Fetches metadata without saving anything (used by the add form).
```json
{ "url": "https://youtu.be/dQw4w9WgXcQ" }
```
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "type": "video",
  "title": "Never Gonna Give You Up", "description": null,
  "image_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", "site_name": "YouTube",
  "favicon_url": "https://www.youtube.com/favicon.ico", "author": "Rick Astley",
  "duration_seconds": 212, "reading_time_minutes": null, "published_at": null,
  "existing_item_id": null
}
```
`existing_item_id` is the current user's item id if this URL is already in their library, else `null`.
Metadata failures never error: the title falls back to the hostname. `422` for an invalid URL or one longer than 2048 chars.

## Items

### `GET /api/items`
Query params (all optional): `status` (`to_watch|seen`), `type` (`article|video`), `tag` (tag name,
case-insensitive, or tag id), `q` (substring search on title, description, site name and your notes),
`shared` (`true` = only items shared with me, `false` = only my own), `queued` (`true` = only items in the
watch queue, `false` = only items not in it), `cursor`, `limit` (1-100, default 20).
Sorted by `created_at` desc.
```json
{ "items": [Item], "next_cursor": "opaque-string-or-null" }
```
Pass `next_cursor` back as `cursor` for the next page. `422` for a malformed cursor.

### `POST /api/items` -> 201 `Item`
```json
{ "url": "https://example.com/post", "type": "article", "status": "to_watch",
  "notes": "optional", "tags": ["python", "talk"], "queue": false }
```
Only `url` is required. `queue: true` appends the new item to the end of the [watch queue](#queue) (any type; ignored for `status: "seen"`). `type` overrides the auto-detected type for this user only. Tags are created on
demand (per user, case-insensitive unique). `409 already_in_library` (with `item_id`) when the user already has this URL. `422` for an invalid URL
(only http/https) or one longer than 2048 chars. Resources are unique on `url_hash`, the SHA-256 of the
normalised URL. No DB transaction is held while the page is fetched.

### `GET /api/items/{id}` -> 200 `Item` (404 if not yours)

### `PATCH /api/items/{id}` -> 200 `Item`
Any subset of:
```json
{ "status": "seen", "title": "My own title", "notes": "text or empty string to clear", "tags": ["python"], "type": "video" }
```
`title` renames the item for this user only (max 500 chars): `resource.title` then returns it, search matches it, and a metadata refresh keeps it. An empty string or `null` restores the page's own title.
`tags` replaces the full tag list. Moving to `seen` sets `seen_at`; back to `to_watch` resets it to `null`.
Only an actual status change is journaled (see [Events](#events)). Moving an item to `seen` removes it from the watch queue (positions are compacted).

### `DELETE /api/items/{id}` -> 204
Also removes the item from the watch queue (positions are compacted).

### `GET /api/items/{id}/events` -> 200
The item's journal, oldest first (404 if not yours or unknown).
```json
[ { "kind": "added" | "seen" | "unseen" | "deleted" | "shared", "occurred_at": "...",
    "other_user": { "first_name": "Bob", "last_name": "Tester" } | null } ]
```
`other_user` is set on `shared` (who it was shared with) and on an `added` caused by a share (who shared it),
`null` otherwise or when that account is gone.

### `POST /api/items/{id}/refresh` -> 200
```json
{ "refreshed": true, "reason": null, "item": Item }
```
Re-fetches the metadata. If the re-fetch fails, existing data is kept and the answer is
`{ "refreshed": false, "reason": "fetch_failed", "item": Item }`.

### `POST /api/items/{id}/share` -> 200
```json
{ "emails": ["bob@example.com", "ghost@example.com"], "message": "optional" }
```
```json
{ "shared": ["bob@example.com"], "not_found": ["ghost@example.com"], "already_had": [] }
```
Recipients are matched by exact email (case-insensitive, deduplicated). A new `to_watch` item is created for
each recipient with `shared_by` and `share_message` set (notes/tags are not copied). If the recipient already
has the resource, nothing is created, `shared_by` is filled in if it was empty, and the email is listed in
`already_had` (your own email also lands there).

## Queue

An ordered "watch next" list of the user's items (any type), independent from the `to_watch`/`seen` status. A queued
item is one of the user's items whose `queue_position` is not `null`.
Positions are 0-based and contiguous per user; they are compacted after every add, move and removal.
Out-of-range positions are clamped (`< 0` -> front, past the end -> end). Another user's item answers
`404 {"detail": "Item not found"}`. Queue operations are not journaled (no events, no stats impact).

### `GET /api/queue` -> 200
```json
{ "items": [Item] }
```
Ordered by `queue_position` ascending, not paginated.

### `POST /api/queue` -> 200 `Item`
```json
{ "item_id": "uuid", "position": 0 }
```
`position` is optional (`null`/omitted = end of the queue). Idempotent: if the item is already queued it is
left in place, or moved when `position` is given. `404` if it is not yours.

### `PATCH /api/queue/{item_id}` -> 200 `Item`
```json
{ "position": 2 }
```
Moves a queued item (clamped). `404` if the item does not exist or is not in the queue.

### `DELETE /api/queue/{item_id}` -> 204
Removes the item from the queue and compacts the positions (the item stays in the library). `204` even if
the item was not queued; `404` only if it is not yours / does not exist.

## Tags

### `GET /api/tags` -> 200
Only tags attached to at least one of the user's items, sorted by name.
```json
[ { "id": "uuid", "name": "python", "item_count": 3 } ]
```

## Stats

All statistics are computed for the current user only, in the user's timezone (`User.timezone`): days are
local days and weeks start on **Monday**. Dates in requests and responses are local `YYYY-MM-DD` strings.
The effective type of an item is `COALESCE(items.type_override, resources.type)`.

### `GET /api/stats/summary?period=week|month|year&offset=0`
`period` defaults to `week`. `offset` is `<= 0` (min -1000): `0` = the current period, `-1` = the previous one,
and so on; a positive offset is a `422`.
```jsonc
{
  "period": "week", "offset": 0, "timezone": "Europe/Paris",
  "start": "2026-03-16", "end": "2026-03-23",        // local dates, `end` is exclusive
  "current":  Block,
  "previous": Block,                                  // the period right before [start, end)
  "top_tags":    [ { "name": "python", "count": 4 } ],            // max 5, items seen in the period
  "top_sources": [ { "site_name": "youtube.com", "count": 3 } ],  // max 5, items seen in the period
  "shares": {
    "sent": 3, "received": 2,                         // in the period
    "by_user": [ { "user_id": "uuid", "first_name": "Alice", "last_name": "Liddell", "count": 2 } ]  // who shared with me
  },
  "streak": { "current": 3, "best": 12 },
  "videos_without_duration": 1                        // seen videos of the period with no duration
}
// Block = { "articles_read": 2, "videos_seen": 1, "items_added": 3, "watch_seconds": 600,
//           "reading_minutes": 8 }
```
No deltas are returned: the client compares `current` with `previous`.

- `articles_read`, `videos_seen`, `watch_seconds` (sum of `duration_seconds` of seen videos),
  `reading_minutes` (sum of `reading_time_minutes` of seen articles), `top_tags`, `top_sources` and
  `videos_without_duration` come from the items currently `seen`, bucketed by `seen_at`. They follow the
  library: an item moved back to `to_watch` or deleted no longer counts.
- `items_added` counts `added` events (including items received through a share). `shares.sent` counts
  `shared` events, `shares.received` counts `added` events created by a share.
- `streak`: consecutive local days with at least one item marked seen, from the event journal (it survives
  deletions). A day where more items were un-seen than seen does not count. `current` is non-zero only if the
  last active day is today or yesterday (local).

### `GET /api/stats/timeseries?metric=seen|added|watch_time|backlog&granularity=day|week|month&from=&to=`
`from` and `to` are local dates, both inclusive. `422` if `from > to` or the range spans more than 400
buckets.
```json
{ "metric": "seen", "granularity": "day", "timezone": "UTC",
  "points": [ { "bucket": "2026-03-10", "value": 3, "articles": 2, "videos": 1 } ] }
```
`bucket` is the local start date of the bucket (a Monday for `week`, the 1st for `month`). The first bucket
is the one containing `from` and the last the one containing `to`, so with `week`/`month` the first bucket can
start before `from`. Every bucket in the range is present (zero-filled).

| metric | `value` | source |
|---|---|---|
| `seen` | items seen in the bucket; also `articles` and `videos` (only for this metric) | seen items by `seen_at` |
| `added` | items added in the bucket | `added` events |
| `watch_time` | seconds of seen videos | seen items by `seen_at` |
| `backlog` | number of `to_watch` items at the **end** of the bucket | cumulative sum of the events |

`backlog` accounting: `added` +1, `unseen` +1, `seen` -1, `deleted` -1 unless the item was seen
(`was_seen`). Events before `from` are part of the starting balance.

## Events

Every change of the library is journaled in the `item_events` table in the same transaction (internal, not
exposed directly; it feeds `/stats`). Events are kept when the item is deleted.

| kind | emitted when | `other_user_id` | `was_seen` |
|---|---|---|---|
| `added` | `POST /items`; or a recipient gets an item through a share | the sharer (share only) | |
| `seen` | `POST /items` with `status: seen`, or a `to_watch` -> `seen` change | | |
| `unseen` | `seen` -> `to_watch` change | | |
| `deleted` | `DELETE /items/{id}` | | whether the item was `seen` |
| `shared` | the sender, once per recipient who actually got a new item | the recipient | |

Only real transitions emit events (setting the status it already has, editing notes/tags/type, `already_had`
shares, rejected duplicates emit nothing). Rows created before this feature are backfilled by migration `0002`
from `created_at`, `seen_at` and `shared_by_user_id`.
