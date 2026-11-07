import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(password, hashed)
    except Exception:
        return False


def create_access_token(user_id: str, token_version: int, session_id: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "ver": token_version,
        "sid": session_id,
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> tuple[str, int, str] | None:
    """Returns (user id, token version, session id); None if invalid, expired or legacy."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    sub, ver, sid = payload.get("sub"), payload.get("ver"), payload.get("sid")
    if not isinstance(sub, str) or not isinstance(ver, int) or isinstance(ver, bool):
        return None
    if not isinstance(sid, str):
        return None  # issued before devices were tracked
    return sub, ver, sid


def new_reset_token() -> tuple[str, str]:
    """Returns (token to give to the user, hash to store)."""
    token = secrets.token_urlsafe(32)
    return token, hash_token(token)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
