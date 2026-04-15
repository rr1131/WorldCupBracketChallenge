from typing import Dict, List

from .models import KnockoutMatch, KnockoutPick, KnockoutScoreBreakdown


KNOCKOUT_ROUND_POINTS = {
    "R32": 4,
    "R16": 8,
    "QF": 12,
    "SF": 18,
    "FINAL": 28,
}


def picks_to_lookup(knockout_picks: List[KnockoutPick] | None) -> Dict[str, str]:
    if not knockout_picks:
        return {}

    return {
        pick.slot_id: pick.winner_team
        for pick in knockout_picks
    }


def matches_to_lookup(bracket: Dict[str, List[KnockoutMatch]]) -> Dict[str, KnockoutMatch]:
    lookup: Dict[str, KnockoutMatch] = {}
    for matches in bracket.values():
        for match in matches:
            lookup[match.slot_id] = match
    return lookup


def score_knockout_picks(
    predicted_bracket: Dict[str, List[KnockoutMatch]],
    actual_bracket: Dict[str, List[KnockoutMatch]],
    predicted_pick_lookup: Dict[str, str],
    actual_winner_lookup: Dict[str, str],
) -> Dict[str, object]:
    predicted_match_lookup = matches_to_lookup(predicted_bracket)
    actual_match_lookup = matches_to_lookup(actual_bracket)

    breakdowns: List[KnockoutScoreBreakdown] = []

    for slot_id, actual_winner in actual_winner_lookup.items():
        actual_match = actual_match_lookup.get(slot_id)
        predicted_match = predicted_match_lookup.get(slot_id)
        predicted_winner = predicted_pick_lookup.get(slot_id)

        if not actual_match or not predicted_match:
            continue

        round_name = actual_match.round_name
        round_points = KNOCKOUT_ROUND_POINTS[round_name]

        if predicted_winner is None:
            breakdowns.append(
                KnockoutScoreBreakdown(
                    round_name=round_name,
                    slot_id=slot_id,
                    predicted_winner=None,
                    actual_winner=actual_winner,
                    points=0,
                    reason="No pick submitted",
                )
            )
            continue

        predicted_teams = {predicted_match.home_team, predicted_match.away_team}

        if predicted_winner != actual_winner:
            breakdowns.append(
                KnockoutScoreBreakdown(
                    round_name=round_name,
                    slot_id=slot_id,
                    predicted_winner=predicted_winner,
                    actual_winner=actual_winner,
                    points=0,
                    reason="Incorrect winner",
                )
            )
            continue

        if actual_winner not in predicted_teams:
            breakdowns.append(
                KnockoutScoreBreakdown(
                    round_name=round_name,
                    slot_id=slot_id,
                    predicted_winner=predicted_winner,
                    actual_winner=actual_winner,
                    points=0,
                    reason="Winner matched but matchup path was incorrect",
                )
            )
            continue

        breakdowns.append(
            KnockoutScoreBreakdown(
                round_name=round_name,
                slot_id=slot_id,
                predicted_winner=predicted_winner,
                actual_winner=actual_winner,
                points=round_points,
                reason="Correct winner",
            )
        )

    total_points = sum(item.points for item in breakdowns)

    return {
        "knockout_scores": breakdowns,
        "knockout_points": total_points,
    }