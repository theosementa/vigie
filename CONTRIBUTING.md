# Contributing to Vigie

Thanks for helping. Vigie is a small self-hosted app; keep changes focused.

## Where the specs live

- [`VISION.md`](VISION.md): product scope, accounts and instance, stack, roadmap. Read it before proposing a feature; the non-goals are firm.
- [`vigie-da.html`](vigie-da.html): the art direction (tokens, components, mockups in light and dark). The UI follows it; Tailwind's theme reuses its tokens, with no hard-coded colour or size.
- [`backend/API.md`](backend/API.md): the API contract.
- Translations (English and French) live in this repository: `frontend/src/i18n/en.ts` (the keys) and `fr.ts` (typed on them, so a missing key fails the build); `lib/i18n.ts` holds `t()` and `useT()`. No hard-coded UI text in components.
- Icons are Solar, vendored by `npm run icons` from the names in `frontend/src/components/icons.txt`; after an API change run `npm run gen:api` (both are plain Node scripts, fine on the host).

## Dev mode

Everything runs in Docker. Do not run `npm` or `vite` on your host: the frontend is built and served in a container with Linux binaries.

```bash
cp .env.example .env     # set SECRET_KEY and POSTGRES_PASSWORD (any value in dev, SECRET_KEY >= 32 chars)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

- Frontend with hot reload: http://127.0.0.1:5173 (Vite proxies `/api` to the API).
- API with auto-reload: http://127.0.0.1:8000 (docs at `/api/docs`).
- PostgreSQL: `127.0.0.1:5432`, with a `vigie_test` database for the test suite.

## Tests and linters

Backend (needs the dev `db` service running and `uv` on the host):

```bash
cd backend
uv sync
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

Frontend (inside the dev container):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec web-dev npm run lint
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec web-dev node_modules/.bin/tsc -b
```

CI runs all of these on every push and pull request, plus the Docker image builds.

## Live updates

Everything that changes data must reach the user's other open devices. This is automatic for any `POST`/`PUT`/`PATCH`/`DELETE` under `/api` (the realtime middleware publishes topics derived from the URL, see `app/core/realtime.py`); a new route family needs one line in its `_TOPICS` table, and a write that affects *another* user (like sharing) must publish to them explicitly. The front end refetches by topic in `features/realtime/useRealtime.ts`. The stream is in-memory: keep the API on a single process, or replace `app/services/realtime.py` with Postgres `LISTEN/NOTIFY`.

## Motion and smoothness

Every open/close, resize and reorder in the UI must stay smooth, with no visible glitch. This is a quality bar, not a nice-to-have.

- **Animate, don't pop.** Panels, sheets, menus and rows enter and leave with a transition (`--ease`, 200-320 ms, tokens in `styles/motion.css`). Keep a closing element mounted until its exit has played (the inspector stays mounted and slides; `ItemDetailHost` keeps the last item so content does not blank mid-close). Everything must respect `prefers-reduced-motion`.
- **A real resize beats a fake one, but never reflow per frame in a way that jumps.** When the page makes room for the inspector, `.main` animates its `padding-right` and the grid really resizes. To keep that glitch-free: the grid column count is pinned to the open-panel count, open or closed (`useStableCards`, `--cards-cols`), so cards only grow and shrink continuously; titles reserve a fixed line count (`.tt`: two lines) so heights never flip when a title re-wraps.
- **Measure, don't eyeball.** For any animation that resizes layout, sample each `requestAnimationFrame` (column count, card width and height, line counts) and check nothing changes discretely. View Transitions were tried for the page resize and rejected (stretched snapshots).
- Avoid animating layout properties on large lists unless the above holds; prefer `transform` and `opacity`.

## Environments

| Branch | Environment | URL | Host port |
|---|---|---|---|
| `main` | production | https://vigie.theosementa.fr | 8101 |
| `preprod` | pre-production | https://vigie-pp.theosementa.fr | 8102 |

A feature always lands on `preprod` first (`.github/workflows/deploy.yml` deploys it). Once validated, promote it with the **Promote to production** workflow (Actions tab, "Run workflow"): it fast-forwards `main` to `preprod` when CI passed on that commit, then starts the production deploy. Both run on the same homelab from separate folders, compose projects (`vigie`, `vigie-pp`) and databases. Preprod is limited by `ALLOWED_EMAILS` in its server-side `.env` (`.env.preprod.example` is the template, copied on the first deploy); add an address there and run `docker compose up -d` in the preprod folder to let someone in.

## Commits and pull requests

- Commit messages: imperative English, one behaviour per commit ("Add invite list", not "Added stuff").
- Keep pull requests small, describe what changes for the user, and add or update tests for backend behaviour.
- Do not commit `.env` or any secret.

## Licence

By contributing you agree that your contribution is licensed under the AGPL-3.0, like the rest of the project.
