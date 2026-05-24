"""Exact MAX-point calculations using fixed ceilings and lost opportunities."""

from __future__ import annotations

from typing import Dict, List, Set

from .models import EntryConfig, GroupStanding, KnockoutMatch, MatchResult, TournamentConfig
from .scoring import (
    GROUP_EXACT_ORDER_BONUS,
    GROUP_EXACT_POSITION_POINTS,
    GROUP_TOP_TWO_BONUS,
    KNOCKOUT_SCORING_STAGES,
    KNOCKOUT_STAGE_POINTS,
    MATCH_EXACT_SCORE_POINTS,
    bracket_stage_teams,
    match_outcome,
    picks_to_lookup,
    score_group,
)


GROUP_MAX_POINTS = GROUP_EXACT_POSITION_POINTS * 4 + GROUP_TOP_TWO_BONUS + GROUP_EXACT_ORDER_BONUS


def total_match_points_ceiling(tournament: TournamentConfig) -> int:
    """Return the maximum available points from all group-stage matches."""
    return len(tournament.matches) * MATCH_EXACT_SCORE_POINTS


def total_group_points_ceiling(tournament: TournamentConfig) -> int:
    """Return the maximum available points from all final group tables."""
    return len(tournament.groups) * GROUP_MAX_POINTS


def total_knockout_points_ceiling() -> int:
    """Return the maximum available points from knockout participation and champion picks."""
    stage_team_counts = {
        "R32": 32,
        "R16": 16,
        "QF": 8,
        "SF": 4,
        "FINAL": 2,
    }
    total = sum(stage_team_counts[stage] * KNOCKOUT_STAGE_POINTS[stage] for stage in KNOCKOUT_SCORING_STAGES)
    total += KNOCKOUT_STAGE_POINTS["CHAMPION"]
    return total


def max_total_points(tournament: TournamentConfig) -> int:
    """Return the fixed maximum score for any entry before the tournament starts."""
    return (
        total_match_points_ceiling(tournament)
        + total_group_points_ceiling(tournament)
        + total_knockout_points_ceiling()
    )


def compute_match_points_ceiling(
    tournament: TournamentConfig,
    entry: EntryConfig,
    truth_results: Dict[str, MatchResult],
) -> int:
    """Return the remaining-plus-earned ceiling for group-stage match picks."""
    ceiling = total_match_points_ceiling(tournament)
    for match_id, actual in truth_results.items():
        predicted = entry.predictions[match_id]
        if predicted.home_score == actual.home_score and predicted.away_score == actual.away_score:
            continue
        if match_outcome(predicted.home_score, predicted.away_score) == match_outcome(
            actual.home_score, actual.away_score
        ):
            ceiling -= MATCH_EXACT_SCORE_POINTS - 1
        else:
            ceiling -= MATCH_EXACT_SCORE_POINTS
    return ceiling


def compute_group_points_ceiling(
    predicted_standings: Dict[str, GroupStanding],
    actual_standings: Dict[str, GroupStanding],
    finalized_group_ids: Set[str],
) -> int:
    """Return the standings ceiling after finalized groups settle."""
    ceiling = 0
    for group_id in predicted_standings.keys():
        if group_id in finalized_group_ids:
            ceiling += score_group(
                predicted=predicted_standings[group_id],
                actual=actual_standings[group_id],
            ).total_points
        else:
            ceiling += GROUP_MAX_POINTS
    return ceiling


def _build_eliminated_lookup(
    actual_bracket: Dict[str, List[KnockoutMatch]],
    actual_winner_lookup: Dict[str, str],
) -> Set[str]:
    """Return teams that are already eliminated from the knockout bracket."""
    eliminated: Set[str] = set()
    for matches in actual_bracket.values():
        for match in matches:
            winner = actual_winner_lookup.get(match.slot_id)
            if not winner:
                continue
            participants = [team for team in (match.home_team, match.away_team) if team]
            if len(participants) != 2:
                continue
            for team in participants:
                if team != winner:
                    eliminated.add(team)
    return eliminated


def compute_knockout_points_ceiling(
    predicted_bracket: Dict[str, List[KnockoutMatch]],
    actual_bracket: Dict[str, List[KnockoutMatch]] | None,
    actual_winner_lookup: Dict[str, str] | None,
    all_groups_finalized: bool,
    predicted_pick_lookup: Dict[str, str],
) -> int:
    """Return the remaining-plus-earned ceiling for knockout scoring."""
    if not all_groups_finalized or actual_bracket is None:
        return total_knockout_points_ceiling()

    actual_winner_lookup = actual_winner_lookup or {}
    confirmed_stage_teams = bracket_stage_teams(actual_bracket)
    eliminated_teams = _build_eliminated_lookup(actual_bracket, actual_winner_lookup)
    predicted_stage_teams = bracket_stage_teams(predicted_bracket)

    actual_r32_teams = set(confirmed_stage_teams["R32"])
    ceiling = 0

    for stage_name in KNOCKOUT_SCORING_STAGES:
        stage_points = KNOCKOUT_STAGE_POINTS[stage_name]
        for team in predicted_stage_teams[stage_name]:
            if team in confirmed_stage_teams[stage_name]:
                ceiling += stage_points
            elif team in eliminated_teams:
                continue
            elif team not in actual_r32_teams:
                continue
            else:
                ceiling += stage_points

    predicted_champion = predicted_pick_lookup.get("M104")
    if predicted_champion:
        actual_champion = actual_winner_lookup.get("M104")
        if actual_champion == predicted_champion:
            ceiling += KNOCKOUT_STAGE_POINTS["CHAMPION"]
        elif actual_champion is None and predicted_champion not in eliminated_teams and predicted_champion in actual_r32_teams:
            ceiling += KNOCKOUT_STAGE_POINTS["CHAMPION"]

    return ceiling
