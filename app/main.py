from pathlib import Path

from .service import PickemService


def print_standings(actual_standings: dict) -> None:
    for group_id, standing in actual_standings.items():
        print(f"\nGroup {group_id}")
        for row in standing.rows:
            print(
                f"{row.position}. {row.team} "
                f"({row.points} pts, GD {row.goal_difference}, GF {row.goals_for})"
            )


def print_predicted_standings(predicted_standings_by_entry: dict) -> None:
    for entry_name, standings in predicted_standings_by_entry.items():
        print(f"\nPredicted Standings - {entry_name}")
        for group_id, standing in standings.items():
            print(f"\nGroup {group_id}")
            for row in standing.rows:
                print(
                    f"{row.position}. {row.team} "
                    f"({row.points} pts, GD {row.goal_difference}, GF {row.goals_for})"
                )


def explain_group_standing(standing) -> None:
    print(f"\nGroup {standing.group_id} breakdown")
    for row in standing.rows:
        print(
            f"{row.position}. {row.team}: "
            f"{row.played} GP, "
            f"{row.wins}-{row.draws}-{row.losses}, "
            f"GF {row.goals_for}, "
            f"GA {row.goals_against}, "
            f"GD {row.goal_difference}, "
            f"{row.points} pts"
        )


def print_leaderboard(leaderboard: list) -> None:
    print("\nLeaderboard")
    for idx, entry in enumerate(leaderboard, start=1):
        print(
            f"{idx}. {entry.entry_name} - {entry.total_points} pts "
            f"(exact orders: {entry.exact_order_count}, top-two bonuses: {entry.top_two_bonus_count})"
        )


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent

    service = PickemService(
        tournament_path=project_root / "config" / "tournament.json",
        truth_path=project_root / "config" / "truth" / "woshisim.json",
        entries_dir=project_root / "config" / "entries",
    )

    result = service.run()

    print_standings(result["actual_standings"])
    print_predicted_standings(result["predicted_standings_by_entry"])
    print_leaderboard(result["leaderboard"])

    print("\nDetailed actual Group B")
    explain_group_standing(result["actual_standings"]["B"])

    print("\nDetailed predicted Group B - alice")
    explain_group_standing(result["predicted_standings_by_entry"]["alice"]["B"])

if __name__ == "__main__":
    main()