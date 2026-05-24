"""Application configuration helpers."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Tuple


def _project_root() -> Path:
    """Return the repository root for default config paths."""
    return Path(__file__).resolve().parent.parent


def _parse_csv(value: str) -> Tuple[str, ...]:
    """Split a comma-delimited env var into trimmed values."""
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _parse_lock_datetime(value: str | None) -> datetime | None:
    """Parse the entry lock timestamp when one is configured."""
    if not value:
        return None

    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    return datetime.fromisoformat(normalized)


@dataclass(frozen=True)
class Settings:
    """Container for runtime configuration."""

    database_url: str
    jwt_secret: str
    jwt_algorithm: str
    session_cookie_name: str
    session_duration_hours: int
    cors_origins: Tuple[str, ...]
    tournament_path: Path
    truth_path: Path
    truth_provider: str
    entry_lock_at: datetime | None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load and cache application settings from environment variables."""
    project_root = _project_root()
    cors_default = "http://localhost:3000,http://127.0.0.1:3000"

    return Settings(
        database_url=os.getenv("DATABASE_URL", f"sqlite:///{project_root / 'worldcup.db'}"),
        jwt_secret=os.getenv("JWT_SECRET", "dev-secret-change-me"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "wc_session"),
        session_duration_hours=int(os.getenv("SESSION_DURATION_HOURS", "168")),
        cors_origins=_parse_csv(os.getenv("CORS_ORIGINS", cors_default)),
        tournament_path=Path(
            os.getenv("TOURNAMENT_PATH", str(project_root / "config" / "tournament.json"))
        ),
        truth_path=Path(
            os.getenv("TRUTH_PATH", str(project_root / "config" / "truth" / "woshisim.json"))
        ),
        truth_provider=os.getenv("TRUTH_PROVIDER", "file"),
        entry_lock_at=_parse_lock_datetime(os.getenv("ENTRY_LOCK_AT")),
    )
