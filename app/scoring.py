from typing import Dict, List, Set

from .models import GroupScoreBreakdown, GroupStanding, ScoredEntry


EXACT_POSITION_POINTS = 5
TOP_TWO_BONUS = 2
EXACT_ORDER_BONUS = 5


def teams_in_order(standing: GroupStanding) -> List[str]:
    return [row.team for row in standing.rows]


def top_two_set(standing: GroupStanding) -> Set[str]:
    return {standing.rows[0].team, standing.rows[1].team}


def score_group(predicted: GroupStanding, actual: GroupStanding) -> GroupScoreBreakdown:
    exact_position_points = 0

    predicted_by_position = {row.position: row.team for row in predicted.rows}
    actual_by_position = {row.position: row.team for row in actual.rows}

    for pos in range(1, 5):
        if predicted_by_position[pos] == actual_by_position[pos]:
            exact_position_points += EXACT_POSITION_POINTS

    top_two_bonus = TOP_TWO_BONUS if top_two_set(predicted) == top_two_set(actual) else 0
    exact_order_bonus = EXACT_ORDER_BONUS if teams_in_order(predicted) == teams_in_order(actual) else 0

    return GroupScoreBreakdown(
        group_id=actual.group_id,
        exact_position_points=exact_position_points,
        top_two_bonus=top_two_bonus,
        exact_order_bonus=exact_order_bonus,
        total_points=exact_position_points + top_two_bonus + exact_order_bonus,
    )


def score_entry(
    entry_name: str,
    predicted_standings: Dict[str, GroupStanding],
    actual_standings: Dict[str, GroupStanding],
) -> ScoredEntry:
    group_scores: List[GroupScoreBreakdown] = []

    for group_id in sorted(actual_standings.keys()):
        group_score = score_group(
            predicted=predicted_standings[group_id],
            actual=actual_standings[group_id],
        )
        group_scores.append(group_score)

    total_points = sum(g.total_points for g in group_scores)
    exact_order_count = sum(1 for g in group_scores if g.exact_order_bonus > 0)
    top_two_bonus_count = sum(1 for g in group_scores if g.top_two_bonus > 0)

    return ScoredEntry(
        entry_name=entry_name,
        group_scores=group_scores,
        total_points=total_points,
        exact_order_count=exact_order_count,
        top_two_bonus_count=top_two_bonus_count,
    )