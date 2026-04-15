from dataclasses import dataclass
from typing import Dict, List

from .models import GroupStanding, GroupStandingRow, KnockoutMatch


def get_group_advancers(predicted_standings: Dict[str, GroupStanding]) -> dict:
    winners: Dict[str, str] = {}
    runners_up: Dict[str, str] = {}
    third_place_rows: List[GroupStandingRow] = []

    for group_id, standing in predicted_standings.items():
        winners[group_id] = standing.rows[0].team
        runners_up[group_id] = standing.rows[1].team
        third_place_rows.append(standing.rows[2])

    return {
        "winners": winners,
        "runners_up": runners_up,
        "third_place_rows": third_place_rows,
    }


def rank_third_place_teams(third_place_rows: List[GroupStandingRow]) -> List[GroupStandingRow]:
    """
    v1:
    - points
    - goal difference
    - goals for
    - alphabetical team fallback

    Later:
    add fair play or manual override support.
    """
    return sorted(
        third_place_rows,
        key=lambda row: (
            -row.points,
            -row.goal_difference,
            -row.goals_for,
            row.team,
        ),
    )


def get_advancing_third_place_teams(
    predicted_standings: Dict[str, GroupStanding],
) -> List[GroupStandingRow]:
    advancers = get_group_advancers(predicted_standings)
    ranked = rank_third_place_teams(advancers["third_place_rows"])
    return ranked[:8]


# Placeholder example structure.
# You should move this into config/knockout_2026.py or json once you encode the official table.
THIRD_PLACE_COMBINATION_MAP = {
    # Example key: sorted concatenation of qualifying third-place group IDs
    # "ABCDIJKL": {
    #     "R32_A": "A",
    #     "R32_B": "C",
    #     ...
    # }
}


def generate_round_of_32(
    predicted_standings: Dict[str, GroupStanding],
) -> List[KnockoutMatch]:
    advancers = get_group_advancers(predicted_standings)
    winners = advancers["winners"]
    runners_up = advancers["runners_up"]
    third_place_advancers = get_advancing_third_place_teams(predicted_standings)

    qualifying_groups = "".join(sorted(row.group_id for row in third_place_advancers))
    third_place_map = THIRD_PLACE_COMBINATION_MAP.get(qualifying_groups)

    if third_place_map is None:
        raise ValueError(
            f"No Round of 32 mapping found for third-place group combination {qualifying_groups}"
        )

    # You will need to encode the official fixed slots here.
    # Example shape only:
    matches = [
        KnockoutMatch(round_name="R32", slot_id="R32_A", home_team=winners["A"], away_team=runners_up["B"]),
        KnockoutMatch(round_name="R32", slot_id="R32_B", home_team=winners["C"], away_team=runners_up["D"]),
        # ...
    ]

    return matches


def advance_knockout_round(
    current_round_matches: List[KnockoutMatch],
    winner_by_slot: Dict[str, str],
    next_round_name: str,
    next_round_slots: List[str],
) -> List[KnockoutMatch]:
    if len(current_round_matches) % 2 != 0:
        raise ValueError("Current round must have even number of matches.")

    next_round_matches: List[KnockoutMatch] = []

    for index in range(0, len(current_round_matches), 2):
        left = current_round_matches[index]
        right = current_round_matches[index + 1]

        next_round_matches.append(
            KnockoutMatch(
                round_name=next_round_name,
                slot_id=next_round_slots[index // 2],
                home_team=winner_by_slot.get(left.slot_id),
                away_team=winner_by_slot.get(right.slot_id),
            )
        )

    return next_round_matches


def generate_full_knockout_bracket(
    predicted_standings: Dict[str, GroupStanding],
    knockout_pick_lookup: Dict[str, str] | None = None,
) -> Dict[str, List[KnockoutMatch]]:
    knockout_pick_lookup = knockout_pick_lookup or {}

    r32 = generate_round_of_32(predicted_standings)

    r16 = advance_knockout_round(
        current_round_matches=r32,
        winner_by_slot=knockout_pick_lookup,
        next_round_name="R16",
        next_round_slots=["R16_A", "R16_B", "R16_C", "R16_D", "R16_E", "R16_F", "R16_G", "R16_H"],
    )

    qf = advance_knockout_round(
        current_round_matches=r16,
        winner_by_slot=knockout_pick_lookup,
        next_round_name="QF",
        next_round_slots=["QF_A", "QF_B", "QF_C", "QF_D"],
    )

    sf = advance_knockout_round(
        current_round_matches=qf,
        winner_by_slot=knockout_pick_lookup,
        next_round_name="SF",
        next_round_slots=["SF_A", "SF_B"],
    )

    final = advance_knockout_round(
        current_round_matches=sf,
        winner_by_slot=knockout_pick_lookup,
        next_round_name="FINAL",
        next_round_slots=["FINAL"],
    )

    return {
        "R32": r32,
        "R16": r16,
        "QF": qf,
        "SF": sf,
        "FINAL": final,
    }