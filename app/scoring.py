"""Scoring logic for group matches, standings, knockout rounds, and leaderboards."""

from __future__ import annotations

from typing import Dict, Iterable, List, Set

from .models import (
    EntryConfig,
    GroupScoreBreakdown,
    GroupStanding,
    KnockoutMatch,
    KnockoutPick,
    KnockoutScoreBreakdown,
    Match,
    MatchResult,
    MatchScoreBreakdown,
    ScoredEntry,
    TournamentConfig,
)

# Scoring convention for each group-stage match.
MATCH_EXACT_SCORE_POINTS = 3
MATCH_CORRECT_OUTCOME_POINTS = 1

# Scoring convention for group standings.
GROUP_EXACT_POSITION_POINTS = 2
GROUP_TOP_TWO_BONUS = 2
GROUP_EXACT_ORDER_BONUS = 3

# Scoring convention for knockout-stage picks.
KNOCKOUT_STAGE_POINTS = {
    "R32": 2,
    "R16": 4,
    "QF": 8,
    "SF": 16,
    "FINAL": 32,
    "CHAMPION": 64,
}
KNOCKOUT_SCORING_STAGES = ["R32", "R16", "QF", "SF", "FINAL"]


def match_outcome(home_score: int, away_score: int) -> str:
    """Return the categorical outcome of a scoreline."""
    if home_score > away_score:
        return "HOME_WIN"
    if away_score > home_score:
        return "AWAY_WIN"
    return "DRAW"


def teams_in_order(standing: GroupStanding) -> List[str]:
    """Return the teams in standings order."""
    return [row.team for row in standing.rows]


def top_two_set(standing: GroupStanding) -> Set[str]:
    """Return the top-two teams for a group."""
    return {standing.rows[0].team, standing.rows[1].team}


def score_match(
    match: Match,
    predicted: MatchResult,
    actual: MatchResult,
) -> MatchScoreBreakdown:
    """Score one group-stage match prediction."""
    if predicted.home_score == actual.home_score and predicted.away_score == actual.away_score:
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
    """Score every match for a complete truth snapshot."""
    return [
        score_match(
            match=tournament.matches[match_id],
            predicted=entry.predictions[match_id],
            actual=truth_results[match_id],
        )
        for match_id in sorted(tournament.matches.keys())
    ]


def score_completed_matches(
    tournament: TournamentConfig,
    entry: EntryConfig,
    truth_results: Dict[str, MatchResult],
) -> List[MatchScoreBreakdown]:
    """Score only the matches with known truth results."""
    return [
        score_match(
            match=tournament.matches[match_id],
            predicted=entry.predictions[match_id],
            actual=truth_results[match_id],
        )
        for match_id in sorted(truth_results.keys())
        if match_id in tournament.matches and match_id in entry.predictions
    ]


def score_group(predicted: GroupStanding, actual: GroupStanding) -> GroupScoreBreakdown:
    """Score one final group table prediction."""
    exact_position_points = 0
    predicted_by_position = {row.position: row.team for row in predicted.rows}
    actual_by_position = {row.position: row.team for row in actual.rows}

    for pos in range(1, 5):
        if predicted_by_position[pos] == actual_by_position[pos]:
            exact_position_points += GROUP_EXACT_POSITION_POINTS

    top_two_bonus = GROUP_TOP_TWO_BONUS if top_two_set(predicted) == top_two_set(actual) else 0
    exact_order_bonus = (
        GROUP_EXACT_ORDER_BONUS if teams_in_order(predicted) == teams_in_order(actual) else 0
    )
    return GroupScoreBreakdown(
        group_id=actual.group_id,
        exact_position_points=exact_position_points,
        top_two_bonus=top_two_bonus,
        exact_order_bonus=exact_order_bonus,
        total_points=exact_position_points + top_two_bonus + exact_order_bonus,
    )


def empty_group_score(group_id: str) -> GroupScoreBreakdown:
    """Return a zeroed group score for an unresolved group."""
    return GroupScoreBreakdown(
        group_id=group_id,
        exact_position_points=0,
        top_two_bonus=0,
        exact_order_bonus=0,
        total_points=0,
    )


def score_all_groups(
    predicted_standings: Dict[str, GroupStanding],
    actual_standings: Dict[str, GroupStanding],
) -> List[GroupScoreBreakdown]:
    """Score every finalized group in the tournament."""
    return [
        score_group(
            predicted=predicted_standings[group_id],
            actual=actual_standings[group_id],
        )
        for group_id in sorted(actual_standings.keys())
    ]


def score_groups_for_finalized_groups(
    predicted_standings: Dict[str, GroupStanding],
    actual_standings: Dict[str, GroupStanding],
    finalized_group_ids: Iterable[str],
) -> List[GroupScoreBreakdown]:
    """Score finalized groups and leave unresolved groups at zero."""
    finalized_group_id_set = set(finalized_group_ids)
    return [
        (
            score_group(
                predicted=predicted_standings[group_id],
                actual=actual_standings[group_id],
            )
            if group_id in finalized_group_id_set
            else empty_group_score(group_id)
        )
        for group_id in sorted(predicted_standings.keys())
    ]


def build_scored_entry(
    entry_name: str,
    match_scores: List[MatchScoreBreakdown],
    group_scores: List[GroupScoreBreakdown],
    knockout_scores: List[KnockoutScoreBreakdown] | None = None,
) -> ScoredEntry:
    """Assemble a cumulative scored entry payload."""
    knockout_scores = knockout_scores or []
    match_points = sum(score.points for score in match_scores)
    standing_points = sum(score.total_points for score in group_scores)
    knockout_points = sum(score.points for score in knockout_scores)
    return ScoredEntry(
        entry_name=entry_name,
        match_scores=match_scores,
        group_scores=group_scores,
        knockout_scores=knockout_scores,
        match_points=match_points,
        standing_points=standing_points,
        knockout_points=knockout_points,
        total_points=match_points + standing_points + knockout_points,
        exact_order_count=sum(1 for score in group_scores if score.exact_order_bonus > 0),
        top_two_bonus_count=sum(1 for score in group_scores if score.top_two_bonus > 0),
    )


def build_leaderboard(entries: List[ScoredEntry]) -> List[ScoredEntry]:
    """Sort entries using the canonical leaderboard tiebreakers."""
    return sorted(
        entries,
        key=lambda entry: (
            -entry.total_points,
            -entry.exact_order_count,
            -entry.top_two_bonus_count,
            entry.entry_name.lower(),
        ),
    )


def score_group_stage_entry(
    tournament: TournamentConfig,
    entry: EntryConfig,
    truth_results: Dict[str, MatchResult],
    predicted_standings: Dict[str, GroupStanding],
    actual_standings: Dict[str, GroupStanding],
) -> ScoredEntry:
    """Score a complete group-stage entry against a complete truth file."""
    match_scores = score_all_matches(
        tournament=tournament,
        entry=entry,
        truth_results=truth_results,
    )
    group_scores = score_all_groups(
        predicted_standings=predicted_standings,
        actual_standings=actual_standings,
    )
    return build_scored_entry(
        entry_name=entry.entry_name,
        match_scores=match_scores,
        group_scores=group_scores,
    )


def explain_group_scoring(
    predicted: GroupStanding,
    actual: GroupStanding,
    group_score: GroupScoreBreakdown,
) -> List[dict]:
    """Return row-level scoring details for CLI and UI rendering."""
    del group_score
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


def picks_to_lookup(knockout_picks: List[KnockoutPick] | None) -> Dict[str, str]:
    """Convert knockout picks into a slot-id lookup."""
    if not knockout_picks:
        return {}
    return {pick.slot_id: pick.winner_team for pick in knockout_picks}


def teams_in_round(matches: List[KnockoutMatch] | None) -> List[str]:
    """Return unique teams that are confirmed in a bracket round."""
    seen: set[str] = set()
    teams: List[str] = []
    for match in matches or []:
        for team in (match.home_team, match.away_team):
            if team and team not in seen:
                seen.add(team)
                teams.append(team)
    return teams


def bracket_stage_teams(bracket: Dict[str, List[KnockoutMatch]]) -> Dict[str, List[str]]:
    """Return confirmed teams for each scored knockout stage."""
    return {
        stage_name: teams_in_round(bracket.get(stage_name))
        for stage_name in KNOCKOUT_SCORING_STAGES
    }


def score_stage_participants(
    stage_name: str,
    predicted_teams: List[str],
    actual_teams: List[str],
) -> List[KnockoutScoreBreakdown]:
    """Score stage-participation points for one knockout round."""
    actual_team_set = set(actual_teams)
    stage_points = KNOCKOUT_STAGE_POINTS[stage_name]
    return [
        KnockoutScoreBreakdown(
            stage_name=stage_name,
            team=team,
            points=stage_points if team in actual_team_set else 0,
            reason="Correctly reached stage" if team in actual_team_set else "Did not reach stage",
        )
        for team in sorted(predicted_teams)
    ]


def score_champion(
    predicted_pick_lookup: Dict[str, str],
    actual_winner_lookup: Dict[str, str],
) -> List[KnockoutScoreBreakdown]:
    """Score the predicted champion once the final winner is known."""
    predicted_champion = predicted_pick_lookup.get("M104")
    actual_champion = actual_winner_lookup.get("M104")
    if not predicted_champion:
        return []
    return [
        KnockoutScoreBreakdown(
            stage_name="CHAMPION",
            team=predicted_champion,
            points=(
                KNOCKOUT_STAGE_POINTS["CHAMPION"]
                if predicted_champion == actual_champion
                else 0
            ),
            reason=(
                "Correct champion"
                if predicted_champion == actual_champion
                else "Incorrect champion"
            ),
        )
    ]


def score_knockout_picks(
    predicted_bracket: Dict[str, List[KnockoutMatch]],
    actual_bracket: Dict[str, List[KnockoutMatch]],
    predicted_pick_lookup: Dict[str, str],
    actual_winner_lookup: Dict[str, str],
) -> List[KnockoutScoreBreakdown]:
    """Score knockout-stage participation and champion picks."""
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
    return breakdowns


def score_partial_knockout_picks(
    predicted_bracket: Dict[str, List[KnockoutMatch]],
    actual_bracket: Dict[str, List[KnockoutMatch]],
    predicted_pick_lookup: Dict[str, str],
    actual_winner_lookup: Dict[str, str],
) -> List[KnockoutScoreBreakdown]:
    """Award only the knockout points that are already confirmed by known results."""
    predicted_stage_teams = bracket_stage_teams(predicted_bracket)
    actual_stage_teams = bracket_stage_teams(actual_bracket)
    breakdowns: List[KnockoutScoreBreakdown] = []

    for stage_name in KNOCKOUT_SCORING_STAGES:
        confirmed_teams = set(actual_stage_teams[stage_name])
        stage_points = KNOCKOUT_STAGE_POINTS[stage_name]
        for team in sorted(predicted_stage_teams[stage_name]):
            if team in confirmed_teams:
                breakdowns.append(
                    KnockoutScoreBreakdown(
                        stage_name=stage_name,
                        team=team,
                        points=stage_points,
                        reason="Confirmed reached stage",
                    )
                )

    actual_champion = actual_winner_lookup.get("M104")
    predicted_champion = predicted_pick_lookup.get("M104")
    if actual_champion:
        if predicted_champion == actual_champion:
            breakdowns.append(
                KnockoutScoreBreakdown(
                    stage_name="CHAMPION",
                    team=actual_champion,
                    points=KNOCKOUT_STAGE_POINTS["CHAMPION"],
                    reason="Confirmed champion",
                )
            )

    return breakdowns
