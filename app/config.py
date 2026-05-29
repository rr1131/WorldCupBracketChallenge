"""Application configuration helpers."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Literal, Tuple


def _project_root() -> Path:
    """Return the repository root for default config paths."""
    return Path(__file__).resolve().parent.parent


def _parse_csv(value: str) -> Tuple[str, ...]:
    """Split a comma-delimited env var into trimmed values."""
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _parse_bool(value: str | None, *, default: bool) -> bool:
    """Parse a permissive boolean environment variable."""
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_lock_datetime(value: str | None) -> datetime | None:
    """Parse the entry lock timestamp when one is configured."""
    if not value:
        return None

    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    return datetime.fromisoformat(normalized)


def _parse_samesite(
    value: str | None,
    *,
    secure_default: bool,
) -> Literal["lax", "strict", "none"]:
    """Parse a supported SameSite mode for session cookies."""
    if value is None:
        return "none" if secure_default else "lax"

    normalized = value.strip().lower()
    if normalized not in {"lax", "strict", "none"}:
        return "none" if secure_default else "lax"
    return normalized  # type: ignore[return-value]


@dataclass(frozen=True)
class Settings:
    """Container for runtime configuration."""

    database_url: str
    jwt_secret: str
    jwt_algorithm: str
    session_cookie_name: str
    session_duration_hours: int
    session_cookie_samesite: Literal["lax", "strict", "none"]
    cors_origins: Tuple[str, ...]
    tournament_path: Path
    espn_mapping_path: Path
    truth_path: Path
    truth_override_path: Path
    truth_provider: str
    entry_lock_at: datetime | None
    session_cookie_secure: bool
    espn_sync_enabled: bool
    espn_poll_interval_seconds: int
    espn_sync_stale_after_seconds: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load and cache application settings from environment variables."""
    project_root = _project_root()
    cors_default = "http://localhost:3000,http://127.0.0.1:3000"
    espn_mapping_default = project_root / "config" / "espn_mapping.json"
    override_default = project_root / "config" / "truth" / "override.json"
    session_cookie_secure = _parse_bool(os.getenv("SESSION_COOKIE_SECURE"), default=False)

    return Settings(
        database_url=os.getenv("DATABASE_URL", f"sqlite:///{project_root / 'worldcup.db'}"),
        jwt_secret=os.getenv("JWT_SECRET", "dev-secret-change-me"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "wc_session"),
        session_duration_hours=int(os.getenv("SESSION_DURATION_HOURS", "168")),
        session_cookie_samesite=_parse_samesite(
            os.getenv("SESSION_COOKIE_SAMESITE"),
            secure_default=session_cookie_secure,
        ),
        cors_origins=_parse_csv(os.getenv("CORS_ORIGINS", cors_default)),
        tournament_path=Path(
            os.getenv("TOURNAMENT_PATH", str(project_root / "config" / "tournament.json"))
        ),
        espn_mapping_path=Path(
            os.getenv("ESPN_MAPPING_PATH", str(espn_mapping_default))
        ),
        truth_path=Path(
            os.getenv("TRUTH_PATH", str(project_root / "config" / "truth" / "woshisim.json"))
        ),
        truth_override_path=Path(
            os.getenv("TRUTH_OVERRIDE_PATH", str(override_default))
        ),
        truth_provider=os.getenv("TRUTH_PROVIDER", "espn_cached"),
        entry_lock_at=_parse_lock_datetime(os.getenv("ENTRY_LOCK_AT")),
        session_cookie_secure=session_cookie_secure,
        espn_sync_enabled=_parse_bool(os.getenv("ESPN_SYNC_ENABLED"), default=True),
        espn_poll_interval_seconds=int(os.getenv("ESPN_POLL_INTERVAL_SECONDS", "60")),
        espn_sync_stale_after_seconds=int(os.getenv("ESPN_SYNC_STALE_AFTER_SECONDS", "300")),
    )
