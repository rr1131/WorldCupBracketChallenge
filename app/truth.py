"""Truth-data provider abstractions."""

from __future__ import annotations

from abc import ABC, abstractmethod

from .config import get_settings
from .database import get_session_factory
from .db_models import TruthSyncState
from .loader import load_truth_config, parse_truth_config
from .models import TruthConfig


class TruthDataProvider(ABC):
    """Abstract source for tournament truth data."""

    @abstractmethod
    def load_truth(self) -> TruthConfig:
        """Return the latest truth snapshot."""


class FileTruthDataProvider(TruthDataProvider):
    """Load truth data from the configured JSON file."""

    def load_truth(self) -> TruthConfig:
        """Read the active truth snapshot from disk."""
        return load_truth_config(get_settings().truth_path)


class EspnCachedTruthDataProvider(TruthDataProvider):
    """Read the latest cached ESPN-derived truth snapshot from the database."""

    def load_truth(self) -> TruthConfig:
        """Return cached truth, falling back to the file provider when needed."""
        session = get_session_factory()()
        try:
            state = session.get(TruthSyncState, "espn_cached")
            if state is not None and state.truth_payload:
                return parse_truth_config(state.truth_payload)
        finally:
            session.close()
        return load_truth_config(get_settings().truth_path)


def get_truth_provider() -> TruthDataProvider:
    """Resolve the configured truth-data provider."""
    settings = get_settings()
    if settings.truth_provider == "file":
        return FileTruthDataProvider()
    if settings.truth_provider == "espn_cached":
        return EspnCachedTruthDataProvider()
    raise ValueError(f"Unsupported truth provider: {settings.truth_provider}")
