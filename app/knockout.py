from dataclasses import dataclass
from typing import Dict, List

from .knockout_2026 import (
    ROUND_OF_32_THIRD_PLACE_MAP,
    ROUND_OF_32_THIRD_PLACE_WINNER_GROUPS,
)
from .models import GroupStanding, GroupStandingRow, KnockoutMatch


@dataclass(frozen=True)
class ThirdPlaceAdvancementTiebreakRequired(Exception):
    locked_group_ids: List[str]
    candidate_group_ids: List[str]
    slots_remaining: int

    def __str__(self) -> str:
        candidate_text = ", ".join(self.candidate_group_ids)
        return (
            "Third-place advancement is tied on points, goal difference, and goals for. "
            f"Locked groups: {self.locked_group_ids}. "
            f"Choose {self.slots_remaining} from: {candidate_text}."
        )


ROUND_OF_32_FIXED_MATCHES = [
    ("M73", ("R", "A"), ("R", "B")),
    ("M74", ("W", "E"), ("3", "E")),
    ("M75", ("W", "F"), ("R", "C")),
    ("M76", ("W", "C"), ("R", "F")),
    ("M77", ("W", "I"), ("3", "I")),
    ("M78", ("R", "E"), ("R", "I")),
    ("M79", ("W", "A"), ("3", "A")),
    ("M80", ("W", "L"), ("3", "L")),
    ("M81", ("W", "D"), ("3", "D")),
    ("M82", ("W", "G"), ("3", "G")),
    ("M83", ("R", "K"), ("R", "L")),
    ("M84", ("W", "H"), ("R", "J")),
    ("M85", ("W", "B"), ("3", "B")),
    ("M86", ("W", "J"), ("R", "H")),
    ("M87", ("W", "K"), ("3", "K")),
    ("M88", ("R", "D"), ("R", "G")),
]

KNOCKOUT_ADVANCEMENT_PAIRS = {
    "R16": [
        ("M89", "M73", "M75"),
        ("M90", "M74", "M77"),
        ("M91", "M76", "M78"),
        ("M92", "M79", "M80"),
        ("M93", "M83", "M84"),
        ("M94", "M81", "M82"),
        ("M95", "M86", "M88"),
        ("M96", "M85", "M87"),
    ],
    "QF": [
        ("M97", "M89", "M90"),
        ("M98", "M93", "M94"),
        ("M99", "M91", "M92"),
        ("M100", "M95", "M96"),
    ],
    "SF": [
        ("M101", "M97", "M98"),
        ("M102", "M99", "M100"),
    ],
    "FINAL": [
        ("M104", "M101", "M102"),
    ],
}


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


def third_place_sort_key(row: GroupStandingRow) -> tuple[int, int, int]:
    return (
        row.points,
        row.goal_difference,
        row.goals_for,
    )


def rank_third_place_teams(third_place_rows: List[GroupStandingRow]) -> List[GroupStandingRow]:
    return sorted(
        third_place_rows,
        key=lambda row: (
            -row.points,
            -row.goal_difference,
            -row.goals_for,
            row.group_id,
        ),
    )


def get_third_place_advancement_state(
    third_place_rows: List[GroupStandingRow],
) -> dict:
    ranked = rank_third_place_teams(third_place_rows)
    cutoff_key = third_place_sort_key(ranked[7])

    locked = [row for row in ranked if third_place_sort_key(row) > cutoff_key]
    tied = [row for row in ranked if third_place_sort_key(row) == cutoff_key]
    slots_remaining = 8 - len(locked)
    is_ambiguous = len(tied) > slots_remaining

    return {
        "ranked": ranked,
        "locked": locked,
        "tied": tied,
        "slots_remaining": slots_remaining,
        "is_ambiguous": is_ambiguous,
    }


def validate_advancing_third_place_override(
    third_place_rows: List[GroupStandingRow],
    override_group_ids: List[str],
) -> List[GroupStandingRow]:
    row_by_group = {row.group_id: row for row in third_place_rows}

    if len(override_group_ids) != 8:
        raise ValueError("advancing_third_place_groups must contain exactly 8 group ids.")

    if len(set(override_group_ids)) != 8:
        raise ValueError("advancing_third_place_groups must not contain duplicates.")

    invalid_groups = sorted(set(override_group_ids) - set(row_by_group.keys()))
    if invalid_groups:
        raise ValueError(f"Unknown third-place group ids in override: {invalid_groups}")

    state = get_third_place_advancement_state(third_place_rows)
    locked_ids = {row.group_id for row in state["locked"]}
    override_ids = set(override_group_ids)

    if not state["is_ambiguous"]:
        expected_ids = {row.group_id for row in state["ranked"][:8]}
        if override_ids != expected_ids:
            raise ValueError(
                "advancing_third_place_groups does not match the deterministic top eight "
                "third-placed groups."
            )
    else:
        tied_ids = {row.group_id for row in state["tied"]}
        if not locked_ids.issubset(override_ids):
            raise ValueError(
                "advancing_third_place_groups must include all locked third-placed groups."
            )

        chosen_from_tied = override_ids - locked_ids
        if not chosen_from_tied.issubset(tied_ids):
            raise ValueError(
                "advancing_third_place_groups may only choose the remaining slots from the "
                "tied third-placed groups."
            )

        if len(chosen_from_tied) != state["slots_remaining"]:
            raise ValueError(
                f"advancing_third_place_groups must choose exactly {state['slots_remaining']} "
                "groups from the tied set."
            )

    return [row_by_group[group_id] for group_id in sorted(override_group_ids)]


def get_advancing_third_place_teams(
    predicted_standings: Dict[str, GroupStanding],
    override_group_ids: List[str] | None = None,
) -> List[GroupStandingRow]:
    advancers = get_group_advancers(predicted_standings)
    third_place_rows = advancers["third_place_rows"]

    if override_group_ids is not None:
        return validate_advancing_third_place_override(third_place_rows, override_group_ids)

    state = get_third_place_advancement_state(third_place_rows)
    if state["is_ambiguous"]:
        raise ThirdPlaceAdvancementTiebreakRequired(
            locked_group_ids=sorted(row.group_id for row in state["locked"]),
            candidate_group_ids=sorted(row.group_id for row in state["tied"]),
            slots_remaining=state["slots_remaining"],
        )

    return state["ranked"][:8]


def generate_round_of_32(
    predicted_standings: Dict[str, GroupStanding],
    advancing_third_place_groups: List[str] | None = None,
) -> List[KnockoutMatch]:
    advancers = get_group_advancers(predicted_standings)
    winners = advancers["winners"]
    runners_up = advancers["runners_up"]
    third_place_advancers = get_advancing_third_place_teams(
        predicted_standings=predicted_standings,
        override_group_ids=advancing_third_place_groups,
    )

    qualifying_groups = "".join(sorted(row.group_id for row in third_place_advancers))
    third_place_map = ROUND_OF_32_THIRD_PLACE_MAP.get(qualifying_groups)

    if third_place_map is None:
        raise ValueError(
            f"No Round of 32 mapping found for third-place group combination {qualifying_groups}"
        )

    def resolve_participant(source: tuple[str, str]) -> str:
        kind, group_id = source
        if kind == "W":
            return winners[group_id]
        if kind == "R":
            return runners_up[group_id]
        if kind == "3":
            third_place_group_id = third_place_map[group_id]
            return predicted_standings[third_place_group_id].rows[2].team
        raise ValueError(f"Unknown participant source kind: {kind}")

    return [
        KnockoutMatch(
            round_name="R32",
            slot_id=slot_id,
            home_team=resolve_participant(home_source),
            away_team=resolve_participant(away_source),
        )
        for slot_id, home_source, away_source in ROUND_OF_32_FIXED_MATCHES
    ]


def advance_knockout_round(
    winner_by_slot: Dict[str, str],
    next_round_name: str,
    pairings: List[tuple[str, str, str]],
) -> List[KnockoutMatch]:
    next_round_matches: List[KnockoutMatch] = []

    for slot_id, home_from_slot, away_from_slot in pairings:
        next_round_matches.append(
            KnockoutMatch(
                round_name=next_round_name,
                slot_id=slot_id,
                home_team=winner_by_slot.get(home_from_slot),
                away_team=winner_by_slot.get(away_from_slot),
            )
        )

    return next_round_matches


def generate_full_knockout_bracket(
    predicted_standings: Dict[str, GroupStanding],
    knockout_pick_lookup: Dict[str, str] | None = None,
    advancing_third_place_groups: List[str] | None = None,
) -> Dict[str, List[KnockoutMatch]]:
    knockout_pick_lookup = knockout_pick_lookup or {}

    r32 = generate_round_of_32(
        predicted_standings=predicted_standings,
        advancing_third_place_groups=advancing_third_place_groups,
    )

    r16 = advance_knockout_round(
        winner_by_slot=knockout_pick_lookup,
        next_round_name="R16",
        pairings=KNOCKOUT_ADVANCEMENT_PAIRS["R16"],
    )

    qf = advance_knockout_round(
        winner_by_slot=knockout_pick_lookup,
        next_round_name="QF",
        pairings=KNOCKOUT_ADVANCEMENT_PAIRS["QF"],
    )

    sf = advance_knockout_round(
        winner_by_slot=knockout_pick_lookup,
        next_round_name="SF",
        pairings=KNOCKOUT_ADVANCEMENT_PAIRS["SF"],
    )

    final = advance_knockout_round(
        winner_by_slot=knockout_pick_lookup,
        next_round_name="FINAL",
        pairings=KNOCKOUT_ADVANCEMENT_PAIRS["FINAL"],
    )

    return {
        "R32": r32,
        "R16": r16,
        "QF": qf,
        "SF": sf,
        "FINAL": final,
    }
