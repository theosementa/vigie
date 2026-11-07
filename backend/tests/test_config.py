import pytest

from app.core.config import InsecureConfigError, check_secret_key
from app.main import app, lifespan


@pytest.mark.parametrize(
    "secret",
    ["", "short", "x" * 31, "change-me-in-production", "dev-insecure-change-me-please-0123456789"],
)
def test_weak_secrets_are_refused(secret):
    with pytest.raises(InsecureConfigError) as exc:
        check_secret_key(secret)
    assert "SECRET_KEY" in str(exc.value)
    assert "openssl rand -hex 32" in str(exc.value)


def test_strong_secret_is_accepted():
    check_secret_key("a" * 32)


async def test_startup_refuses_a_weak_secret(monkeypatch):
    monkeypatch.setattr("app.main.settings.secret_key", "change-me-in-production")
    with pytest.raises(InsecureConfigError):
        async with lifespan(app):
            pass


async def test_startup_accepts_the_test_secret():
    async with lifespan(app):
        pass


def test_database_guard_refuses_non_test_database():
    import subprocess
    import sys

    code = (
        "import os; os.environ['TEST_DATABASE_URL']='postgresql+asyncpg://u:p@h:5432/vigie';"
        "import tests.conftest"
    )
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    assert out.returncode != 0
    assert "_test" in out.stderr
