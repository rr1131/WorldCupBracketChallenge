from .models import TournamentConfig, TruthConfig, EntryConfig, KnockoutMatch


class ValidationError(Exception):
    pass


def validate_tournament_config(cfg: TournamentConfig) -> None:
    for group_id, group in cfg.groups.items():
        if len(group.teams) != 4:
            raise ValidationError(f"Group {group_id} must have exactly 4 teams.")

    seen_teams = set()
    for group in cfg.groups.values():
        for team in group.teams:
            if team in seen_teams:
                raise ValidationError(f"Duplicate team found: {team}")
            seen_teams.add(team)

    for match in cfg.matches.values():
        if match.group_id not in cfg.groups:
            raise ValidationError(f"Match {match.id} references unknown group {match.group_id}")

        group_teams = set(cfg.groups[match.group_id].teams)
        if match.home_team not in group_teams or match.away_team not in group_teams:
            raise ValidationError(f"Match {match.id} contains teams not in group {match.group_id}")


def validate_truth_config(tournament: TournamentConfig, truth: TruthConfig) -> None:
    for match_id, result in truth.results.items():
        if match_id not in tournament.matches:
            raise ValidationError(f"Truth result references unknown match {match_id}")

        if result.home_score < 0 or result.away_score < 0:
            raise ValidationError(f"Negative score in truth result for {match_id}")

    for group_id, ordered_teams in truth.group_overrides.items():
        if group_id not in tournament.groups:
            raise ValidationError(f"Unknown group override: {group_id}")

        expected = set(tournament.groups[group_id].teams)
        actual = set(ordered_teams)
        if expected != actual:
            raise ValidationError(f"Group override for {group_id} does not match group teams")

    if truth.advancing_third_place_groups is not None:
        validate_advancing_third_place_groups(
            tournament=tournament,
            advancing_third_place_groups=truth.advancing_third_place_groups,
            label="truth",
        )


def validate_entry_config(tournament: TournamentConfig, entry: EntryConfig) -> None:
    expected_match_ids = set(tournament.matches.keys())
    actual_match_ids = set(entry.predictions.keys())

    if expected_match_ids != actual_match_ids:
        missing = expected_match_ids - actual_match_ids
        extra = actual_match_ids - expected_match_ids
        raise ValidationError(
            f"Entry {entry.entry_name} mismatch. Missing={sorted(missing)}, Extra={sorted(extra)}"
        )

    for match_id, prediction in entry.predictions.items():
        if prediction.home_score < 0 or prediction.away_score < 0:
            raise ValidationError(f"Negative predicted score in entry {entry.entry_name} for {match_id}")

    if entry.advancing_third_place_groups is not None:
        validate_advancing_third_place_groups(
            tournament=tournament,
            advancing_third_place_groups=entry.advancing_third_place_groups,
            label=f"entry {entry.entry_name}",
        )


def validate_advancing_third_place_groups(
    tournament: TournamentConfig,
    advancing_third_place_groups: list[str],
    label: str,
) -> None:
    if len(advancing_third_place_groups) != 8:
        raise ValidationError(
            f"{label} must specify exactly 8 advancing third-place group ids."
        )

    if len(set(advancing_third_place_groups)) != 8:
        raise ValidationError(
            f"{label} advancing third-place group ids must be unique."
        )

    unknown_groups = sorted(
        set(advancing_third_place_groups) - set(tournament.groups.keys())
    )
    if unknown_groups:
        raise ValidationError(
            f"{label} advancing third-place group ids contain unknown groups: {unknown_groups}"
        )


def validate_knockout_picks(
    entry: EntryConfig,
    predicted_bracket: dict[str, list[KnockoutMatch]],
) -> None:
    if not entry.knockout_picks:
        return

    validate_knockout_winner_lookup(
        winner_lookup={pick.slot_id: pick.winner_team for pick in entry.knockout_picks},
        bracket=predicted_bracket,
        label=f"entry {entry.entry_name}",
    )


def validate_knockout_winner_lookup(
    winner_lookup: dict[str, str],
    bracket: dict[str, list[KnockoutMatch]],
    label: str,
) -> None:
    if not winner_lookup:
        return

    match_lookup = {}
    for matches in bracket.values():
        for match in matches:
            match_lookup[match.slot_id] = match

    for slot_id, winner_team in winner_lookup.items():
        if slot_id not in match_lookup:
            raise ValidationError(f"Unknown knockout slot in {label}: {slot_id}")

        match = match_lookup[slot_id]
        valid_teams = {match.home_team, match.away_team}

        if winner_team not in valid_teams:
            raise ValidationError(
                f"Invalid knockout winner for {label} at {slot_id}: {winner_team} "
                f"not in matchup {match.home_team} vs {match.away_team}"
            )
