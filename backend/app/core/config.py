from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://radar:radar@localhost:5432/radar"
    jwt_secret: str = "dev-insecure-change-me-please-0123456789"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30
    cookie_name: str = "radar_session"
    cookie_secure: bool = False
    # Metadata fetching
    fetch_timeout_seconds: float = 5.0
    fetch_max_bytes: int = 2 * 1024 * 1024
    fetch_max_redirects: int = 3


settings = Settings()
