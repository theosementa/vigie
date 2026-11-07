from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

KNOWN_INSECURE_SECRETS = frozenset(
    {"change-me-in-production", "dev-insecure-change-me-please-0123456789"}
)
MIN_SECRET_LENGTH = 32


class InsecureConfigError(RuntimeError):
    """The configuration is unsafe to run with; the message says how to fix it."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://vigie:vigie@localhost:5432/vigie"
    secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30
    cookie_name: str = "vigie_session"
    # auto = Secure when the request is https (as seen through the proxy headers)
    cookie_secure: Literal["auto", "true", "false"] = "auto"
    # Initial registration mode of a fresh instance only; afterwards the admin owns it
    registration: Literal["invite", "open", "closed"] = "invite"
    # e.g. https://vigie.example.org, used to build password-reset links
    public_url: str | None = None
    # Metadata fetching
    fetch_timeout_seconds: float = 5.0
    fetch_max_bytes: int = 2 * 1024 * 1024
    fetch_max_redirects: int = 3


settings = Settings()


def check_secret_key(secret: str) -> None:
    """Refuse to start with a missing, short or well-known secret."""
    hint = "Generate one with `openssl rand -hex 32` and set it as SECRET_KEY."
    if not secret:
        raise InsecureConfigError(f"SECRET_KEY is not set. {hint}")
    if secret in KNOWN_INSECURE_SECRETS:
        raise InsecureConfigError(f"SECRET_KEY is a well-known default value. {hint}")
    if len(secret) < MIN_SECRET_LENGTH:
        raise InsecureConfigError(
            f"SECRET_KEY is too short ({len(secret)} chars, minimum {MIN_SECRET_LENGTH}). {hint}"
        )
