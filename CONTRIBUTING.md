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

## Commits and pull requests

- Commit messages: imperative English, one behaviour per commit ("Add invite list", not "Added stuff").
- Keep pull requests small, describe what changes for the user, and add or update tests for backend behaviour.
- Do not commit `.env` or any secret.

## Licence

By contributing you agree that your contribution is licensed under the AGPL-3.0, like the rest of the project.
