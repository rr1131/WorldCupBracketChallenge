from pathlib import Path
from typing import Dict, List

from .cumulative_scoring import build_scored_entry
from .knockout import generate_full_knockout_bracket
from .knockout_scoring import picks_to_lookup, score_knockout_picks
from .leaderboard import build_leaderboard
from .loader import load_entries_from_dir, load_tournament_config, load_truth_config
from .models import EntryConfig, GroupStanding, ScoredEntry
from .scoring import score_group_stage_entry
from .standings import compute_all_group_standings
from .validator import (
    validate_entry_config,
    validate_knockout_picks,
    validate_tournament_config,
    validate_truth_config,
)


def score_single_entry(entry: EntryConfig) -> dict:
    project_root = Path(__file__).resolve().parent.parent

    tournament = load_tournament_config(project_root / "config" / "tournament.json")
    truth = load_truth_config(project_root / "config" / "truth" / "woshisim.json")

    validate_tournament_config(tournament)
    validate_truth_config(tournament, truth)
    validate_entry_config(tournament, entry)

    actual_standings = compute_all_group_standings(
        tournament=tournament,
        results_by_match_id=truth.results,
        group_overrides=truth.group_overrides,
    )

    predicted_standings = compute_all_group_standings(
        tournament=tournament,
        results_by_match_id=entry.predictions,
        group_overrides={},
    )

    group_stage_result = score_group_stage_entry(
        tournament=tournament,
        entry=entry,
        truth_results=truth.results,
        predicted_standings=predicted_standings,
        actual_standings=actual_standings,
    )

    predicted_pick_lookup = picks_to_lookup(entry.knockout_picks)

    predicted_bracket = generate_full_knockout_bracket(
        predicted_standings=predicted_standings,
        knockout_pick_lookup=predicted_pick_lookup,
    )

    actual_bracket = generate_full_knockout_bracket(
        predicted_standings=actual_standings,
        knockout_pick_lookup=truth.knockout_results or {},
    )

    validate_knockout_picks(entry, predicted_bracket)

    knockout_result = score_knockout_picks(
        predicted_bracket=predicted_bracket,
        actual_bracket=actual_bracket,
        predicted_pick_lookup=predicted_pick_lookup,
        actual_winner_lookup=truth.knockout_results or {},
    )

    scored = build_scored_entry(
        entry_name=entry.entry_name,
        group_stage_result=group_stage_result,
        knockout_result=knockout_result,
    )

    return {
        "entry_name": scored.entry_name,
        "match_points": scored.match_points,
        "standing_points": scored.standing_points,
        "knockout_points": scored.knockout_points,
        "total_points": scored.total_points,
        "exact_order_count": scored.exact_order_count,
        "top_two_bonus_count": scored.top_two_bonus_count,
        "group_scores": [gs.__dict__ for gs in scored.group_scores],
        "match_scores": [ms.__dict__ for ms in scored.match_scores],
        "knockout_scores": [ks.__dict__ for ks in scored.knockout_scores],
        "predicted_standings": {
            gid: [row.__dict__ for row in standing.rows]
            for gid, standing in predicted_standings.items()
        },
        "actual_standings": {
            gid: [row.__dict__ for row in standing.rows]
            for gid, standing in actual_standings.items()
        },
        "predicted_bracket": {
            round_name: [match.__dict__ for match in matches]
            for round_name, matches in predicted_bracket.items()
        },
        "actual_bracket": {
            round_name: [match.__dict__ for match in matches]
            for round_name, matches in actual_bracket.items()
        },
    }