"""Pydantic request and response schemas for the API."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PredictionIn(BaseModel):
    """Incoming group-stage prediction payload."""

    match_id: str
    home_score: int | None = None
    away_score: int | None = None


class KnockoutPickIn(BaseModel):
    """Incoming knockout-pick payload."""

    round_name: str
    slot_id: str
    winner_team: str


class RegisterIn(BaseModel):
    """Registration payload."""

    username: str
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    """Login payload."""

    email: EmailStr
    password: str


class EntryCreateIn(BaseModel):
    """Optional entry-creation payload."""

    entry_name: str | None = None


class EntryUpdateIn(BaseModel):
    """Entry update payload."""

    entry_name: str | None = None
    predictions: list[PredictionIn] | None = None
    advancing_third_place_groups: list[str] | None = None
    knockout_picks: list[KnockoutPickIn] | None = None


class EntrySimulationIn(BaseModel):
    """Stateless entry payload used by the prototype web builder."""

    entry_name: str
    predictions: list[PredictionIn]
    advancing_third_place_groups: list[str] | None = None
    knockout_picks: list[KnockoutPickIn] | None = None


class CreatePoolIn(BaseModel):
    """Pool creation payload."""

    name: str
    description: str = ""
    join_password: str | None = None


class JoinPoolIn(BaseModel):
    """Optional pool join payload."""

    password: str | None = None


class AuthUserOut(BaseModel):
    """Serialized authenticated user."""

    id: str
    username: str
    email: str


class AuthSessionOut(BaseModel):
    """Serialized session payload."""

    current_user: AuthUserOut
    is_locked: bool
    lock_at: str | None


class EntryOut(BaseModel):
    """Serialized entry payload for workspace and detail views."""

    id: str
    owner_id: str
    owner_name: str
    entry_name: str
    created_at: str
    updated_at: str
    status: str
    predictions: list[dict[str, Any]]
    advancing_third_place_groups: list[str] | None = None
    knockout_picks: list[dict[str, Any]] | None = None
    knockout_preview: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    pool_ids: list[str]
    score_total: int | None = None
    max_possible_points: int | None = None
    match_points: int | None = None
    standing_points: int | None = None
    knockout_points: int | None = None
    exact_order_count: int | None = None
    top_two_bonus_count: int | None = None
    champion_team: str | None = None
    can_edit: bool
    can_delete: bool
    can_view_picks: bool
    is_locked: bool


class PoolSummaryOut(BaseModel):
    """Serialized pool summary for workspace lists."""

    id: str
    name: str
    description: str
    invite_code: str
    owner_id: str
    owner_name: str
    member_count: int
    entry_count: int
    is_password_protected: bool
    created_at: str
    updated_at: str


class PoolDetailOut(PoolSummaryOut):
    """Serialized pool detail payload with entry rows."""

    is_locked: bool
    entries: list[dict[str, Any]]


class LiveFixtureOut(BaseModel):
    """Serialized live match row for the public scoreboard feed."""

    fixture_id: str
    kind: str
    group_id: str | None = None
    round_name: str | None = None
    kickoff_at: str | None = None
    home_team: str | None = None
    away_team: str | None = None
    home_score: int | None = None
    away_score: int | None = None
    status: str
    display_status: str
    winner_team: str | None = None
    sportsbook_name: str | None = None
    spread_line: str | None = None
    over_under_line: str | None = None
    espn_event_id: str | None = None
    updated_at: str | None = None


class LiveScoreboardOut(BaseModel):
    """Serialized top-level live scoreboard payload."""

    provider: str
    sync_status: str
    synced_at: str | None = None
    stale: bool
    fixtures: list[LiveFixtureOut]
