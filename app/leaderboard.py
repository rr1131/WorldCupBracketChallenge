from typing import List

from .models import ScoredEntry


def build_leaderboard(entries: List[ScoredEntry]) -> List[ScoredEntry]:
    return sorted(
        entries,
        key=lambda e: (
            -e.total_points,
            -e.exact_order_count,
            -e.top_two_bonus_count,
            e.entry_name.lower(),
        ),
    )