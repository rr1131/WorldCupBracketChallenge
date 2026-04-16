from typing import Dict, List

from .models import KnockoutMatch, KnockoutPick, KnockoutScoreBreakdown


KNOCKOUT_STAGE_POINTS = {
    "R32": 2,
    "R16": 4,
    "QF": 8,
    "SF": 16,
    "FINAL": 32,
    "CHAMPION": 48,
}

KNOCKOUT_SCORING_STAGES = ["R32", "R16", "QF", "SF", "FINAL"]


def picks_to_lookup(knockout_picks: List[KnockoutPick] | None) -> Dict[str, str]:
    if not knockout_picks:
        return {}

    return {
        pick.slot_id: pick.winner_team
        for pick in knockout_picks
    }


def teams_in_round(matches: List[KnockoutMatch] | None) -> List[str]:
    seen: set[str] = set()
    teams: List[str] = []

    for match in matches or []:
        for team in (match.home_team, match.away_team):
            if team and team not in seen:
                seen.add(team)
                teams.append(team)

    return teams


def bracket_stage_teams(bracket: Dict[str, List[KnockoutMatch]]) -> Dict[str, List[str]]:
    return {
        stage_name: teams_in_round(bracket.get(stage_name))
        for stage_name in KNOCKOUT_SCORING_STAGES
    }


def score_stage_participants(
    stage_name: str,
    predicted_teams: List[str],
    actual_teams: List[str],
) -> List[KnockoutScoreBreakdown]:
    actual_team_set = set(actual_teams)
    stage_points = KNOCKOUT_STAGE_POINTS[stage_name]

    breakdowns: List[KnockoutScoreBreakdown] = []
    for team in sorted(predicted_teams):
        reached_stage = team in actual_team_set
        breakdowns.append(
            KnockoutScoreBreakdown(
                stage_name=stage_name,
                team=team,
                points=stage_points if reached_stage else 0,
                reason="Correctly reached stage" if reached_stage else "Did not reach stage",
            )
        )
    return breakdowns


def score_champion(
    predicted_pick_lookup: Dict[str, str],
    actual_winner_lookup: Dict[str, str],
) -> List[KnockoutScoreBreakdown]:
    predicted_champion = predicted_pick_lookup.get("M104")
    actual_champion = actual_winner_lookup.get("M104")

    if not predicted_champion:
        return []

    return [
        KnockoutScoreBreakdown(
            stage_name="CHAMPION",
            team=predicted_champion,
            points=KNOCKOUT_STAGE_POINTS["CHAMPION"] if predicted_champion == actual_champion else 0,
            reason="Correct champion" if predicted_champion == actual_champion else "Incorrect champion",
        )
    ]


def score_knockout_picks(
    predicted_bracket: Dict[str, List[KnockoutMatch]],
    actual_bracket: Dict[str, List[KnockoutMatch]],
    predicted_pick_lookup: Dict[str, str],
    actual_winner_lookup: Dict[str, str],
) -> Dict[str, object]:
    predicted_stage_teams = bracket_stage_teams(predicted_bracket)
    actual_stage_teams = bracket_stage_teams(actual_bracket)

    breakdowns: List[KnockoutScoreBreakdown] = []

    for stage_name in KNOCKOUT_SCORING_STAGES:
        breakdowns.extend(
            score_stage_participants(
                stage_name=stage_name,
                predicted_teams=predicted_stage_teams[stage_name],
                actual_teams=actual_stage_teams[stage_name],
            )
        )

    breakdowns.extend(
        score_champion(
            predicted_pick_lookup=predicted_pick_lookup,
            actual_winner_lookup=actual_winner_lookup,
        )
    )

    total_points = sum(item.points for item in breakdowns)

    return {
        "knockout_scores": breakdowns,
        "knockout_points": total_points,
    }
