# Vigie

Vigie is a self-hosted, multi-user watch list for articles and videos. You paste a link (or share it from your phone); Vigie fetches its title, image and duration, and files it under **To watch**. You work through the pile at your own pace, mark things **Seen**, add notes and tags, send a link to a specific person, and see honestly whether you are catching up.

It is a reading and viewing pile, not a news feed: what comes in is chosen, what goes out is seen. There is no social network, no recommendation, no analytics, and no archived copy of the content (Vigie keeps the link and its metadata).

It is a PWA: one site, installable on iPhone, Android and desktop. The interface is available in English and French.

See [VISION.md](VISION.md) for the product vision (in French) and [backend/API.md](backend/API.md) for the API contract.

## Features

- Capture a link and get a card with image, title, source, duration or reading time.
- **To watch / Seen** statuses, a video queue, tags, personal notes, search.
- Send a link to another user by exact e-mail address, with an optional message.
- Statistics: items seen, viewing time, streak, backlog trend, each figure with its base.
- Accounts with e-mail and password, admin and user roles, revocable sessions.
- Registration modes (invite, open, closed) and an invite list managed by the admin.
- Mobile layout (tab bar, bottom sheets) under 768 px, desktop layout (sidebar, inspector) above.
- English and French interface.

## Quick start

You need Docker with the Compose plugin.

```bash
git clone <this repository> vigie && cd vigie
cp .env.example .env
```

Edit `.env` and set the two required secrets (compose refuses to start without them):

```bash
openssl rand -hex 32   # -> SECRET_KEY
openssl rand -hex 24   # -> POSTGRES_PASSWORD
```

Then start the stack. Until prebuilt images are published, build them locally:

```bash
docker compose up -d --build
```

Open http://localhost:8080 (the default `VIGIE_HTTP_PORT`). **The first account you create becomes the admin.** Migrations run automatically when the API starts.

Only the `web` service is published on the host. The database and the API stay on the internal compose network.

### HTTPS

Set a real domain and let Caddy obtain and renew a certificate:

```bash
VIGIE_DOMAIN=vigie.example.com
VIGIE_HTTP_PORT=80
VIGIE_HTTPS_PORT=443
```

The domain must point to the server and ports 80 and 443 must be reachable. With the default `VIGIE_DOMAIN=:80`, Vigie serves plain HTTP, which suits a LAN or a setup behind your own proxy. The `Strict-Transport-Security` header is sent only on requests that arrive over HTTPS. Session cookies are `Secure` automatically over HTTPS (`COOKIE_SECURE=auto`).

### Behind another reverse proxy or a tunnel

Keep `VIGIE_DOMAIN=:80`, point your proxy at `VIGIE_HTTP_PORT`, and let Vigie trust it so rate limiting sees the real client IP:

```bash
VIGIE_TRUSTED_PROXIES=private_ranges
```

Use the exact range of your proxy if it is not on a private network. Leave the variable empty if clients reach Vigie directly: otherwise anyone could forge their address. If your proxy terminates HTTPS, set `COOKIE_SECURE=true` unless it forwards `X-Forwarded-Proto`.

## Configuration

Set in `.env` (see [.env.example](.env.example)).

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | required | Signs session tokens, at least 32 characters (`openssl rand -hex 32`). The API refuses to start otherwise |
| `POSTGRES_PASSWORD` | required | Database password |
| `POSTGRES_USER` / `POSTGRES_DB` | `vigie` / `vigie` | Database user and name |
| `JWT_EXPIRE_DAYS` | `30` | Session lifetime |
| `COOKIE_SECURE` | `auto` | `auto` (Secure over HTTPS), `true` or `false` |
| `REGISTRATION` | `invite` | Initial registration mode of a new instance (`invite`, `open`, `closed`) |
| `ALLOWED_EMAILS` | empty | Comma-separated allow list: when set, only these addresses can sign up, sign in or be invited (staging) |
| `PUBLIC_URL` | empty | Public base URL, used in password-reset links |
| `FETCH_TIMEOUT_SECONDS` | `5` | Timeout when fetching a link's metadata |
| `FETCH_MAX_BYTES` | `2097152` | Maximum size of a fetched page |
| `FETCH_MAX_REDIRECTS` | `3` | Maximum redirects followed |
| `VIGIE_DOMAIN` | `:80` | `:80` for plain HTTP, or a domain for automatic HTTPS |
| `VIGIE_HTTP_PORT` | `8080` | Host port for HTTP |
| `VIGIE_HTTPS_PORT` | `8443` | Host port for HTTPS (set `80` / `443` for automatic HTTPS) |
| `VIGIE_TRUSTED_PROXIES` | empty | Proxies whose `X-Forwarded-For` is trusted, e.g. `private_ranges` |

### Registration modes

| Mode | Behaviour |
|---|---|
| `invite` (default) | After the first account, only e-mail addresses added to the invite list by an admin can sign up |
| `open` | Anyone can sign up |
| `closed` | No new sign-ups |

`REGISTRATION` only sets the mode of a fresh instance. Afterwards the admin changes it in the app, and changing it never affects existing accounts.

### Resetting a password

An admin can generate a reset link in the app. If nobody can log in, use the CLI:

```bash
docker compose exec api vigie reset-password <email>
```

## Updating

Once images are published:

```bash
docker compose pull && docker compose up -d
```

Until then, rebuild from the updated source:

```bash
git pull && docker compose up -d --build
```

Database migrations run on startup.

## Backups

Everything is in PostgreSQL:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > vigie-backup.sql
```

Restore into a fresh instance:

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < vigie-backup.sql
```

## Development

Everything runs in Docker; do not run `npm` or `vite` on the host. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

```bash
export POSTGRES_PASSWORD=vigie-dev-only
export SECRET_KEY=dev-only-secret-key-not-for-production-0123456789
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

| What | Where |
|---|---|
| Frontend (Vite, hot reload) | http://127.0.0.1:5173 |
| API (auto-reload, docs at `/api/docs`) | http://127.0.0.1:8000 |
| PostgreSQL (with a `vigie_test` database) | `127.0.0.1:5432` |

`docker-compose.dev.yml` is for development only: it publishes ports on 127.0.0.1 and relies on placeholder secrets. If a port is taken on your machine, set `VIGIE_DB_PORT` (5432) or `VIGIE_API_PORT` (8000).

### Tests and linters

```bash
cd backend
uv run pytest              # needs the dev db service
uv run ruff check . && uv run ruff format --check .

docker compose -f docker-compose.yml -f docker-compose.dev.yml exec web-dev npm run lint
```

## Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router, `vite-plugin-pwa`.
- **Backend**: FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic, `httpx` + `selectolax`, Argon2, JWT in an `httpOnly` cookie, managed with `uv` (Python 3.13).
- **Database**: PostgreSQL 17 (`pg_trgm` for search).
- **Infra**: Docker Compose with `web` (Caddy: static app, `/api` reverse proxy, security headers, optional automatic HTTPS), `api` (non-root) and `db`.

Front and API share one origin (Caddy in production, the Vite proxy in dev), so there is no CORS.

### Resource vs Item

- A **Resource** is global: a normalised URL (no `utm_*`, fragment or trailing slash) and its metadata (title, image, duration, reading time). It is shared by all users, so a page is fetched once.
- An **Item** belongs to one user and points to a Resource: status (`to_watch` / `seen`), notes, tags, a per-user `type_override`, `seen_at`. Unique on `(user_id, resource_id)`.
- Sending a link creates a `to_watch` Item for the recipient (found by exact e-mail, there is no user directory) with the sender and an optional message. Notes and tags are not copied.
- The **queue** is an ordered list of videos to watch next, separate from the status. Marking an item seen or deleting it removes it from the queue.
- Another user's item always answers `404`, like a missing id.

### The journal

Every change of an item writes an **ItemEvent** (`added`, `seen`, `unseen`, `deleted`, `shared`) in the same transaction. Events survive the deletion of the item and feed the statistics. Days, weeks (Monday start) and streaks follow the user's time zone.

### SSRF protections

The server fetches metadata (OpenGraph and Twitter cards, favicon, YouTube oEmbed) for URLs supplied by users, so outgoing requests are restricted:

- http and https only;
- DNS is resolved first, and private, loopback and link-local addresses are refused;
- timeout, maximum size and maximum redirects are bounded (`FETCH_*`), and every redirect hop is checked again.

A failed fetch never blocks saving: the title falls back to the host name.

### Installing the PWA

- iOS (Safari): Share, then **Add to Home Screen**.
- Android / Chrome: menu, then **Install app**.
- Desktop Chrome / Edge: install icon in the address bar.

Outside `localhost`, a PWA requires HTTPS.

## Roadmap

Not built yet: history imports, personal API tokens, optional SMTP (verification, reset and invitation e-mails). See [VISION.md](VISION.md) for the plan.

## Licence

Copyright (C) 2026 Théo Sementa

Vigie is free software under the [GNU Affero General Public License v3.0](LICENSE). If you run a modified version as a network service, you must offer its source to its users.

## Credits

- Icons: [Solar](https://www.figma.com/community/file/1166831539721848736) by 480 Design, CC BY 4.0.
- Font: [Geologica](https://fonts.google.com/specimen/Geologica), SIL Open Font License.
