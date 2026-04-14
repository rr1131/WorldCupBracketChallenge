from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class Group:
    id: str
    teams: List[str]


@dataclass(frozen=True)
class Match:
    id: str
    group_id: str
    home_team: str
    away_team: str


@dataclass(frozen=True)
class MatchResult:
    match_id: str
    home_score: int
    away_score: int


@dataclass(frozen=True)
class TournamentConfig:
    groups: Dict[str, Group]
    matches: Dict[str, Match]


@dataclass(frozen=True)
class TruthConfig:
    results: Dict[str, MatchResult]
    group_overrides: Dict[str, List[str]]


@dataclass(frozen=True)
class EntryConfig:
    entry_name: str
    predictions: Dict[str, MatchResult]


@dataclass
class TeamStats:
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
    group_id: str
    rows: List[GroupStandingRow]


@dataclass(frozen=True)
class GroupScoreBreakdown:
    group_id: str
    exact_position_points: int
    top_two_bonus: int
    exact_order_bonus: int
    total_points: int


@dataclass(frozen=True)
class ScoredEntry:
    entry_name: str
    group_scores: List[GroupScoreBreakdown]
    total_points: int
    exact_order_count: int
    top_two_bonus_count: int