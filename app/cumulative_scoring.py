from .models import ScoredEntry


def build_scored_entry(
    entry_name: str,
    group_stage_result: dict,
    knockout_result: dict | None = None,
) -> ScoredEntry:
    knockout_result = knockout_result or {
        "knockout_scores": [],
        "knockout_points": 0,
    }

    match_points = group_stage_result["match_points"]
    standing_points = group_stage_result["standing_points"]
    knockout_points = knockout_result["knockout_points"]

    return ScoredEntry(
        entry_name=entry_name,
        match_scores=group_stage_result["match_scores"],
        group_scores=group_stage_result["group_scores"],
        knockout_scores=knockout_result["knockout_scores"],
        match_points=match_points,
        standing_points=standing_points,
        knockout_points=knockout_points,
        total_points=match_points + standing_points + knockout_points,
        exact_order_count=group_stage_result["exact_order_count"],
        top_two_bonus_count=group_stage_result["top_two_bonus_count"],
    )