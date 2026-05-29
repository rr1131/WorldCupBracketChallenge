"""Tournament-domain dataclasses used by scoring, validation, and live sync."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional


@dataclass(frozen=True)
class Group:
    """A tournament group and its participating teams."""

    id: str
    teams: List[str]


@dataclass(frozen=True)
class Match:
    """A scheduled group-stage match."""

    id: str
    group_id: str
    home_team: str
    away_team: str
    kickoff_at: datetime | None = None
    espn_event_id: str | None = None


@dataclass(frozen=True)
class KnockoutFixture:
    """Metadata describing a knockout-stage fixture slot."""

    slot_id: str
    round_name: str
    kickoff_at: datetime | None = None
    espn_event_id: str | None = None


@dataclass(frozen=True)
class MatchResult:
    """A concrete scoreline for a match."""

    match_id: str
    home_score: int
    away_score: int


@dataclass(frozen=True)
class TournamentConfig:
    """Parsed tournament configuration."""

    groups: Dict[str, Group]
    matches: Dict[str, Match]
    knockout_fixtures: Dict[str, KnockoutFixture]


@dataclass(frozen=True)
class TruthConfig:
    """Partial or complete truth snapshot for tournament outcomes."""

    results: Dict[str, MatchResult]
    group_overrides: Dict[str, List[str]]
    advancing_third_place_groups: List[str] | None = None
    knockout_results: Dict[str, str] | None = None


@dataclass(frozen=True)
class KnockoutPick:
    """A predicted knockout winner for a bracket slot."""

    round_name: str
    slot_id: str
    winner_team: str


@dataclass(frozen=True)
class EntryConfig:
    """A complete, scoreable bracket entry."""

    entry_name: str
    predictions: Dict[str, MatchResult]
    advancing_third_place_groups: List[str] | None = None
    knockout_picks: List[KnockoutPick] | None = None


@dataclass
class TeamStats:
    """Accumulated standings stats for a team."""

    team: str
    group_id: str
    played: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_difference: int = 0
    points: int = 0


@dataclass(frozen=True)
class GroupStandingRow:
    """One ranked row within a final or projected group table."""

    position: int
    team: str
    group_id: str
    played: int
    wins: int
    draws: int
    losses: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int


@dataclass(frozen=True)
class GroupStanding:
    """A group table ordered from first to fourth."""

    group_id: str
    rows: List[GroupStandingRow]


@dataclass(frozen=True)
class MatchScoreBreakdown:
    """Scoring details for a single group-stage match pick."""

    match_id: str
    group_id: str
    home_team: str
    away_team: str
    predicted_home_score: int
    predicted_away_score: int
    actual_home_score: int
    actual_away_score: int
    points: int
    reason: str


@dataclass(frozen=True)
class GroupScoreBreakdown:
    """Scoring details for one final group table."""

    group_id: str
    exact_position_points: int
    top_two_bonus: int
    exact_order_bonus: int
    total_points: int


@dataclass(frozen=True)
class KnockoutMatch:
    """A knockout match pairing, optionally with unresolved participants."""

    round_name: str
    slot_id: str
    home_team: Optional[str]
    away_team: Optional[str]


@dataclass(frozen=True)
class KnockoutScoreBreakdown:
    """Scoring details for one knockout-stage team credit."""

    stage_name: str
    team: str
    points: int
    reason: str


@dataclass(frozen=True)
class ScoredEntry:
    """A fully or partially scored entry summary."""

    entry_name: str
    match_scores: List[MatchScoreBreakdown]
    group_scores: List[GroupScoreBreakdown]
    knockout_scores: List[KnockoutScoreBreakdown]
    match_points: int
    standing_points: int
    knockout_points: int
    total_points: int
    exact_order_count: int
    top_two_bonus_count: int


@dataclass(frozen=True)
class LiveFixtureState:
    """A normalized live-fixture payload for browser scoreboards."""

    fixture_id: str
    kind: str
    group_id: str | None
    round_name: str | None
    kickoff_at: datetime | None
    home_team: str | None
    away_team: str | None
    home_score: int | None
    away_score: int | None
    status: str
    display_status: str
    winner_team: str | None
    sportsbook_name: str | None
    spread_line: str | None
    over_under_line: str | None
    espn_event_id: str | None
    updated_at: datetime | None


@dataclass(frozen=True)
class EspnFixtureMapping:
    """An ESPN mapping entry keyed by tournament fixture id."""

    fixture_id: str
    kickoff_at: datetime | None = None
    espn_event_id: str | None = None
