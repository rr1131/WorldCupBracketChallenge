"""FastAPI application exposing auth, entry, pool, and scoring routes."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import create_database, get_db
from app.live_sync import load_live_scoreboard_snapshot, start_espn_sync_poller
from app.schemas import (
    AuthSessionOut,
    CreatePoolIn,
    EntryCreateIn,
    EntryOut,
    EntrySimulationIn,
    LiveScoreboardOut,
    EntryUpdateIn,
    JoinPoolIn,
    LoginIn,
    PoolDetailOut,
    PoolSummaryOut,
    RegisterIn,
)
from app.security import create_access_token
from app.service import (
    ServiceError,
    add_entry_to_pool,
    authenticate_user,
    create_entry_for_user,
    create_pool_for_user_with_password,
    create_user,
    delete_pool_for_owner,
    delete_entry_for_owner,
    entries_locked,
    generate_knockout_preview_for_entry,
    generate_knockout_preview_for_payload,
    get_entry_for_viewer,
    get_pool_by_invite_code,
    get_pool_detail_for_user,
    get_user_from_token,
    join_pool_by_invite_code,
    list_entries_for_user,
    list_pools_for_user,
    remove_entry_from_pool,
    score_entry_for_owner,
    score_entry_for_payload,
    serialize_manual_third_place_tiebreak,
    serialize_auth_session,
    update_entry_for_owner,
)
from app.knockout import ThirdPlaceAdvancementTiebreakRequired


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN201
    """Initialize local persistence and start the optional ESPN poller."""
    del app
    create_database()
    sync_poller = None
    if settings.truth_provider == "espn_cached" and settings.espn_sync_enabled:
        sync_poller = start_espn_sync_poller()
    try:
        yield
    finally:
        if sync_poller is not None:
            sync_poller.stop()


app = FastAPI(title="World Cup Bracket Challenge API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _set_session_cookie(response: Response, user_id: str) -> None:
    """Set the auth cookie for a signed-in user."""
    response.set_cookie(
        key=settings.session_cookie_name,
        value=create_access_token(user_id),
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        max_age=settings.session_duration_hours * 60 * 60,
    )


def _clear_session_cookie(response: Response) -> None:
    """Clear the auth cookie."""
    response.delete_cookie(settings.session_cookie_name)


def get_current_user(
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> Any:
    """Resolve the authenticated user from the session cookie."""
    try:
        return get_user_from_token(db, session_token)
    except ServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


def _raise_service_error(error: ServiceError) -> None:
    """Re-raise a service-layer error as an HTTP exception."""
    raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@app.post("/api/generate-knockout-bracket")
def generate_knockout_bracket(payload: EntrySimulationIn) -> dict[str, Any]:
    """Compatibility endpoint for the stateless web prototype builder."""
    try:
        return generate_knockout_preview_for_payload(payload.model_dump())
    except ThirdPlaceAdvancementTiebreakRequired as error:
        raise HTTPException(
            status_code=400,
            detail=serialize_manual_third_place_tiebreak(error),
        ) from error
    except ServiceError as error:
        _raise_service_error(error)


@app.post("/api/score-entry")
def score_entry_payload(payload: EntrySimulationIn) -> dict[str, Any]:
    """Compatibility scoring endpoint for the stateless web prototype builder."""
    try:
        return score_entry_for_payload(payload.model_dump())
    except ThirdPlaceAdvancementTiebreakRequired as error:
        raise HTTPException(
            status_code=400,
            detail=serialize_manual_third_place_tiebreak(error),
        ) from error
    except ServiceError as error:
        _raise_service_error(error)


@app.get("/api/live/scoreboard", response_model=LiveScoreboardOut)
def live_scoreboard() -> dict[str, Any]:
    """Return the latest cached live scoreboard snapshot for the browser."""
    return load_live_scoreboard_snapshot()


@app.get("/api/healthz")
def healthcheck() -> dict[str, str]:
    """Return a simple healthcheck payload for hosting platforms."""
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=AuthSessionOut)
def register(
    payload: RegisterIn,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Register a new user and sign them in."""
    try:
        user = create_user(db, payload.username, payload.email, payload.password)
    except ServiceError as error:
        _raise_service_error(error)
    _set_session_cookie(response, user.id)
    return serialize_auth_session(user)


@app.post("/api/auth/login", response_model=AuthSessionOut)
def login(
    payload: LoginIn,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Sign an existing user in."""
    try:
        user = authenticate_user(db, payload.email, payload.password)
    except ServiceError as error:
        _raise_service_error(error)
    _set_session_cookie(response, user.id)
    return serialize_auth_session(user)


@app.post("/api/auth/logout")
def logout(response: Response) -> dict[str, bool]:
    """Log the current user out."""
    _clear_session_cookie(response)
    return {"ok": True}


@app.get("/api/auth/me", response_model=AuthSessionOut)
def me(user: Any = Depends(get_current_user)) -> dict[str, Any]:
    """Return the signed-in user and lock metadata."""
    return serialize_auth_session(user)


@app.get("/api/entries", response_model=list[EntryOut])
def list_entries(
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List the current user's entries."""
    return list_entries_for_user(db, user)


@app.post("/api/entries", response_model=EntryOut)
def create_entry(
    payload: EntryCreateIn,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Create a new entry for the current user."""
    try:
        return create_entry_for_user(db, user, payload.entry_name)
    except ServiceError as error:
        _raise_service_error(error)


@app.get("/api/entries/{entry_id}", response_model=EntryOut)
def get_entry(
    entry_id: str,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Load one entry visible to the current user."""
    try:
        return get_entry_for_viewer(db, user, entry_id)
    except ServiceError as error:
        _raise_service_error(error)


@app.patch("/api/entries/{entry_id}", response_model=EntryOut)
def update_entry(
    entry_id: str,
    payload: EntryUpdateIn,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update an owned pre-lock entry."""
    try:
        return update_entry_for_owner(db, user, entry_id, payload.model_dump(exclude_unset=True))
    except ServiceError as error:
        _raise_service_error(error)


@app.delete("/api/entries/{entry_id}")
def delete_entry(
    entry_id: str,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """Delete an owned pre-lock entry."""
    try:
        delete_entry_for_owner(db, user, entry_id)
    except ServiceError as error:
        _raise_service_error(error)
    return {"ok": True}


@app.post("/api/entries/{entry_id}/knockout-preview")
def knockout_preview(
    entry_id: str,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Generate and persist the knockout preview for an entry."""
    try:
        return generate_knockout_preview_for_entry(db, user, entry_id)
    except ServiceError as error:
        _raise_service_error(error)


@app.post("/api/entries/{entry_id}/score")
def score_entry(
    entry_id: str,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Score an owned entry against the configured truth source."""
    try:
        return score_entry_for_owner(db, user, entry_id)
    except ServiceError as error:
        _raise_service_error(error)


@app.get("/api/pools", response_model=list[PoolSummaryOut])
def list_pools(
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List the pools the current user belongs to."""
    return list_pools_for_user(db, user)


@app.post("/api/pools", response_model=PoolSummaryOut)
def create_pool(
    payload: CreatePoolIn,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Create a new pool."""
    try:
        return create_pool_for_user_with_password(
            db,
            user,
            payload.name,
            payload.description,
            payload.join_password,
        )
    except ServiceError as error:
        _raise_service_error(error)


@app.get("/api/pools/invite/{invite_code}", response_model=PoolSummaryOut)
def get_pool_by_invite(
    invite_code: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return public metadata for a pool invite."""
    try:
        return get_pool_by_invite_code(db, invite_code)
    except ServiceError as error:
        _raise_service_error(error)


@app.get("/api/pools/{pool_id}", response_model=PoolDetailOut)
def get_pool(
    pool_id: str,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return one pool detail payload."""
    try:
        return get_pool_detail_for_user(db, user, pool_id)
    except ServiceError as error:
        _raise_service_error(error)


@app.post("/api/pools/join/{invite_code}", response_model=PoolSummaryOut)
def join_pool(
    invite_code: str,
    payload: JoinPoolIn | None = None,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Join a pool by invite code."""
    try:
        return join_pool_by_invite_code(db, user, invite_code, payload.password if payload else None)
    except ServiceError as error:
        _raise_service_error(error)


@app.delete("/api/pools/{pool_id}")
def delete_pool(
    pool_id: str,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """Delete a pool owned by the current user."""
    try:
        delete_pool_for_owner(db, user, pool_id)
    except ServiceError as error:
        _raise_service_error(error)
    return {"ok": True}


@app.post("/api/pools/{pool_id}/entries/{entry_id}")
def attach_entry(
    pool_id: str,
    entry_id: str,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """Attach an owned entry to a pool."""
    try:
        add_entry_to_pool(db, user, pool_id, entry_id)
    except ServiceError as error:
        _raise_service_error(error)
    return {"ok": True}


@app.delete("/api/pools/{pool_id}/entries/{entry_id}")
def detach_entry(
    pool_id: str,
    entry_id: str,
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    """Detach an owned entry from a pool."""
    try:
        remove_entry_from_pool(db, user, pool_id, entry_id)
    except ServiceError as error:
        _raise_service_error(error)
    return {"ok": True}
