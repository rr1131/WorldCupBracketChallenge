from pathlib import Path
from typing import Dict, List

from .leaderboard import build_leaderboard
from .loader import load_entries_from_dir, load_tournament_config, load_truth_config
from .models import GroupStanding, ScoredEntry
from .scoring import score_entry
from .standings import compute_all_group_standings
from .validator import (
    validate_entry_config,
    validate_tournament_config,
    validate_truth_config,
)


class PickemService:
    def __init__(self, tournament_path: Path, truth_path: Path, entries_dir: Path):
        self.tournament_path = tournament_path
        self.truth_path = truth_path
        self.entries_dir = entries_dir

    def run(self) -> dict:
        tournament = load_tournament_config(self.tournament_path)
        truth = load_truth_config(self.truth_path)
        entries = load_entries_from_dir(self.entries_dir)

        validate_tournament_config(tournament)
        validate_truth_config(tournament, truth)

        for entry in entries.values():
            validate_entry_config(tournament, entry)

        actual_standings = compute_all_group_standings(
            tournament=tournament,
            results_by_match_id=truth.results,
            group_overrides=truth.group_overrides,
        )

        scored_entries: List[ScoredEntry] = []
        predicted_standings_by_entry: Dict[str, Dict[str, GroupStanding]] = {}

        for entry_name, entry in entries.items():
            predicted_standings = compute_all_group_standings(
                tournament=tournament,
                results_by_match_id=entry.predictions,
                group_overrides={},
            )
            predicted_standings_by_entry[entry_name] = predicted_standings

            scored = score_entry(
                tournament=tournament,
                entry=entry,
                truth_results=truth.results,
                predicted_standings=predicted_standings,
                actual_standings=actual_standings,
            )
            scored_entries.append(scored)

        leaderboard = build_leaderboard(scored_entries)

        return {
            "actual_standings": actual_standings,
            "predicted_standings_by_entry": predicted_standings_by_entry,
            "leaderboard": leaderboard,
        }