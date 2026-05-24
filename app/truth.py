"""Truth-data provider abstractions."""

from __future__ import annotations

from abc import ABC, abstractmethod

from .config import get_settings
from .loader import load_truth_config
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


def get_truth_provider() -> TruthDataProvider:
    """Resolve the configured truth-data provider."""
    settings = get_settings()
    if settings.truth_provider != "file":
        raise ValueError(f"Unsupported truth provider: {settings.truth_provider}")
    return FileTruthDataProvider()
