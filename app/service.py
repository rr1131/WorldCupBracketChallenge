"""Business logic for auth, entries, pools, scoring, and live rescore flows."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Iterable, Sequence
from uuid import uuid4

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .db_models import Entry, Pool, PoolEntry, PoolMember, User
from .knockout import ThirdPlaceAdvancementTiebreakRequired, generate_full_knockout_bracket
from .loader import load_tournament_config
from .max_points import (
    compute_group_points_ceiling,
    compute_knockout_points_ceiling,
    compute_match_points_ceiling,
    max_total_points,
)
from .models import EntryConfig, GroupStanding, KnockoutPick, MatchResult, TournamentConfig, TruthConfig
from .scoring import (
    build_scored_entry,
    picks_to_lookup,
    score_completed_matches,
    score_group_stage_entry,
    score_groups_for_finalized_groups,
    score_knockout_picks,
    score_partial_knockout_picks,
)
from .security import decode_access_token, hash_password, verify_password
from .standings import compute_all_group_standings, compute_group_standings
from .truth import get_truth_provider
from .validator import (
    ValidationError,
    validate_entry_config,
    validate_knockout_picks,
    validate_knockout_winner_lookup,
    validate_tournament_config,
    validate_truth_config,
)


class ServiceError(Exception):
    """Raised for user-facing service-layer errors."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        """Store the status code alongside the error message."""
        super().__init__(message)
        self.status_code = status_code


@lru_cache(maxsize=1)
def load_tournament() -> TournamentConfig:
    """Load and validate the tournament config once per process."""
    tournament = load_tournament_config(get_settings().tournament_path)
    validate_tournament_config(tournament)
    return tournament


def load_truth_snapshot() -> TruthConfig:
    """Load and validate the active truth snapshot."""
    tournament = load_tournament()
    truth = get_truth_provider().load_truth()
    validate_truth_config(tournament, truth)
    return truth


def _now_utc() -> datetime:
    """Return the current timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


def entries_locked() -> bool:
    """Return whether entry editing is globally locked."""
    lock_at = get_settings().entry_lock_at
    if lock_at is None:
        return False
    if lock_at.tzinfo is None:
        lock_at = lock_at.replace(tzinfo=timezone.utc)
    return _now_utc() >= lock_at


def lock_iso() -> str | None:
    """Return the configured lock timestamp as an ISO string."""
    lock_at = get_settings().entry_lock_at
    return lock_at.isoformat() if lock_at else None


def generate_id(prefix: str) -> str:
    """Generate a stable prefixed identifier."""
    return f"{prefix}-{uuid4().hex}"


def create_invite_code(name: str) -> str:
    """Generate a compact invite code from a pool name."""
    slug = "".join(char for char in name.upper() if char.isalnum())[:6]
    return f"{slug or 'POOL'}{uuid4().hex[:6].upper()}"


def prediction_template() -> list[dict[str, Any]]:
    """Return a blank prediction list for a new entry."""
    tournament = load_tournament()
    return [
        {"match_id": match.id, "home_score": None, "away_score": None}
        for match in tournament.matches.values()
    ]


def normalize_predictions(predictions: Sequence[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Normalize potentially partial predictions to full tournament coverage."""
    tournament = load_tournament()
    provided = {item["match_id"]: item for item in (predictions or []) if "match_id" in item}
    normalized: list[dict[str, Any]] = []
    for match_id in sorted(tournament.matches.keys()):
        current = provided.get(match_id, {"match_id": match_id, "home_score": None, "away_score": None})
        normalized.append(
            {
                "match_id": match_id,
                "home_score": current.get("home_score"),
                "away_score": current.get("away_score"),
            }
        )
    return normalized


def normalize_knockout_picks(knockout_picks: Sequence[dict[str, Any]] | None) -> list[dict[str, Any]] | None:
    """Normalize knockout picks into a persisted list or `None`."""
    if not knockout_picks:
        return None
    normalized = [
        {
            "round_name": pick["round_name"],
            "slot_id": pick["slot_id"],
            "winner_team": pick["winner_team"],
        }
        for pick in knockout_picks
    ]
    return normalized or None


def _entry_pool_ids(entry: Entry) -> list[str]:
    """Return the pool ids attached to an entry."""
    return sorted(link.pool_id for link in entry.pool_links)


def _champion_team(entry: Entry) -> str | None:
    """Return the predicted champion for an entry when one exists."""
    for pick in entry.knockout_picks or []:
        if pick["slot_id"] == "M104":
            return pick["winner_team"]
    return None


def _entry_sort_key(entry: Entry) -> tuple[Any, ...]:
    """Return the canonical leaderboard sort key for persisted entries."""
    return (
        -(entry.score_total or 0),
        -(entry.exact_order_count or 0),
        -(entry.top_two_bonus_count or 0),
        entry.entry_name.lower(),
    )


def _entry_status(entry: Entry) -> str:
    """Return the coarse user-facing status for an entry."""
    if entry.result_payload is not None or entry.score_total is not None:
        return "scored"
    if entry.knockout_preview is not None:
        return "knockout"
    return "draft"


def _serialize_standings(standings: dict[str, GroupStanding]) -> dict[str, list[dict[str, Any]]]:
    """Convert standings dataclasses into JSON-compatible dictionaries."""
    return {
        group_id: [asdict(row) for row in standing.rows]
        for group_id, standing in standings.items()
    }


def _serialize_bracket(bracket: dict[str, list[Any]]) -> dict[str, list[dict[str, Any]]]:
    """Convert knockout bracket dataclasses into JSON-compatible dictionaries."""
    return {
        round_name: [asdict(match) for match in matches]
        for round_name, matches in bracket.items()
    }


def _entry_has_shared_pool(session: Session, viewer_user_id: str, entry_id: str) -> bool:
    """Return whether a viewer shares at least one pool with an entry."""
    pool_ids = select(PoolEntry.pool_id).where(PoolEntry.entry_id == entry_id)
    membership = session.scalar(
        select(PoolMember.id).where(
            PoolMember.user_id == viewer_user_id,
            PoolMember.pool_id.in_(pool_ids),
        )
    )
    return membership is not None


def _entry_query() -> Select[tuple[Entry]]:
    """Return the base query used for entry loading."""
    return select(Entry).options(selectinload(Entry.owner), selectinload(Entry.pool_links))


def _pool_query() -> Select[tuple[Pool]]:
    """Return the base query used for pool loading."""
    return select(Pool).options(
        selectinload(Pool.owner),
        selectinload(Pool.members),
        selectinload(Pool.entry_links).selectinload(PoolEntry.entry).selectinload(Entry.owner),
        selectinload(Pool.entry_links).selectinload(PoolEntry.entry).selectinload(Entry.pool_links),
    )


def _require_entry_owner(session: Session, user_id: str, entry_id: str) -> Entry:
    """Load an entry and verify ownership."""
    entry = session.scalar(_entry_query().where(Entry.id == entry_id))
    if entry is None:
        raise ServiceError("Entry not found.", status_code=404)
    if entry.owner_id != user_id:
        raise ServiceError("You can only modify your own entries.", status_code=403)
    return entry


def _require_pool_member(session: Session, user_id: str, pool_id: str) -> Pool:
    """Load a pool and verify that the current user belongs to it."""
    pool = session.scalar(_pool_query().where(Pool.id == pool_id))
    if pool is None:
        raise ServiceError("Pool not found.", status_code=404)
    if not any(member.user_id == user_id for member in pool.members):
        raise ServiceError("You must be a member of this pool to view it.", status_code=403)
    return pool


def _prediction_lookup(entry: Entry) -> dict[str, dict[str, Any]]:
    """Return persisted predictions keyed by match id."""
    return {item["match_id"]: item for item in entry.predictions or []}


def _build_complete_entry(entry: Entry) -> EntryConfig:
    """Convert a persisted entry into a complete scoreable entry config."""
    tournament = load_tournament()
    predictions_lookup = _prediction_lookup(entry)
    predictions: dict[str, MatchResult] = {}

    for match_id in sorted(tournament.matches.keys()):
        payload = predictions_lookup.get(match_id)
        if payload is None:
            raise ServiceError("Entry is missing one or more group-stage predictions.")
        home_score = payload.get("home_score")
        away_score = payload.get("away_score")
        if not isinstance(home_score, int) or not isinstance(away_score, int):
            raise ServiceError("Finish all group-stage match picks before continuing.")
        predictions[match_id] = MatchResult(
            match_id=match_id,
            home_score=home_score,
            away_score=away_score,
        )

    knockout_picks = None
    if entry.knockout_picks:
        knockout_picks = [
            KnockoutPick(
                round_name=pick["round_name"],
                slot_id=pick["slot_id"],
                winner_team=pick["winner_team"],
            )
            for pick in entry.knockout_picks
        ]

    complete_entry = EntryConfig(
        entry_name=entry.entry_name,
        predictions=predictions,
        advancing_third_place_groups=entry.advancing_third_place_groups,
        knockout_picks=knockout_picks,
    )
    validate_entry_config(tournament, complete_entry)
    return complete_entry


def _build_complete_entry_from_payload(payload: dict[str, Any]) -> EntryConfig:
    """Convert a stateless request payload into a complete scoreable entry config."""
    tournament = load_tournament()
    entry_name = str(payload.get("entry_name") or "").strip()
    if not entry_name:
        raise ServiceError("Entry name cannot be blank.")

    predictions: dict[str, MatchResult] = {}
    for item in payload.get("predictions") or []:
        match_id = str(item.get("match_id") or "")
        home_score = item.get("home_score")
        away_score = item.get("away_score")
        if not isinstance(home_score, int) or not isinstance(away_score, int):
            raise ServiceError("Finish all group-stage match picks before continuing.")
        predictions[match_id] = MatchResult(
            match_id=match_id,
            home_score=home_score,
            away_score=away_score,
        )

    knockout_picks = None
    if payload.get("knockout_picks"):
        knockout_picks = [
            KnockoutPick(
                round_name=pick["round_name"],
                slot_id=pick["slot_id"],
                winner_team=pick["winner_team"],
            )
            for pick in payload["knockout_picks"]
        ]

    complete_entry = EntryConfig(
        entry_name=entry_name,
        predictions=predictions,
        advancing_third_place_groups=payload.get("advancing_third_place_groups"),
        knockout_picks=knockout_picks,
    )
    try:
        validate_entry_config(tournament, complete_entry)
    except ValidationError as error:
        raise ServiceError(str(error)) from error
    return complete_entry


def serialize_manual_third_place_tiebreak(
    error: ThirdPlaceAdvancementTiebreakRequired,
) -> dict[str, Any]:
    """Serialize a manual third-place tiebreak prompt for the frontend."""
    return {
        "code": "manual_third_place_tiebreak_required",
        "message": str(error),
        "locked_group_ids": error.locked_group_ids,
        "candidate_group_ids": error.candidate_group_ids,
        "slots_remaining": error.slots_remaining,
    }


def _finalized_group_ids(truth: TruthConfig) -> set[str]:
    """Return the groups whose six group-stage matches are complete."""
    tournament = load_tournament()
    finalized: set[str] = set()
    for group_id in tournament.groups.keys():
        group_match_ids = {
            match.id
            for match in tournament.matches.values()
            if match.group_id == group_id
        }
        if group_match_ids.issubset(truth.results.keys()):
            finalized.add(group_id)
    return finalized


def _compute_finalized_actual_standings(
    truth: TruthConfig,
    finalized_group_ids: Iterable[str],
) -> dict[str, GroupStanding]:
    """Compute actual standings for fully resolved groups."""
    tournament = load_tournament()
    standings: dict[str, GroupStanding] = {}
    for group_id in sorted(set(finalized_group_ids)):
        group_results = {
            match.id: truth.results[match.id]
            for match in tournament.matches.values()
            if match.group_id == group_id and match.id in truth.results
        }
        standings[group_id] = compute_group_standings(
            tournament=tournament,
            results_by_match_id=group_results,
            group_id=group_id,
            override=truth.group_overrides.get(group_id),
        )
    return standings


def _all_groups_finalized(truth: TruthConfig) -> bool:
    """Return whether every group has all six results recorded."""
    tournament = load_tournament()
    return len(_finalized_group_ids(truth)) == len(tournament.groups)


def _generate_actual_bracket_if_available(truth: TruthConfig) -> tuple[dict[str, GroupStanding], dict[str, list[Any]] | None]:
    """Generate the live actual bracket once the group stage is complete."""
    tournament = load_tournament()
    if not _all_groups_finalized(truth):
        return {}, None

    actual_standings = compute_all_group_standings(
        tournament=tournament,
        results_by_match_id=truth.results,
        group_overrides=truth.group_overrides,
    )
    try:
        actual_bracket = generate_full_knockout_bracket(
            predicted_standings=actual_standings,
            knockout_pick_lookup=truth.knockout_results or {},
            advancing_third_place_groups=truth.advancing_third_place_groups,
        )
    except (ThirdPlaceAdvancementTiebreakRequired, ValueError):
        return actual_standings, None
    return actual_standings, actual_bracket


def _serialize_entry(entry: Entry, viewer_user_id: str, include_sensitive: bool) -> dict[str, Any]:
    """Serialize an entry for either owner-level or metadata-only viewing."""
    visible_score_fields = include_sensitive or entry.owner_id == viewer_user_id or entries_locked()
    return {
        "id": entry.id,
        "owner_id": entry.owner_id,
        "owner_name": entry.owner.username,
        "entry_name": entry.entry_name,
        "created_at": entry.created_at.isoformat(),
        "updated_at": entry.updated_at.isoformat(),
        "status": _entry_status(entry),
        "predictions": entry.predictions if include_sensitive else [],
        "advancing_third_place_groups": (
            entry.advancing_third_place_groups if include_sensitive else None
        ),
        "knockout_picks": entry.knockout_picks if include_sensitive else None,
        "knockout_preview": entry.knockout_preview if include_sensitive else None,
        "result": entry.result_payload if include_sensitive else None,
        "pool_ids": _entry_pool_ids(entry),
        "score_total": entry.score_total if visible_score_fields else None,
        "max_possible_points": entry.max_possible_points if visible_score_fields else None,
        "match_points": entry.match_points if visible_score_fields else None,
        "standing_points": entry.standing_points if visible_score_fields else None,
        "knockout_points": entry.knockout_points if visible_score_fields else None,
        "exact_order_count": entry.exact_order_count if visible_score_fields else None,
        "top_two_bonus_count": entry.top_two_bonus_count if visible_score_fields else None,
        "champion_team": _champion_team(entry) if visible_score_fields and include_sensitive else None,
        "can_edit": entry.owner_id == viewer_user_id and not entries_locked(),
        "can_delete": entry.owner_id == viewer_user_id and not entries_locked(),
        "can_view_picks": include_sensitive,
        "is_locked": entries_locked(),
    }


def create_user(session: Session, username: str, email: str, password: str) -> User:
    """Register a new user account."""
    normalized_username = username.strip()
    normalized_email = email.strip().lower()
    if not normalized_username or not normalized_email or not password.strip():
        raise ServiceError("Fill in username, email, and password.")

    existing_user = session.scalar(
        select(User).where((User.email == normalized_email) | (User.username == normalized_username))
    )
    if existing_user is not None:
        raise ServiceError("That username or email is already registered.", status_code=409)

    user = User(
        id=generate_id("user"),
        username=normalized_username,
        email=normalized_email,
        password_hash=hash_password(password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def authenticate_user(session: Session, email: str, password: str) -> User:
    """Validate login credentials and return the authenticated user."""
    normalized_email = email.strip().lower()
    user = session.scalar(select(User).where(User.email == normalized_email))
    if user is None or not verify_password(password, user.password_hash):
        raise ServiceError("Email or password was incorrect.", status_code=401)
    return user


def get_user_from_token(session: Session, token: str | None) -> User:
    """Resolve the current user from an auth cookie token."""
    if not token:
        raise ServiceError("Not authenticated.", status_code=401)
    try:
        payload = decode_access_token(token)
    except Exception as exc:  # noqa: BLE001
        raise ServiceError("Invalid session.", status_code=401) from exc

    user_id = payload.get("sub")
    user = session.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise ServiceError("Session user was not found.", status_code=401)
    return user


def serialize_auth_session(user: User) -> dict[str, Any]:
    """Serialize the signed-in user plus lock metadata."""
    return {
        "current_user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
        "is_locked": entries_locked(),
        "lock_at": lock_iso(),
    }


def create_entry_for_user(session: Session, user: User, entry_name: str | None = None) -> dict[str, Any]:
    """Create a new draft entry for the current user."""
    existing_count = session.scalar(
        select(func.count()).select_from(Entry).where(Entry.owner_id == user.id)
    )
    name = entry_name.strip() if entry_name else f"Entry {(existing_count or 0) + 1}"
    entry = Entry(
        id=generate_id("entry"),
        owner_id=user.id,
        entry_name=name,
        status="draft",
        predictions=prediction_template(),
    )
    session.add(entry)
    session.commit()
    entry = session.scalar(_entry_query().where(Entry.id == entry.id))
    assert entry is not None
    return _serialize_entry(entry, viewer_user_id=user.id, include_sensitive=True)


def list_entries_for_user(session: Session, user: User) -> list[dict[str, Any]]:
    """List the current user's entries with owner-level visibility."""
    entries = list(session.scalars(_entry_query().where(Entry.owner_id == user.id)).all())
    if entries_locked() or any(entry.score_total is not None for entry in entries):
        entries.sort(key=_entry_sort_key)
    else:
        entries.sort(key=lambda entry: entry.updated_at, reverse=True)
    return [_serialize_entry(entry, viewer_user_id=user.id, include_sensitive=True) for entry in entries]


def get_entry_for_viewer(session: Session, user: User, entry_id: str) -> dict[str, Any]:
    """Load one entry with owner or post-lock shared-pool visibility."""
    entry = session.scalar(_entry_query().where(Entry.id == entry_id))
    if entry is None:
        raise ServiceError("Entry not found.", status_code=404)
    if entry.owner_id == user.id:
        return _serialize_entry(entry, viewer_user_id=user.id, include_sensitive=True)
    if not entries_locked():
        raise ServiceError("You can view other users' picks after entries lock.", status_code=403)
    if not _entry_has_shared_pool(session, user.id, entry_id):
        raise ServiceError("You can only view entries from pools you share.", status_code=403)
    return _serialize_entry(entry, viewer_user_id=user.id, include_sensitive=True)


def update_entry_for_owner(
    session: Session,
    user: User,
    entry_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Update a draft or pre-lock entry owned by the current user."""
    if entries_locked():
        raise ServiceError("Entries are locked and can no longer be edited.", status_code=403)

    entry = _require_entry_owner(session, user.id, entry_id)
    predictions_changed = "predictions" in payload or "advancing_third_place_groups" in payload
    knockout_changed = "knockout_picks" in payload

    if "entry_name" in payload and payload["entry_name"] is not None:
        next_name = str(payload["entry_name"]).strip()
        if not next_name:
            raise ServiceError("Entry name cannot be blank.")
        entry.entry_name = next_name

    if "predictions" in payload:
        entry.predictions = normalize_predictions(payload["predictions"])

    if "advancing_third_place_groups" in payload:
        entry.advancing_third_place_groups = payload["advancing_third_place_groups"]

    if "knockout_picks" in payload:
        entry.knockout_picks = normalize_knockout_picks(payload["knockout_picks"])

    if predictions_changed:
        entry.knockout_preview = None
        entry.knockout_picks = None

    if predictions_changed or knockout_changed:
        entry.result_payload = None
        entry.score_total = None
        entry.max_possible_points = None
        entry.match_points = None
        entry.standing_points = None
        entry.knockout_points = None
        entry.exact_order_count = None
        entry.top_two_bonus_count = None

    entry.status = _entry_status(entry)
    session.commit()
    refreshed = session.scalar(_entry_query().where(Entry.id == entry.id))
    assert refreshed is not None
    return _serialize_entry(refreshed, viewer_user_id=user.id, include_sensitive=True)


def delete_entry_for_owner(session: Session, user: User, entry_id: str) -> None:
    """Delete one of the current user's pre-lock entries."""
    if entries_locked():
        raise ServiceError("Entries are locked and can no longer be deleted.", status_code=403)
    entry = _require_entry_owner(session, user.id, entry_id)
    session.delete(entry)
    session.commit()


def create_pool_for_user(session: Session, user: User, name: str, description: str) -> dict[str, Any]:
    """Create a pool and add the owner as the first member."""
    normalized_name = name.strip()
    normalized_description = description.strip() or "A World Cup bracket pool for invited competitors."
    if not normalized_name:
        raise ServiceError("Give your pool a name.")

    invite_code = create_invite_code(normalized_name)
    while session.scalar(select(Pool).where(Pool.invite_code == invite_code)) is not None:
        invite_code = create_invite_code(normalized_name)

    pool = Pool(
        id=generate_id("pool"),
        owner_id=user.id,
        name=normalized_name,
        description=normalized_description,
        invite_code=invite_code,
    )
    session.add(pool)
    session.flush()
    session.add(PoolMember(id=generate_id("pool-member"), pool_id=pool.id, user_id=user.id))
    session.commit()
    pool = session.scalar(_pool_query().where(Pool.id == pool.id))
    assert pool is not None
    return serialize_pool_summary(pool)


def serialize_pool_summary(pool: Pool) -> dict[str, Any]:
    """Serialize a pool summary for workspace lists."""
    return {
        "id": pool.id,
        "name": pool.name,
        "description": pool.description,
        "invite_code": pool.invite_code,
        "owner_id": pool.owner_id,
        "owner_name": pool.owner.username,
        "member_count": len(pool.members),
        "entry_count": len(pool.entry_links),
        "created_at": pool.created_at.isoformat(),
        "updated_at": pool.updated_at.isoformat(),
    }


def list_pools_for_user(session: Session, user: User) -> list[dict[str, Any]]:
    """List all pools the current user belongs to."""
    pools = list(
        session.scalars(
            _pool_query().where(
                Pool.id.in_(select(PoolMember.pool_id).where(PoolMember.user_id == user.id))
            )
        ).all()
    )
    pools.sort(key=lambda pool: pool.created_at, reverse=True)
    return [serialize_pool_summary(pool) for pool in pools]


def join_pool_by_invite_code(session: Session, user: User, invite_code: str) -> dict[str, Any]:
    """Join a pool via its invite code."""
    pool = session.scalar(_pool_query().where(Pool.invite_code == invite_code.strip().upper()))
    if pool is None:
        raise ServiceError("That invite code did not match a pool.", status_code=404)

    existing_member = session.scalar(
        select(PoolMember).where(PoolMember.pool_id == pool.id, PoolMember.user_id == user.id)
    )
    if existing_member is None:
        session.add(PoolMember(id=generate_id("pool-member"), pool_id=pool.id, user_id=user.id))
        session.commit()
        pool = session.scalar(_pool_query().where(Pool.id == pool.id))
        assert pool is not None

    return serialize_pool_summary(pool)


def add_entry_to_pool(session: Session, user: User, pool_id: str, entry_id: str) -> None:
    """Attach one of the current user's entries to a pool they belong to."""
    pool = _require_pool_member(session, user.id, pool_id)
    entry = _require_entry_owner(session, user.id, entry_id)
    del pool

    existing_link = session.scalar(
        select(PoolEntry).where(PoolEntry.pool_id == pool_id, PoolEntry.entry_id == entry.id)
    )
    if existing_link is not None:
        return

    session.add(PoolEntry(id=generate_id("pool-entry"), pool_id=pool_id, entry_id=entry.id))
    session.commit()


def remove_entry_from_pool(session: Session, user: User, pool_id: str, entry_id: str) -> None:
    """Detach one of the current user's entries from a pool."""
    _require_pool_member(session, user.id, pool_id)
    _require_entry_owner(session, user.id, entry_id)
    link = session.scalar(
        select(PoolEntry).where(PoolEntry.pool_id == pool_id, PoolEntry.entry_id == entry_id)
    )
    if link is None:
        raise ServiceError("That entry is not in the selected pool.", status_code=404)
    session.delete(link)
    session.commit()


def get_pool_detail_for_user(session: Session, user: User, pool_id: str) -> dict[str, Any]:
    """Return the current user's view of a pool and its entries."""
    pool = _require_pool_member(session, user.id, pool_id)
    locked = entries_locked()
    entries = [link.entry for link in pool.entry_links]
    if locked:
        entries.sort(key=_entry_sort_key)
    else:
        entries.sort(key=lambda entry: (entry.owner_id != user.id, entry.entry_name.lower()))

    serialized_entries: list[dict[str, Any]] = []
    for index, entry in enumerate(entries, start=1):
        include_sensitive = locked or entry.owner_id == user.id
        serialized = _serialize_entry(entry, viewer_user_id=user.id, include_sensitive=include_sensitive)
        serialized["rank"] = index if locked else None
        serialized_entries.append(serialized)

    return {
        **serialize_pool_summary(pool),
        "is_locked": locked,
        "entries": serialized_entries,
    }


def generate_knockout_preview_for_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Generate a knockout preview without requiring a persisted entry."""
    if entries_locked():
        raise ServiceError("Entries are locked and can no longer be changed.", status_code=403)

    tournament = load_tournament()
    complete_entry = _build_complete_entry_from_payload(payload)
    predicted_standings = compute_all_group_standings(
        tournament=tournament,
        results_by_match_id=complete_entry.predictions,
        group_overrides={},
    )
    predicted_pick_lookup = picks_to_lookup(complete_entry.knockout_picks)
    predicted_bracket = generate_full_knockout_bracket(
        predicted_standings=predicted_standings,
        knockout_pick_lookup=predicted_pick_lookup,
        advancing_third_place_groups=complete_entry.advancing_third_place_groups,
    )
    validate_knockout_picks(complete_entry, predicted_bracket)

    return {
        "entry_name": complete_entry.entry_name,
        "predicted_standings": _serialize_standings(predicted_standings),
        "predicted_bracket": _serialize_bracket(predicted_bracket),
        "advancing_third_place_groups": complete_entry.advancing_third_place_groups,
    }


def generate_knockout_preview_for_entry(session: Session, user: User, entry_id: str) -> dict[str, Any]:
    """Generate and persist the knockout preview for an owned entry."""
    if entries_locked():
        raise ServiceError("Entries are locked and can no longer be changed.", status_code=403)

    tournament = load_tournament()
    entry = _require_entry_owner(session, user.id, entry_id)
    complete_entry = _build_complete_entry(entry)
    predicted_standings = compute_all_group_standings(
        tournament=tournament,
        results_by_match_id=complete_entry.predictions,
        group_overrides={},
    )
    predicted_pick_lookup = picks_to_lookup(complete_entry.knockout_picks)
    predicted_bracket = generate_full_knockout_bracket(
        predicted_standings=predicted_standings,
        knockout_pick_lookup=predicted_pick_lookup,
        advancing_third_place_groups=complete_entry.advancing_third_place_groups,
    )
    validate_knockout_picks(complete_entry, predicted_bracket)

    payload = {
        "entry_name": complete_entry.entry_name,
        "predicted_standings": _serialize_standings(predicted_standings),
        "predicted_bracket": _serialize_bracket(predicted_bracket),
        "advancing_third_place_groups": complete_entry.advancing_third_place_groups,
    }
    entry.knockout_preview = payload
    entry.result_payload = None
    entry.score_total = None
    entry.max_possible_points = None
    entry.match_points = None
    entry.standing_points = None
    entry.knockout_points = None
    entry.exact_order_count = None
    entry.top_two_bonus_count = None
    entry.status = "knockout"
    session.commit()
    return payload


def score_entry_for_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Score an entry payload without requiring a persisted entry."""
    if entries_locked():
        raise ServiceError("Entries are locked and can no longer be rescored manually.", status_code=403)

    tournament = load_tournament()
    truth = load_truth_snapshot()
    complete_entry = _build_complete_entry_from_payload(payload)
    predicted_standings = compute_all_group_standings(
        tournament=tournament,
        results_by_match_id=complete_entry.predictions,
        group_overrides={},
    )
    actual_standings = compute_all_group_standings(
        tournament=tournament,
        results_by_match_id=truth.results,
        group_overrides=truth.group_overrides,
    )
    scored_entry = score_group_stage_entry(
        tournament=tournament,
        entry=complete_entry,
        truth_results=truth.results,
        predicted_standings=predicted_standings,
        actual_standings=actual_standings,
    )

    predicted_pick_lookup = picks_to_lookup(complete_entry.knockout_picks)
    predicted_bracket = generate_full_knockout_bracket(
        predicted_standings=predicted_standings,
        knockout_pick_lookup=predicted_pick_lookup,
        advancing_third_place_groups=complete_entry.advancing_third_place_groups,
    )
    actual_bracket = generate_full_knockout_bracket(
        predicted_standings=actual_standings,
        knockout_pick_lookup=truth.knockout_results or {},
        advancing_third_place_groups=truth.advancing_third_place_groups,
    )
    validate_knockout_picks(complete_entry, predicted_bracket)
    validate_knockout_winner_lookup(
        winner_lookup=truth.knockout_results or {},
        bracket=actual_bracket,
        label="truth",
    )

    total_knockout_matches = sum(len(matches) for matches in predicted_bracket.values())
    if len(predicted_pick_lookup) != total_knockout_matches:
        raise ServiceError("Pick a winner for every knockout match before scoring the entry.")

    knockout_scores = score_knockout_picks(
        predicted_bracket=predicted_bracket,
        actual_bracket=actual_bracket,
        predicted_pick_lookup=predicted_pick_lookup,
        actual_winner_lookup=truth.knockout_results or {},
    )
    scored_entry = build_scored_entry(
        entry_name=scored_entry.entry_name,
        match_scores=scored_entry.match_scores,
        group_scores=scored_entry.group_scores,
        knockout_scores=knockout_scores,
    )
    return {
        "entry_name": scored_entry.entry_name,
        "match_points": scored_entry.match_points,
        "standing_points": scored_entry.standing_points,
        "knockout_points": scored_entry.knockout_points,
        "total_points": scored_entry.total_points,
        "exact_order_count": scored_entry.exact_order_count,
        "top_two_bonus_count": scored_entry.top_two_bonus_count,
        "group_scores": [asdict(item) for item in scored_entry.group_scores],
        "match_scores": [asdict(item) for item in scored_entry.match_scores],
        "knockout_scores": [asdict(item) for item in scored_entry.knockout_scores],
        "predicted_standings": _serialize_standings(predicted_standings),
        "actual_standings": _serialize_standings(actual_standings),
        "predicted_bracket": _serialize_bracket(predicted_bracket),
        "actual_bracket": _serialize_bracket(actual_bracket),
        "knockout_warning": None,
    }


def score_entry_for_owner(session: Session, user: User, entry_id: str) -> dict[str, Any]:
    """Score an owned entry against the configured truth source."""
    if entries_locked():
        raise ServiceError("Entries are locked and can no longer be rescored manually.", status_code=403)

    tournament = load_tournament()
    truth = load_truth_snapshot()
    entry = _require_entry_owner(session, user.id, entry_id)
    complete_entry = _build_complete_entry(entry)
    predicted_standings = compute_all_group_standings(
        tournament=tournament,
        results_by_match_id=complete_entry.predictions,
        group_overrides={},
    )
    actual_standings = compute_all_group_standings(
        tournament=tournament,
        results_by_match_id=truth.results,
        group_overrides=truth.group_overrides,
    )
    scored_entry = score_group_stage_entry(
        tournament=tournament,
        entry=complete_entry,
        truth_results=truth.results,
        predicted_standings=predicted_standings,
        actual_standings=actual_standings,
    )

    predicted_pick_lookup = picks_to_lookup(complete_entry.knockout_picks)
    predicted_bracket = generate_full_knockout_bracket(
        predicted_standings=predicted_standings,
        knockout_pick_lookup=predicted_pick_lookup,
        advancing_third_place_groups=complete_entry.advancing_third_place_groups,
    )
    actual_bracket = generate_full_knockout_bracket(
        predicted_standings=actual_standings,
        knockout_pick_lookup=truth.knockout_results or {},
        advancing_third_place_groups=truth.advancing_third_place_groups,
    )
    validate_knockout_picks(complete_entry, predicted_bracket)
    validate_knockout_winner_lookup(
        winner_lookup=truth.knockout_results or {},
        bracket=actual_bracket,
        label="truth",
    )

    total_knockout_matches = sum(len(matches) for matches in predicted_bracket.values())
    if len(predicted_pick_lookup) != total_knockout_matches:
        raise ServiceError("Pick a winner for every knockout match before scoring the entry.")

    knockout_scores = score_knockout_picks(
        predicted_bracket=predicted_bracket,
        actual_bracket=actual_bracket,
        predicted_pick_lookup=predicted_pick_lookup,
        actual_winner_lookup=truth.knockout_results or {},
    )
    scored_entry = build_scored_entry(
        entry_name=scored_entry.entry_name,
        match_scores=scored_entry.match_scores,
        group_scores=scored_entry.group_scores,
        knockout_scores=knockout_scores,
    )
    payload = {
        "entry_name": scored_entry.entry_name,
        "match_points": scored_entry.match_points,
        "standing_points": scored_entry.standing_points,
        "knockout_points": scored_entry.knockout_points,
        "total_points": scored_entry.total_points,
        "exact_order_count": scored_entry.exact_order_count,
        "top_two_bonus_count": scored_entry.top_two_bonus_count,
        "group_scores": [asdict(item) for item in scored_entry.group_scores],
        "match_scores": [asdict(item) for item in scored_entry.match_scores],
        "knockout_scores": [asdict(item) for item in scored_entry.knockout_scores],
        "predicted_standings": _serialize_standings(predicted_standings),
        "actual_standings": _serialize_standings(actual_standings),
        "predicted_bracket": _serialize_bracket(predicted_bracket),
        "actual_bracket": _serialize_bracket(actual_bracket),
        "knockout_warning": None,
    }
    entry.knockout_preview = {
        "entry_name": complete_entry.entry_name,
        "predicted_standings": payload["predicted_standings"],
        "predicted_bracket": payload["predicted_bracket"],
        "advancing_third_place_groups": complete_entry.advancing_third_place_groups,
    }
    entry.result_payload = payload
    entry.score_total = scored_entry.total_points
    entry.max_possible_points = max_total_points(tournament)
    entry.match_points = scored_entry.match_points
    entry.standing_points = scored_entry.standing_points
    entry.knockout_points = scored_entry.knockout_points
    entry.exact_order_count = scored_entry.exact_order_count
    entry.top_two_bonus_count = scored_entry.top_two_bonus_count
    entry.status = "scored"
    session.commit()
    return payload


def rescore_entry_against_live_truth(session: Session, entry: Entry) -> None:
    """Update a persisted entry's live score summary and MAX value."""
    tournament = load_tournament()
    truth = load_truth_snapshot()

    try:
        complete_entry = _build_complete_entry(entry)
    except ServiceError:
        entry.score_total = None
        entry.max_possible_points = None
        entry.match_points = None
        entry.standing_points = None
        entry.knockout_points = None
        entry.exact_order_count = None
        entry.top_two_bonus_count = None
        entry.result_payload = None
        entry.status = _entry_status(entry)
        return

    predicted_standings = compute_all_group_standings(
        tournament=tournament,
        results_by_match_id=complete_entry.predictions,
        group_overrides={},
    )
    finalized_group_ids = _finalized_group_ids(truth)
    actual_finalized_standings = _compute_finalized_actual_standings(truth, finalized_group_ids)
    group_scores = score_groups_for_finalized_groups(
        predicted_standings=predicted_standings,
        actual_standings=actual_finalized_standings,
        finalized_group_ids=finalized_group_ids,
    )
    match_scores = score_completed_matches(
        tournament=tournament,
        entry=complete_entry,
        truth_results=truth.results,
    )

    predicted_pick_lookup = picks_to_lookup(complete_entry.knockout_picks)
    predicted_bracket = generate_full_knockout_bracket(
        predicted_standings=predicted_standings,
        knockout_pick_lookup=predicted_pick_lookup,
        advancing_third_place_groups=complete_entry.advancing_third_place_groups,
    )
    actual_standings, actual_bracket = _generate_actual_bracket_if_available(truth)
    knockout_scores = (
        score_partial_knockout_picks(
            predicted_bracket=predicted_bracket,
            actual_bracket=actual_bracket,
            predicted_pick_lookup=predicted_pick_lookup,
            actual_winner_lookup=truth.knockout_results or {},
        )
        if actual_bracket is not None
        else []
    )

    scored_entry = build_scored_entry(
        entry_name=complete_entry.entry_name,
        match_scores=match_scores,
        group_scores=group_scores,
        knockout_scores=knockout_scores,
    )
    max_points = (
        compute_match_points_ceiling(tournament, complete_entry, truth.results)
        + compute_group_points_ceiling(predicted_standings, actual_finalized_standings, finalized_group_ids)
        + compute_knockout_points_ceiling(
            predicted_bracket=predicted_bracket,
            actual_bracket=actual_bracket,
            actual_winner_lookup=truth.knockout_results or {},
            all_groups_finalized=bool(actual_bracket is not None),
            predicted_pick_lookup=predicted_pick_lookup,
        )
    )
    entry.result_payload = {
        "entry_name": scored_entry.entry_name,
        "match_points": scored_entry.match_points,
        "standing_points": scored_entry.standing_points,
        "knockout_points": scored_entry.knockout_points,
        "total_points": scored_entry.total_points,
        "exact_order_count": scored_entry.exact_order_count,
        "top_two_bonus_count": scored_entry.top_two_bonus_count,
        "group_scores": [asdict(item) for item in scored_entry.group_scores],
        "match_scores": [asdict(item) for item in scored_entry.match_scores],
        "knockout_scores": [asdict(item) for item in scored_entry.knockout_scores],
        "predicted_standings": _serialize_standings(predicted_standings),
        "actual_standings": _serialize_standings(actual_standings),
        "predicted_bracket": _serialize_bracket(predicted_bracket),
        "actual_bracket": _serialize_bracket(actual_bracket or {}),
        "knockout_warning": None,
    }
    entry.score_total = scored_entry.total_points
    entry.max_possible_points = max_points
    entry.match_points = scored_entry.match_points
    entry.standing_points = scored_entry.standing_points
    entry.knockout_points = scored_entry.knockout_points
    entry.exact_order_count = scored_entry.exact_order_count
    entry.top_two_bonus_count = scored_entry.top_two_bonus_count
    entry.status = "scored"


def rescore_all_entries(session: Session) -> int:
    """Recompute live scores and MAX values for every persisted entry."""
    entries = list(session.scalars(_entry_query()).all())
    for entry in entries:
        rescore_entry_against_live_truth(session, entry)
    session.commit()
    return len(entries)
