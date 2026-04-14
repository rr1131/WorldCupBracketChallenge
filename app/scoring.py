from typing import Dict, List, Set

from .models import (
    EntryConfig,
    GroupScoreBreakdown,
    GroupStanding,
    Match,
    MatchResult,
    MatchScoreBreakdown,
    ScoredEntry,
    TournamentConfig,
)

# Scoring convention for each group stage match
MATCH_EXACT_SCORE_POINTS = 3
MATCH_CORRECT_OUTCOME_POINTS = 1

# Scoring convention for group standings
GROUP_EXACT_POSITION_POINTS = 2
GROUP_TOP_TWO_BONUS = 2
GROUP_EXACT_ORDER_BONUS = 3


def match_outcome(home_score: int, away_score: int) -> str:
    if home_score > away_score:
        return "HOME_WIN"
    if away_score > home_score:
        return "AWAY_WIN"
    return "DRAW"


def teams_in_order(standing: GroupStanding) -> List[str]:
    return [row.team for row in standing.rows]


def top_two_set(standing: GroupStanding) -> Set[str]:
    return {standing.rows[0].team, standing.rows[1].team}


def score_match(
    match: Match,
    predicted: MatchResult,
    actual: MatchResult,
) -> MatchScoreBreakdown:
    if (
        predicted.home_score == actual.home_score
        and predicted.away_score == actual.away_score
    ):
        return MatchScoreBreakdown(
            match_id=match.id,
            group_id=match.group_id,
            home_team=match.home_team,
            away_team=match.away_team,
            predicted_home_score=predicted.home_score,
            predicted_away_score=predicted.away_score,
            actual_home_score=actual.home_score,
            actual_away_score=actual.away_score,
            points=MATCH_EXACT_SCORE_POINTS,
            reason="Exact score",
        )

    predicted_outcome = match_outcome(predicted.home_score, predicted.away_score)
    actual_outcome = match_outcome(actual.home_score, actual.away_score)

    if predicted_outcome == actual_outcome:
        return MatchScoreBreakdown(
            match_id=match.id,
            group_id=match.group_id,
            home_team=match.home_team,
            away_team=match.away_team,
            predicted_home_score=predicted.home_score,
            predicted_away_score=predicted.away_score,
            actual_home_score=actual.home_score,
            actual_away_score=actual.away_score,
            points=MATCH_CORRECT_OUTCOME_POINTS,
            reason="Correct outcome",
        )

    return MatchScoreBreakdown(
        match_id=match.id,
        group_id=match.group_id,
        home_team=match.home_team,
        away_team=match.away_team,
        predicted_home_score=predicted.home_score,
        predicted_away_score=predicted.away_score,
        actual_home_score=actual.home_score,
        actual_away_score=actual.away_score,
        points=0,
        reason="Incorrect prediction",
    )


def score_all_matches(
    tournament: TournamentConfig,
    entry: EntryConfig,
    truth_results: Dict[str, MatchResult],
) -> List[MatchScoreBreakdown]:
    match_scores: List[MatchScoreBreakdown] = []

    for match_id in sorted(tournament.matches.keys()):
        match = tournament.matches[match_id]
        predicted = entry.predictions[match_id]
        actual = truth_results[match_id]

        match_score = score_match(
            match=match,
            predicted=predicted,
            actual=actual,
        )
        match_scores.append(match_score)

    return match_scores


def score_group(predicted: GroupStanding, actual: GroupStanding) -> GroupScoreBreakdown:
    exact_position_points = 0

    predicted_by_position = {row.position: row.team for row in predicted.rows}
    actual_by_position = {row.position: row.team for row in actual.rows}

    for pos in range(1, 5):
        if predicted_by_position[pos] == actual_by_position[pos]:
            exact_position_points += GROUP_EXACT_POSITION_POINTS

    top_two_bonus = GROUP_TOP_TWO_BONUS if top_two_set(predicted) == top_two_set(actual) else 0
    exact_order_bonus = GROUP_EXACT_ORDER_BONUS if teams_in_order(predicted) == teams_in_order(actual) else 0

    return GroupScoreBreakdown(
        group_id=actual.group_id,
        exact_position_points=exact_position_points,
        top_two_bonus=top_two_bonus,
        exact_order_bonus=exact_order_bonus,
        total_points=exact_position_points + top_two_bonus + exact_order_bonus,
    )


def score_all_groups(
    predicted_standings: Dict[str, GroupStanding],
    actual_standings: Dict[str, GroupStanding],
) -> List[GroupScoreBreakdown]:
    group_scores: List[GroupScoreBreakdown] = []

    for group_id in sorted(actual_standings.keys()):
        group_score = score_group(
            predicted=predicted_standings[group_id],
            actual=actual_standings[group_id],
        )
        group_scores.append(group_score)

    return group_scores


def score_entry(
    tournament: TournamentConfig,
    entry: EntryConfig,
    truth_results: Dict[str, MatchResult],
    predicted_standings: Dict[str, GroupStanding],
    actual_standings: Dict[str, GroupStanding],
) -> ScoredEntry:
    match_scores = score_all_matches(
        tournament=tournament,
        entry=entry,
        truth_results=truth_results,
    )
    group_scores = score_all_groups(
        predicted_standings=predicted_standings,
        actual_standings=actual_standings,
    )

    match_points = sum(m.points for m in match_scores)
    standing_points = sum(g.total_points for g in group_scores)
    total_points = match_points + standing_points

    exact_order_count = sum(1 for g in group_scores if g.exact_order_bonus > 0)
    top_two_bonus_count = sum(1 for g in group_scores if g.top_two_bonus > 0)

    return ScoredEntry(
        entry_name=entry.entry_name,
        match_scores=match_scores,
        group_scores=group_scores,
        match_points=match_points,
        standing_points=standing_points,
        total_points=total_points,
        exact_order_count=exact_order_count,
        top_two_bonus_count=top_two_bonus_count,
    )


def explain_group_scoring(
    predicted: GroupStanding,
    actual: GroupStanding,
    group_score: GroupScoreBreakdown,
) -> List[dict]:
    """
    Returns row-level explanation for CLI/UI rendering.
    Row-level points here reflect exact position points only.
    Group-level bonuses remain separate.
    """
    actual_positions = {row.team: row.position for row in actual.rows}
    explanations: List[dict] = []

    for row in predicted.rows:
        team = row.team
        predicted_pos = row.position
        actual_pos = actual_positions[team]

        points = 0
        reasons: List[str] = []

        if predicted_pos == actual_pos:
            points += GROUP_EXACT_POSITION_POINTS
            reasons.append("Correct placement")

        explanations.append(
            {
                "team": team,
                "position": predicted_pos,
                "row": row,
                "points": points,
                "reasons": reasons,
                "actual_position": actual_pos,
            }
        )

    return explanations