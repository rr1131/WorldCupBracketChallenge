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


def print_leaderboard(leaderboard: list) -> None:
    print("\nLeaderboard")
    for idx, entry in enumerate(leaderboard, start=1):
        print(
            f"{idx}. {entry.entry_name} - {entry.total_points} pts "
            f"(exact orders: {entry.exact_order_count}, top-two bonuses: {entry.top_two_bonus_count})"
        )


def main() -> None:
    service = PickemService(
        tournament_path=Path("config/tournament.json"),
        truth_path=Path("config/truthData/woshisim.json"),
        entries_dir=Path("config/entries"),
    )

    result = service.run()
    print_standings(result["actual_standings"])
    print_leaderboard(result["leaderboard"])


if __name__ == "__main__":
    main()