FROM python:3.15.0-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
# Install the project itself so the `vigie` admin CLI is on the PATH.
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

# Run unprivileged.
RUN useradd --system --no-create-home --uid 10001 vigie
USER vigie

EXPOSE 8000
# --forwarded-allow-ips='*' makes uvicorn trust X-Forwarded-* from any peer.
# This is safe ONLY because the api is never published: in docker-compose.yml
# its sole client is the Caddy `web` container. If you publish port 8000
# yourself, restrict this to your proxy's address.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
