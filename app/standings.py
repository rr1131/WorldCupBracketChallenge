from typing import Dict, List, Tuple

from .models import (
    GroupStanding,
    GroupStandingRow,
    Match,
    MatchResult,
    TeamStats,
    TournamentConfig,
)


def initialize_group_stats(tournament: TournamentConfig, group_id: str) -> Dict[str, TeamStats]:
    stats: Dict[str, TeamStats] = {}
    for team in tournament.groups[group_id].teams:
        stats[team] = TeamStats(team=team, group_id=group_id)
    return stats


def apply_match_result(
    stats: Dict[str, TeamStats],
    home_team: str,
    away_team: str,
    home_score: int,
    away_score: int,
) -> None:
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


def get_group_matches_with_results(
    tournament: TournamentConfig,
    results_by_match_id: Dict[str, MatchResult],
    group_id: str,
) -> List[Tuple[Match, MatchResult]]:
    matches_with_results: List[Tuple[Match, MatchResult]] = []

    for match in tournament.matches.values():
        if match.group_id != group_id:
            continue

        if match.id not in results_by_match_id:
            raise KeyError(f"Missing result for match {match.id}")

        matches_with_results.append((match, results_by_match_id[match.id]))

    return matches_with_results


def cluster_by_primary_metrics(ordered_stats: List[TeamStats]) -> List[List[TeamStats]]:
    """
    Groups adjacent teams that are tied on:
    - points
    - goal difference
    - goals for
    """
    if not ordered_stats:
        return []

    clusters: List[List[TeamStats]] = []
    current_cluster: List[TeamStats] = [ordered_stats[0]]

    for stat in ordered_stats[1:]:
        prev = current_cluster[-1]
        same_primary_metrics = (
            stat.points == prev.points
            and stat.goal_difference == prev.goal_difference
            and stat.goals_for == prev.goals_for
        )

        if same_primary_metrics:
            current_cluster.append(stat)
        else:
            clusters.append(current_cluster)
            current_cluster = [stat]

    clusters.append(current_cluster)
    return clusters


def build_head_to_head_stats(
    tied_team_ids: List[str],
    group_matches_with_results: List[Tuple[Match, MatchResult]],
    group_id: str,
) -> Dict[str, TeamStats]:
    """
    Builds a mini-table using only matches played among the tied teams.
    """
    h2h_stats: Dict[str, TeamStats] = {
        team_id: TeamStats(team=team_id, group_id=group_id)
        for team_id in tied_team_ids
    }

    tied_team_set = set(tied_team_ids)

    for match, result in group_matches_with_results:
        if match.home_team in tied_team_set and match.away_team in tied_team_set:
            apply_match_result(
                stats=h2h_stats,
                home_team=match.home_team,
                away_team=match.away_team,
                home_score=result.home_score,
                away_score=result.away_score,
            )

    return h2h_stats


def resolve_tie_with_head_to_head(
    tied_cluster: List[TeamStats],
    group_matches_with_results: List[Tuple[Match, MatchResult]],
) -> List[TeamStats]:
    """
    Resolves ties among teams already tied on:
    - points
    - goal difference
    - goals scored

    Uses FIFA-style score-based tiebreaks within the tied subset:
    - head-to-head points
    - head-to-head goal difference
    - head-to-head goals scored

    Falls back to alphabetical team code if still tied.
    """
    if len(tied_cluster) <= 1:
        return tied_cluster

    group_id = tied_cluster[0].group_id
    tied_team_ids = [team.team for team in tied_cluster]
    h2h_stats = build_head_to_head_stats(
        tied_team_ids=tied_team_ids,
        group_matches_with_results=group_matches_with_results,
        group_id=group_id,
    )

    resolved = sorted(
        tied_cluster,
        key=lambda s: (
            -h2h_stats[s.team].points,
            -h2h_stats[s.team].goal_difference,
            -h2h_stats[s.team].goals_for,
            s.team,
        ),
    )

    return resolved


def rank_group_stats(
    stats: Dict[str, TeamStats],
    group_matches_with_results: List[Tuple[Match, MatchResult]],
) -> List[TeamStats]:
    """
    Rank teams using:
    1. points
    2. goal difference
    3. goals scored
    4. head-to-head points among tied teams
    5. head-to-head goal difference among tied teams
    6. head-to-head goals scored among tied teams
    7. alphabetical team code fallback

    Note:
    This does not yet implement fair play points or drawing of lots.
    """
    ordered_by_primary = sorted(
        stats.values(),
        key=lambda s: (
            -s.points,
            -s.goal_difference,
            -s.goals_for,
        ),
    )

    tied_clusters = cluster_by_primary_metrics(ordered_by_primary)

    final_order: List[TeamStats] = []
    for cluster in tied_clusters:
        if len(cluster) == 1:
            final_order.extend(cluster)
        else:
            resolved_cluster = resolve_tie_with_head_to_head(
                tied_cluster=cluster,
                group_matches_with_results=group_matches_with_results,
            )
            final_order.extend(resolved_cluster)

    return final_order


def compute_group_standings(
    tournament: TournamentConfig,
    results_by_match_id: Dict[str, MatchResult],
    group_id: str,
    override: List[str] | None = None,
) -> GroupStanding:
    stats = initialize_group_stats(tournament, group_id)
    group_matches_with_results = get_group_matches_with_results(
        tournament=tournament,
        results_by_match_id=results_by_match_id,
        group_id=group_id,
    )

    for match, result in group_matches_with_results:
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
        ordered_stats = rank_group_stats(
            stats=stats,
            group_matches_with_results=group_matches_with_results,
        )

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