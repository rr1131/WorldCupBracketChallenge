from pathlib import Path
from typing import Dict, List

from .models import GroupStanding, MatchScoreBreakdown, ScoredEntry
from .scoring import explain_group_scoring
from .service import PickemService


def print_group_header(group_id: str) -> None:
    print(f"\nGroup {group_id}")


def print_group_predicted_standings_with_scoring(
    group_id: str,
    predicted_standing: GroupStanding,
    actual_standing: GroupStanding,
    scored_entry: ScoredEntry,
) -> None:
    group_score = next(gs for gs in scored_entry.group_scores if gs.group_id == group_id)
    explanations = explain_group_scoring(
        predicted=predicted_standing,
        actual=actual_standing,
        group_score=group_score,
    )

    print_group_header(group_id)

    for exp in explanations:
        row = exp["row"]
        reasons = ", ".join(exp["reasons"]) if exp["reasons"] else "No placement points"
        print(
            f"{row.position}. {row.team} "
            f"({row.points} pts, GD {row.goal_difference}, GF {row.goals_for}) "
            f"– {reasons} ({exp['points']} pts)"
        )

    print(
        f"Standings bonuses: "
        f"top-two bonus={group_score.top_two_bonus}, "
        f"exact-order bonus={group_score.exact_order_bonus}"
    )
    print(f"Standings points for Group {group_id}: {group_score.total_points}")


def print_group_match_scores(
    group_id: str,
    match_scores: List[MatchScoreBreakdown],
) -> None:
    group_match_scores = [m for m in match_scores if m.group_id == group_id]

    print("Match picks:")
    for match_score in group_match_scores:
        print(
            f"  {match_score.match_id}: {match_score.home_team} {match_score.predicted_home_score}-"
            f"{match_score.predicted_away_score} {match_score.away_team} "
            f"(actual {match_score.actual_home_score}-{match_score.actual_away_score}) "
            f"– {match_score.reason} ({match_score.points} pts)"
        )

    group_match_points = sum(m.points for m in group_match_scores)
    print(f"Match points for Group {group_id}: {group_match_points}")


def print_entry_group_breakdown(
    entry_name: str,
    predicted_standings: Dict[str, GroupStanding],
    actual_standings: Dict[str, GroupStanding],
    scored_entry: ScoredEntry,
) -> None:
    print(f"\nPredicted Standings - {entry_name}")

    for group_id in sorted(predicted_standings.keys()):
        predicted_standing = predicted_standings[group_id]
        actual_standing = actual_standings[group_id]

        print_group_predicted_standings_with_scoring(
            group_id=group_id,
            predicted_standing=predicted_standing,
            actual_standing=actual_standing,
            scored_entry=scored_entry,
        )

        print_group_match_scores(
            group_id=group_id,
            match_scores=scored_entry.match_scores,
        )

        group_standing_points = next(
            gs.total_points for gs in scored_entry.group_scores if gs.group_id == group_id
        )
        group_match_points = sum(
            m.points for m in scored_entry.match_scores if m.group_id == group_id
        )
        group_total_points = group_standing_points + group_match_points

        print(f"Total points for Group {group_id}: {group_total_points}")


def print_entry_summary(scored_entry: ScoredEntry) -> None:
    print("\nEntry summary")
    print(f"Entry: {scored_entry.entry_name}")
    print(f"Match points: {scored_entry.match_points}")
    print(f"Standings points: {scored_entry.standing_points}")
    print(f"Total points: {scored_entry.total_points}")
    print(f"Exact group orders: {scored_entry.exact_order_count}")
    print(f"Top-two bonuses hit: {scored_entry.top_two_bonus_count}")


def print_leaderboard(leaderboard: List[ScoredEntry]) -> None:
    print("\nLeaderboard")
    for idx, entry in enumerate(leaderboard, start=1):
        print(
            f"{idx}. {entry.entry_name} - {entry.total_points} pts "
            f"(match: {entry.match_points}, standings: {entry.standing_points}, "
            f"exact orders: {entry.exact_order_count}, top-two bonuses: {entry.top_two_bonus_count})"
        )


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent

    service = PickemService(
        tournament_path=project_root / "config" / "tournament.json",
        truth_path=project_root / "config" / "truth" / "woshisim.json",
        entries_dir=project_root / "config" / "entries",
    )

    result = service.run()

    alice_entry = next(
        entry for entry in result["leaderboard"] if entry.entry_name == "alice"
    )

    print_entry_group_breakdown(
        entry_name="alice",
        predicted_standings=result["predicted_standings_by_entry"]["alice"],
        actual_standings=result["actual_standings"],
        scored_entry=alice_entry,
    )

    print_entry_summary(alice_entry)
    print_leaderboard(result["leaderboard"])


if __name__ == "__main__":
    main()