# MEAT & POTATOES

from collections import defaultdict
from typing import Dict, List

from .models import (
    GroupStanding,
    GroupStandingRow,
    MatchResult,
    TeamStats,
    TournamentConfig,
)


def initialize_group_stats(tournament: TournamentConfig, group_id: str) -> Dict[str, TeamStats]:
    stats: Dict[str, TeamStats] = {}
    for team in tournament.groups[group_id].teams:
        stats[team] = TeamStats(team=team, group_id=group_id)
    return stats


def apply_match_result(stats: Dict[str, TeamStats], home_team: str, away_team: str, home_score: int, away_score: int) -> None:
    home = stats[home_team]
    away = stats[away_team]

    home.played += 1
    away.played += 1

    home.goals_for += home_score
    home.goals_against += away_score
    away.goals_for += away_score
    away.goals_against += home_score

    home.goal_difference = home.goals_for - home.goals_against
    away.goal_difference = away.goals_for - away.goals_against

    if home_score > away_score:
        home.wins += 1
        away.losses += 1
        home.points += 3
    elif away_score > home_score:
        away.wins += 1
        home.losses += 1
        away.points += 3
    else:
        home.draws += 1
        away.draws += 1
        home.points += 1
        away.points += 1


def rank_group_stats(stats: Dict[str, TeamStats]) -> List[TeamStats]:
    # Simple v1 ranking.
    # Later you can extend this with head-to-head and fair play.
    return sorted(
        stats.values(),
        key=lambda s: (
            -s.points,
            -s.goal_difference,
            -s.goals_for,
            s.team,
        ),
    )


def compute_group_standings(
    tournament: TournamentConfig,
    results_by_match_id: Dict[str, MatchResult],
    group_id: str,
    override: List[str] | None = None,
) -> GroupStanding:
    stats = initialize_group_stats(tournament, group_id)

    for match in tournament.matches.values():
        if match.group_id != group_id:
            continue

        result = results_by_match_id[match.id]
        apply_match_result(
            stats=stats,
            home_team=match.home_team,
            away_team=match.away_team,
            home_score=result.home_score,
            away_score=result.away_score,
        )

    if override:
        ordered_stats = [stats[team] for team in override]
    else:
        ordered_stats = rank_group_stats(stats)

    rows = []
    for idx, team_stats in enumerate(ordered_stats, start=1):
        rows.append(
            GroupStandingRow(
                position=idx,
                team=team_stats.team,
                group_id=group_id,
                played=team_stats.played,
                wins=team_stats.wins,
                draws=team_stats.draws,
                losses=team_stats.losses,
                goals_for=team_stats.goals_for,
                goals_against=team_stats.goals_against,
                goal_difference=team_stats.goal_difference,
                points=team_stats.points,
            )
        )

    return GroupStanding(group_id=group_id, rows=rows)


def compute_all_group_standings(
    tournament: TournamentConfig,
    results_by_match_id: Dict[str, MatchResult],
    group_overrides: Dict[str, List[str]] | None = None,
) -> Dict[str, GroupStanding]:
    group_overrides = group_overrides or {}
    standings: Dict[str, GroupStanding] = {}

    for group_id in sorted(tournament.groups.keys()):
        standings[group_id] = compute_group_standings(
            tournament=tournament,
            results_by_match_id=results_by_match_id,
            group_id=group_id,
            override=group_overrides.get(group_id),
        )

    return standings