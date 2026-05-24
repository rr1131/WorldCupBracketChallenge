"""Password hashing and JWT helpers."""

from __future__ import annotations

from datetime import timedelta
from functools import lru_cache
from typing import Any

import jwt
from pwdlib import PasswordHash

from .config import get_settings
from .database import utcnow


@lru_cache(maxsize=1)
def get_password_hasher() -> PasswordHash:
    """Create and cache the password hasher."""
    return PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash a plaintext password."""
    return get_password_hasher().hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a stored hash."""
    return get_password_hasher().verify(password, password_hash)


def create_access_token(subject: str) -> str:
    """Create a signed JWT for the given user id."""
    settings = get_settings()
    expires_at = utcnow() + timedelta(hours=settings.session_duration_hours)
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a signed JWT."""
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
