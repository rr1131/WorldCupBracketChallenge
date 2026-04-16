import json
from pathlib import Path
from typing import Dict

from .models import (
    EntryConfig,
    Group,
    KnockoutPick,
    Match,
    MatchResult,
    TournamentConfig,
    TruthConfig,
)


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_tournament_config(path: Path) -> TournamentConfig:
    raw = load_json(path)

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

    return TournamentConfig(groups=groups, matches=matches)


def load_truth_config(path: Path) -> TruthConfig:
    raw = load_json(path)

    results = {
        r["match_id"]: MatchResult(
            match_id=r["match_id"],
            home_score=r["home_score"],
            away_score=r["away_score"],
        )
        for r in raw["results"]
    }

    return TruthConfig(
        results=results,
        group_overrides=raw.get("group_overrides", {}),
        knockout_results=raw.get("knockout_results"),
    )


def load_entry_config(path: Path) -> EntryConfig:
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
    entries: Dict[str, EntryConfig] = {}
    for file_path in sorted(path.glob("*.json")):
        entry = load_entry_config(file_path)
        entries[entry.entry_name] = entry
    return entries
