"""JSON loaders for tournament, truth, and entry config files."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict

from .models import (
    EntryConfig,
    EspnFixtureMapping,
    Group,
    KnockoutFixture,
    KnockoutPick,
    Match,
    MatchResult,
    TournamentConfig,
    TruthConfig,
)


def load_json(path: Path) -> dict:
    """Read a JSON file from disk."""
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def parse_iso_datetime(value: str | None) -> datetime | None:
    """Parse an optional ISO timestamp string."""
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    return datetime.fromisoformat(normalized)


def parse_tournament_config(raw: dict) -> TournamentConfig:
    """Normalize a tournament config dictionary into dataclasses."""
    groups = {
        g["id"]: Group(id=g["id"], teams=g["teams"])
        for g in raw["groups"]
    }

    matches = {
        m["id"]: Match(
            id=m["id"],
            group_id=m["group_id"],
            home_team=m["home_team"],
            away_team=m["away_team"],
        )
        for m in raw["matches"]
    }

    knockout_fixtures = {
        fixture["slot_id"]: KnockoutFixture(
            slot_id=fixture["slot_id"],
            round_name=fixture["round_name"],
        )
        for fixture in raw.get("knockout_fixtures", [])
    }

    return TournamentConfig(
        groups=groups,
        matches=matches,
        knockout_fixtures=knockout_fixtures,
    )


def load_tournament_config(path: Path) -> TournamentConfig:
    """Load and normalize the tournament configuration file."""
    return parse_tournament_config(load_json(path))


def parse_espn_mapping_config(raw: dict) -> dict[str, EspnFixtureMapping]:
    """Normalize an ESPN fixture mapping file."""
    fixtures = raw.get("fixtures", [])
    return {
        fixture["fixture_id"]: EspnFixtureMapping(
            fixture_id=fixture["fixture_id"],
            kickoff_at=parse_iso_datetime(fixture.get("kickoff_at")),
            espn_event_id=fixture.get("espn_event_id"),
        )
        for fixture in fixtures
    }


def load_espn_mapping_config(path: Path) -> dict[str, EspnFixtureMapping]:
    """Load an ESPN fixture mapping file from disk."""
    return parse_espn_mapping_config(load_json(path))


def apply_espn_mapping_overlay(
    tournament: TournamentConfig,
    mapping: dict[str, EspnFixtureMapping],
) -> TournamentConfig:
    """Overlay ESPN kickoff and event metadata onto structural tournament config."""
    matches = {
        match_id: Match(
            id=match.id,
            group_id=match.group_id,
            home_team=match.home_team,
            away_team=match.away_team,
            kickoff_at=mapping.get(match_id).kickoff_at if match_id in mapping else None,
            espn_event_id=mapping.get(match_id).espn_event_id if match_id in mapping else None,
        )
        for match_id, match in tournament.matches.items()
    }

    knockout_fixtures = {
        slot_id: KnockoutFixture(
            slot_id=fixture.slot_id,
            round_name=fixture.round_name,
            kickoff_at=mapping.get(slot_id).kickoff_at if slot_id in mapping else None,
            espn_event_id=mapping.get(slot_id).espn_event_id if slot_id in mapping else None,
        )
        for slot_id, fixture in tournament.knockout_fixtures.items()
    }

    return TournamentConfig(
        groups=tournament.groups,
        matches=matches,
        knockout_fixtures=knockout_fixtures,
    )


def parse_truth_config(raw: dict) -> TruthConfig:
    """Normalize a partial or complete truth snapshot."""
    results = {
        r["match_id"]: MatchResult(
            match_id=r["match_id"],
            home_score=r["home_score"],
            away_score=r["away_score"],
        )
        for r in raw.get("results", [])
    }

    advancing_third_place_groups = raw.get("advancing_third_place_groups")
    if advancing_third_place_groups is None:
        tiebreak_overrides = raw.get("tiebreak_overrides", {})
        advancing_third_place_groups = tiebreak_overrides.get("advancing_third_place_teams")

    return TruthConfig(
        results=results,
        group_overrides=raw.get("group_overrides", {}),
        advancing_third_place_groups=advancing_third_place_groups,
        knockout_results=raw.get("knockout_results"),
    )


def load_truth_config(path: Path) -> TruthConfig:
    """Load and normalize a partial or complete truth snapshot."""
    return parse_truth_config(load_json(path))


def load_entry_config(path: Path) -> EntryConfig:
    """Load a complete entry config from disk."""
    raw = load_json(path)

    predictions = {
        r["match_id"]: MatchResult(
            match_id=r["match_id"],
            home_score=r["home_score"],
            away_score=r["away_score"],
        )
        for r in raw["predictions"]
    }

    return EntryConfig(
        entry_name=raw["entry_name"],
        predictions=predictions,
        advancing_third_place_groups=raw.get("advancing_third_place_groups"),
        knockout_picks=[
            KnockoutPick(
                round_name=pick["round_name"],
                slot_id=pick["slot_id"],
                winner_team=pick["winner_team"],
            )
            for pick in raw.get("knockout_picks", [])
        ]
        or None,
    )


def load_entries_from_dir(path: Path) -> Dict[str, EntryConfig]:
    """Load all entry configs from a directory keyed by entry name."""
    entries: Dict[str, EntryConfig] = {}
    for file_path in sorted(path.glob("*.json")):
        entry = load_entry_config(file_path)
        entries[entry.entry_name] = entry
    return entries
