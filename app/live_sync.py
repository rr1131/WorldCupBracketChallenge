"""ESPN-backed live truth sync, cached scoreboard helpers, and mapping tooling."""

from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_session_factory
from .db_models import TruthSyncState
from .loader import (
    apply_espn_mapping_overlay,
    load_espn_mapping_config,
    load_truth_config,
    load_tournament_config,
)
from .models import LiveFixtureState, MatchResult, TournamentConfig, TruthConfig
from .validator import (
    validate_espn_mapping_config,
    validate_tournament_config,
    validate_truth_config,
)

ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
ACTIVE_WINDOW_DAYS = 10
SYNC_STATE_ID = "espn_cached"
TEAM_CODE_ALIASES = {
    "ALG": {"ALG", "ALGERIA", "ALGERIE"},
    "ARG": {"ARG", "ARGENTINA"},
    "AUS": {"AUS", "AUSTRALIA"},
    "AUT": {"AUT", "AUSTRIA"},
    "BEL": {"BEL", "BELGIUM"},
    "BIH": {"BIH", "BOSNIA-HERZEGOVINA", "BOSNIA AND HERZEGOVINA"},
    "BRA": {"BRA", "BRAZIL"},
    "CAN": {"CAN", "CANADA"},
    "CIV": {"CIV", "IVORY COAST", "COTE D'IVOIRE", "COTE DIVOIRE"},
    "COD": {"COD", "CONGO DR", "DR CONGO", "CONGO, DR", "CONGO DEMOCRATIC REPUBLIC"},
    "COL": {"COL", "COLOMBIA"},
    "CPV": {"CPV", "CAPE VERDE"},
    "CUR": {"CUR", "CUW", "CURACAO"},
    "CZE": {"CZE", "CZECHIA", "CZECH REPUBLIC"},
    "ECU": {"ECU", "ECUADOR"},
    "EGY": {"EGY", "EGYPT"},
    "ENG": {"ENG", "ENGLAND"},
    "ESP": {"ESP", "SPAIN"},
    "FRA": {"FRA", "FRANCE"},
    "GER": {"GER", "GERMANY"},
    "GHA": {"GHA", "GHANA"},
    "HAI": {"HAI", "HAITI"},
    "IRQ": {"IRQ", "IRAQ"},
    "IRN": {"IRN", "IRAN"},
    "JOR": {"JOR", "JORDAN"},
    "JPN": {"JPN", "JAPAN"},
    "KOR": {"KOR", "SOUTH KOREA", "KOREA REPUBLIC", "REPUBLIC OF KOREA"},
    "KSA": {"KSA", "SAUDI ARABIA"},
    "MAR": {"MAR", "MOROCCO"},
    "MEX": {"MEX", "MEXICO"},
    "NED": {"NED", "NETHERLANDS", "HOLLAND"},
    "NOR": {"NOR", "NORWAY"},
    "NZL": {"NZL", "NEW ZEALAND"},
    "PAN": {"PAN", "PANAMA"},
    "PAR": {"PAR", "PARAGUAY"},
    "POR": {"POR", "PORTUGAL"},
    "QAT": {"QAT", "QATAR"},
    "RSA": {"RSA", "SOUTH AFRICA"},
    "SCO": {"SCO", "SCOTLAND"},
    "SEN": {"SEN", "SENEGAL"},
    "SUI": {"SUI", "SWITZERLAND"},
    "SWE": {"SWE", "SWEDEN"},
    "TUN": {"TUN", "TUNISIA"},
    "TUR": {"TUR", "TURKIYE", "TÜRKIYE", "TURKEY"},
    "URU": {"URU", "URUGUAY"},
    "USA": {"USA", "UNITED STATES", "USMNT"},
    "UZB": {"UZB", "UZBEKISTAN"},
}
TEAM_ALIAS_TO_CODE = {
    alias: code
    for code, aliases in TEAM_CODE_ALIASES.items()
    for alias in aliases
}
SCORABLE_KNOCKOUT_SLOT_IDS = {
    *(f"M{i}" for i in range(73, 89)),
    *(f"M{i}" for i in range(89, 97)),
    *(f"M{i}" for i in range(97, 101)),
    "M101",
    "M102",
    "M104",
}


def _utcnow() -> datetime:
    """Return the current timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


def _ensure_aware(value: datetime | None) -> datetime | None:
    """Normalize naive datetimes to UTC-aware ones."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _isoformat(value: datetime | None) -> str | None:
    """Serialize a datetime to ISO-8601."""
    normalized = _ensure_aware(value)
    return normalized.isoformat() if normalized is not None else None


@lru_cache(maxsize=1)
def _load_tournament() -> TournamentConfig:
    """Load the tournament structure plus the configured ESPN mapping overlay."""
    settings = get_settings()
    tournament = load_tournament_config(settings.tournament_path)
    validate_tournament_config(tournament)
    mapping = load_espn_mapping_config(settings.espn_mapping_path)
    validate_espn_mapping_config(tournament, mapping)
    return apply_espn_mapping_overlay(tournament, mapping)


def serialize_truth_config(truth: TruthConfig) -> dict[str, Any]:
    """Convert a truth snapshot to a JSON-compatible payload."""
    return {
        "results": [
            {
                "match_id": result.match_id,
                "home_score": result.home_score,
                "away_score": result.away_score,
            }
            for result in sorted(truth.results.values(), key=lambda item: item.match_id)
        ],
        "group_overrides": truth.group_overrides,
        "advancing_third_place_groups": truth.advancing_third_place_groups,
        "knockout_results": truth.knockout_results or {},
    }


def _empty_truth() -> TruthConfig:
    """Return an empty truth snapshot."""
    return TruthConfig(results={}, group_overrides={}, advancing_third_place_groups=None, knockout_results=None)


def load_optional_truth_override(path: Path) -> TruthConfig:
    """Load manual truth overrides when a file is present."""
    if not path.exists():
        return _empty_truth()
    return load_truth_config(path)


def merge_truth_configs(base: TruthConfig, override: TruthConfig) -> TruthConfig:
    """Overlay a manual override snapshot on top of an ESPN-derived truth snapshot."""
    merged_results = dict(base.results)
    merged_results.update(override.results)

    merged_group_overrides = dict(base.group_overrides)
    merged_group_overrides.update(override.group_overrides)

    merged_knockout_results = dict(base.knockout_results or {})
    merged_knockout_results.update(override.knockout_results or {})

    return TruthConfig(
        results=merged_results,
        group_overrides=merged_group_overrides,
        advancing_third_place_groups=(
            override.advancing_third_place_groups
            if override.advancing_third_place_groups is not None
            else base.advancing_third_place_groups
        ),
        knockout_results=merged_knockout_results or None,
    )


def _fixture_metadata(tournament: TournamentConfig) -> list[dict[str, Any]]:
    """Build a uniform metadata list for group and knockout fixtures."""
    fixtures: list[dict[str, Any]] = []
    for match in tournament.matches.values():
        fixtures.append(
            {
                "fixture_id": match.id,
                "kind": "group",
                "group_id": match.group_id,
                "round_name": None,
                "kickoff_at": _ensure_aware(match.kickoff_at),
                "home_team": match.home_team,
                "away_team": match.away_team,
                "espn_event_id": match.espn_event_id,
            }
        )

    for fixture in tournament.knockout_fixtures.values():
        fixtures.append(
            {
                "fixture_id": fixture.slot_id,
                "kind": "knockout",
                "group_id": None,
                "round_name": fixture.round_name,
                "kickoff_at": _ensure_aware(fixture.kickoff_at),
                "home_team": None,
                "away_team": None,
                "espn_event_id": fixture.espn_event_id,
            }
        )
    return fixtures


def _fixture_sort_key(item: dict[str, Any]) -> tuple[Any, ...]:
    """Sort fixtures by kickoff and fixture id."""
    kickoff_at = item["kickoff_at"]
    return (kickoff_at or datetime.max.replace(tzinfo=timezone.utc), item["fixture_id"])


def load_tournament_structure() -> TournamentConfig:
    """Load the structural tournament configuration without ESPN metadata applied."""
    tournament = load_tournament_config(get_settings().tournament_path)
    validate_tournament_config(tournament)
    return tournament


def load_tournament_with_espn_mapping() -> TournamentConfig:
    """Load tournament structure plus the checked-in ESPN mapping overlay."""
    return _load_tournament()


def _mapping_state(item: dict[str, Any]) -> str:
    """Classify a fixture mapping as complete or pending."""
    if item["kickoff_at"] is not None and item["espn_event_id"]:
        return "mapped"
    return "unmapped"


def mapping_report() -> dict[str, list[str]]:
    """Return grouped fixture ids for mapped and unmapped ESPN coverage."""
    fixtures = _fixture_metadata(load_tournament_with_espn_mapping())
    report = {
        "mapped_group_fixtures": [],
        "unmapped_group_fixtures": [],
        "mapped_knockout_fixtures": [],
        "unmapped_knockout_fixtures": [],
    }

    for item in sorted(fixtures, key=_fixture_sort_key):
        key = f"{_mapping_state(item)}_{item['kind']}_fixtures"
        report[key].append(item["fixture_id"])
    return report


def serialize_live_fixture(fixture: LiveFixtureState) -> dict[str, Any]:
    """Convert a normalized live fixture into JSON-compatible data."""
    payload = asdict(fixture)
    payload["kickoff_at"] = _isoformat(fixture.kickoff_at)
    payload["updated_at"] = _isoformat(fixture.updated_at)
    return payload


def _build_fixture_state(
    metadata: dict[str, Any],
    *,
    status: str,
    display_status: str,
    updated_at: datetime | None,
    home_team: str | None = None,
    away_team: str | None = None,
    home_score: int | None = None,
    away_score: int | None = None,
    winner_team: str | None = None,
    sportsbook_name: str | None = None,
    spread_line: str | None = None,
    over_under_line: str | None = None,
) -> LiveFixtureState:
    """Create a normalized live-fixture record from fixture metadata."""
    return LiveFixtureState(
        fixture_id=metadata["fixture_id"],
        kind=metadata["kind"],
        group_id=metadata["group_id"],
        round_name=metadata["round_name"],
        kickoff_at=metadata["kickoff_at"],
        home_team=home_team if home_team is not None else metadata["home_team"],
        away_team=away_team if away_team is not None else metadata["away_team"],
        home_score=home_score,
        away_score=away_score,
        status=status,
        display_status=display_status,
        winner_team=winner_team,
        sportsbook_name=sportsbook_name,
        spread_line=spread_line,
        over_under_line=over_under_line,
        espn_event_id=metadata["espn_event_id"],
        updated_at=updated_at,
    )


def _placeholder_display(metadata: dict[str, Any], now: datetime) -> tuple[str, str]:
    """Describe the best placeholder state for an unsynced fixture."""
    if not metadata["espn_event_id"] or metadata["kickoff_at"] is None:
        return ("unknown", "Awaiting ESPN mapping")
    if metadata["kickoff_at"] > now:
        return ("scheduled", "Scheduled")
    return ("unknown", "Pending ESPN sync")


def _build_placeholder_fixture(metadata: dict[str, Any], now: datetime) -> LiveFixtureState:
    """Build a placeholder fixture when ESPN data is unavailable."""
    status, display_status = _placeholder_display(metadata, now)
    return _build_fixture_state(
        metadata,
        status=status,
        display_status=display_status,
        updated_at=None,
    )


def format_mapping_report(report: dict[str, list[str]]) -> str:
    """Render a human-readable ESPN mapping completeness report."""
    lines = [
        "ESPN mapping validation",
        f"Mapped group fixtures ({len(report['mapped_group_fixtures'])}): "
        + (", ".join(report["mapped_group_fixtures"]) or "none"),
        f"Unmapped group fixtures ({len(report['unmapped_group_fixtures'])}): "
        + (", ".join(report["unmapped_group_fixtures"]) or "none"),
        f"Mapped knockout fixtures ({len(report['mapped_knockout_fixtures'])}): "
        + (", ".join(report["mapped_knockout_fixtures"]) or "none"),
        f"Unmapped knockout fixtures ({len(report['unmapped_knockout_fixtures'])}): "
        + (", ".join(report["unmapped_knockout_fixtures"]) or "none"),
    ]
    return "\n".join(lines)


def _score_to_int(value: Any) -> int | None:
    """Parse an ESPN competitor score into an integer when possible."""
    if value is None:
        return None
    text = str(value).strip()
    if not text or not text.lstrip("-").isdigit():
        return None
    return int(text)


def _odds_line(value: Any) -> str | None:
    """Normalize a sportsbook line value into a displayable string."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _primary_odds(competition: dict[str, Any]) -> dict[str, Any] | None:
    """Return the first available competition odds payload."""
    odds = competition.get("odds") or []
    return odds[0] if odds else None


def _format_spread_display(
    odds: dict[str, Any] | None,
    home_team: str | None,
    away_team: str | None,
) -> str | None:
    """Build a compact spread label like 'MEX -1.5'."""
    if not odds:
        return None

    point_spread = odds.get("pointSpread") or {}
    home_line = _odds_line(((point_spread.get("home") or {}).get("close") or {}).get("line"))
    away_line = _odds_line(((point_spread.get("away") or {}).get("close") or {}).get("line"))

    if home_line and home_line.startswith("-") and home_team:
        return f"{home_team} {home_line}"
    if away_line and away_line.startswith("-") and away_team:
        return f"{away_team} {away_line}"
    if home_line and home_team:
        return f"{home_team} {home_line}"
    if away_line and away_team:
        return f"{away_team} {away_line}"
    return None


def _format_over_under_display(odds: dict[str, Any] | None) -> str | None:
    """Build a compact total label like '2.5'."""
    if not odds:
        return None

    over_under = odds.get("overUnder")
    if over_under is not None:
        return str(over_under)

    total = odds.get("total") or {}
    over_close = ((total.get("over") or {}).get("close") or {}).get("line")
    under_close = ((total.get("under") or {}).get("close") or {}).get("line")

    for raw_line in (over_close, under_close):
        line = _odds_line(raw_line)
        if not line:
            continue
        if line[0].lower() in {"o", "u"}:
            return line[1:]
        return line

    return None


def _normalize_team_token(value: str | None) -> str | None:
    """Normalize a team label into a lookup-friendly token."""
    if value is None:
        return None
    normalized = " ".join(str(value).strip().upper().replace("-", " ").split())
    return normalized or None


def _canonical_team_code(*values: str | None) -> str | None:
    """Resolve ESPN labels and abbreviations onto the app's local team code set."""
    for value in values:
        normalized = _normalize_team_token(value)
        if normalized is None:
            continue
        canonical = TEAM_ALIAS_TO_CODE.get(normalized)
        if canonical is not None:
            return canonical
    return next((value for value in values if value), None)


def _team_code(competitor: dict[str, Any] | None) -> str | None:
    """Extract a canonical local team code from an ESPN competitor payload."""
    if not competitor:
        return None
    team = competitor.get("team") or {}
    return _canonical_team_code(
        team.get("abbreviation"),
        team.get("shortDisplayName"),
        team.get("displayName"),
        team.get("name"),
    )


def _normalize_status(status_type: dict[str, Any]) -> tuple[str, str]:
    """Map ESPN status metadata onto the app's normalized status set."""
    name = str(status_type.get("name") or "")
    description = str(status_type.get("description") or "")
    detail = str(status_type.get("detail") or status_type.get("shortDetail") or "")
    combined = " ".join(part for part in [name, description, detail] if part).lower()
    state = str(status_type.get("state") or "").lower()
    completed = bool(status_type.get("completed"))

    if "postpon" in combined:
        return ("postponed", detail or description or name or "Postponed")
    if "cancel" in combined:
        return ("canceled", detail or description or name or "Canceled")
    if completed or state == "post" or "final" in combined:
        return ("final", detail or description or name or "Final")
    if state == "in" or "live" in combined or "half" in combined:
        return ("in_progress", detail or description or name or "In Progress")
    if state == "pre":
        return ("scheduled", detail or description or name or "Scheduled")
    return ("unknown", detail or description or name or "Unknown")


def _orient_group_competitors(
    metadata: dict[str, Any],
    home_competitor: dict[str, Any],
    away_competitor: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Align ESPN competitor orientation to the configured group fixture."""
    home_team = _team_code(home_competitor)
    away_team = _team_code(away_competitor)
    expected_home = metadata["home_team"]
    expected_away = metadata["away_team"]

    if home_team == expected_home and away_team == expected_away:
        return (home_competitor, away_competitor)
    if home_team == expected_away and away_team == expected_home:
        return (away_competitor, home_competitor)
    return None


def normalize_espn_event(
    metadata: dict[str, Any],
    event: dict[str, Any],
    updated_at: datetime,
) -> LiveFixtureState:
    """Normalize one ESPN scoreboard event into the app's live-fixture shape."""
    competition = (event.get("competitions") or [{}])[0]
    competition_status = competition.get("status") or event.get("status") or {}
    status_type = competition_status.get("type") or {}
    normalized_status, display_status = _normalize_status(status_type)

    competitors = competition.get("competitors") or []
    home_competitor = next(
        (item for item in competitors if item.get("homeAway") == "home"),
        competitors[0] if competitors else {},
    )
    away_competitor = next(
        (item for item in competitors if item.get("homeAway") == "away"),
        competitors[1] if len(competitors) > 1 else {},
    )

    if metadata["kind"] == "group":
        oriented = _orient_group_competitors(metadata, home_competitor, away_competitor)
        if oriented is None:
            return _build_fixture_state(
                metadata,
                status="unknown",
                display_status="Mapped ESPN event teams do not match configured fixture",
                updated_at=updated_at,
            )
        home_competitor, away_competitor = oriented

    home_team = _team_code(home_competitor)
    away_team = _team_code(away_competitor)
    home_score = _score_to_int(home_competitor.get("score"))
    away_score = _score_to_int(away_competitor.get("score"))
    primary_odds = _primary_odds(competition)
    sportsbook_name = ((primary_odds or {}).get("provider") or {}).get("displayName")
    if primary_odds and not sportsbook_name:
        sportsbook_name = "DraftKings"
    spread_line = _format_spread_display(primary_odds, home_team, away_team)
    over_under_line = _format_over_under_display(primary_odds)
    winner_team = None
    if home_competitor.get("winner"):
        winner_team = home_team
    elif away_competitor.get("winner"):
        winner_team = away_team

    return _build_fixture_state(
        metadata,
        status=normalized_status,
        display_status=display_status,
        updated_at=updated_at,
        home_team=home_team,
        away_team=away_team,
        home_score=home_score,
        away_score=away_score,
        winner_team=winner_team,
        sportsbook_name=sportsbook_name,
        spread_line=spread_line,
        over_under_line=over_under_line,
    )


def assemble_truth_from_fixtures(fixtures: list[LiveFixtureState]) -> TruthConfig:
    """Build a scoreable truth snapshot from finalized live fixture results."""
    results: dict[str, MatchResult] = {}
    knockout_results: dict[str, str] = {}

    for fixture in fixtures:
        if fixture.status != "final":
            continue

        if fixture.kind == "group":
            if fixture.home_score is None or fixture.away_score is None:
                continue
            results[fixture.fixture_id] = MatchResult(
                match_id=fixture.fixture_id,
                home_score=fixture.home_score,
                away_score=fixture.away_score,
            )
            continue

        if fixture.fixture_id in SCORABLE_KNOCKOUT_SLOT_IDS and fixture.winner_team:
            knockout_results[fixture.fixture_id] = fixture.winner_team

    return TruthConfig(
        results=results,
        group_overrides={},
        advancing_third_place_groups=None,
        knockout_results=knockout_results or None,
    )


def _truth_hash(payload: dict[str, Any]) -> str:
    """Compute a stable content hash for a truth payload."""
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _get_or_create_sync_state(session: Session) -> TruthSyncState:
    """Load the singleton sync-state row, creating it when absent."""
    state = session.get(TruthSyncState, SYNC_STATE_ID)
    if state is None:
        state = TruthSyncState(id=SYNC_STATE_ID, provider_name="espn_cached")
        session.add(state)
        session.flush()
    return state


def _cached_status_lookup(state: TruthSyncState | None) -> dict[str, str]:
    """Return cached fixture statuses keyed by fixture id."""
    payload = state.scoreboard_payload if state is not None else None
    fixtures = payload.get("fixtures", []) if payload else []
    return {
        fixture["fixture_id"]: fixture.get("status", "unknown")
        for fixture in fixtures
        if fixture.get("fixture_id")
    }


def _select_active_dates(
    fixtures: list[dict[str, Any]],
    cached_status_by_fixture: dict[str, str],
    now: datetime,
) -> list[str]:
    """Pick distinct scoreboard dates worth polling on this cycle."""
    selected_dates: set[str] = set()
    window_start = now - timedelta(days=ACTIVE_WINDOW_DAYS)
    window_end = now + timedelta(days=ACTIVE_WINDOW_DAYS)

    for fixture in fixtures:
        kickoff_at = fixture["kickoff_at"]
        event_id = fixture["espn_event_id"]
        if not event_id or kickoff_at is None:
            continue

        current_status = cached_status_by_fixture.get(fixture["fixture_id"])
        in_window = window_start <= kickoff_at <= window_end
        unresolved = current_status != "final"
        if in_window or unresolved:
            selected_dates.add(kickoff_at.astimezone(timezone.utc).strftime("%Y%m%d"))

    return sorted(selected_dates)


def _default_fetch_json(url: str) -> dict[str, Any]:
    """Fetch a JSON document from the network."""
    with urlopen(url, timeout=15) as response:  # noqa: S310
        return json.load(response)


class EspnSyncService:
    """Fetch ESPN scoreboard data, normalize it, and cache live truth locally."""

    def __init__(self, fetch_json: Callable[[str], dict[str, Any]] | None = None) -> None:
        """Store the JSON fetcher dependency for easy testing."""
        self._fetch_json = fetch_json or _default_fetch_json

    def _fetch_events_for_date(self, day: str) -> list[dict[str, Any]]:
        """Fetch ESPN scoreboard events for one tournament date."""
        url = f"{ESPN_SCOREBOARD_URL}?{urlencode({'dates': day})}"
        try:
            payload = self._fetch_json(url)
        except (HTTPError, URLError, TimeoutError) as error:
            raise RuntimeError(f"Failed to fetch ESPN scoreboard for {day}: {error}") from error
        return list(payload.get("events") or [])

    def sync_once(self, session: Session) -> dict[str, Any]:
        """Run one ESPN sync cycle and persist the resulting snapshot."""
        settings = get_settings()
        tournament = _load_tournament()
        attempt_at = _utcnow()
        state = _get_or_create_sync_state(session)
        previous_hash = state.truth_hash
        cached_status_by_fixture = _cached_status_lookup(state)
        fixtures = sorted(_fixture_metadata(tournament), key=_fixture_sort_key)
        selected_dates = _select_active_dates(fixtures, cached_status_by_fixture, attempt_at)

        try:
            normalized_fixtures: list[LiveFixtureState] = []
            event_lookup: dict[str, dict[str, Any]] = {}

            for day in selected_dates:
                for event in self._fetch_events_for_date(day):
                    event_id = str(event.get("id") or "").strip()
                    if event_id:
                        event_lookup[event_id] = event

            for metadata in fixtures:
                event_id = metadata["espn_event_id"]
                if event_id and event_id in event_lookup:
                    normalized_fixtures.append(normalize_espn_event(metadata, event_lookup[event_id], attempt_at))
                else:
                    normalized_fixtures.append(_build_placeholder_fixture(metadata, attempt_at))

            sync_status = "success" if selected_dates else "mapping_pending"
            if not selected_dates and state.scoreboard_payload:
                sync_status = "mapping_pending"

            espn_truth = assemble_truth_from_fixtures(normalized_fixtures)
            merged_truth = merge_truth_configs(
                espn_truth,
                load_optional_truth_override(settings.truth_override_path),
            )
            validate_truth_config(tournament, merged_truth)

            serialized_truth = serialize_truth_config(merged_truth)
            serialized_fixtures = [serialize_live_fixture(fixture) for fixture in normalized_fixtures]
            next_hash = _truth_hash(serialized_truth)

            state.provider_name = "espn_cached"
            state.truth_payload = serialized_truth
            state.scoreboard_payload = {"fixtures": serialized_fixtures}
            state.truth_hash = next_hash
            state.sync_status = sync_status
            state.last_attempt_at = attempt_at
            state.last_success_at = attempt_at
            state.last_error = None
            session.commit()
            return {
                "provider": "espn_cached",
                "sync_status": sync_status,
                "changed": next_hash != previous_hash,
                "synced_at": _isoformat(attempt_at),
            }
        except Exception as error:  # noqa: BLE001
            session.rollback()
            state = _get_or_create_sync_state(session)
            state.provider_name = "espn_cached"
            state.sync_status = "error"
            state.last_attempt_at = attempt_at
            state.last_error = str(error)
            session.commit()
            return {
                "provider": "espn_cached",
                "sync_status": "error",
                "changed": False,
                "synced_at": _isoformat(state.last_success_at),
                "error": str(error),
            }


def _stale(last_success_at: datetime | None) -> bool:
    """Report whether the last successful sync is older than the configured threshold."""
    if last_success_at is None:
        return True
    max_age = timedelta(seconds=get_settings().espn_sync_stale_after_seconds)
    return _utcnow() - _ensure_aware(last_success_at) > max_age


def _build_placeholder_scoreboard(
    tournament: TournamentConfig,
    *,
    provider: str,
    sync_status: str,
    synced_at: datetime | None,
) -> dict[str, Any]:
    """Build a fallback scoreboard response from tournament metadata only."""
    fixtures = sorted(_fixture_metadata(tournament), key=_fixture_sort_key)
    serialized_fixtures = [
        serialize_live_fixture(_build_placeholder_fixture(metadata, _utcnow()))
        for metadata in fixtures
    ]
    return {
        "provider": provider,
        "sync_status": sync_status,
        "synced_at": _isoformat(synced_at),
        "stale": _stale(synced_at),
        "fixtures": serialized_fixtures,
    }


def build_file_truth_scoreboard() -> dict[str, Any]:
    """Build a manual/file-provider scoreboard response."""
    tournament = _load_tournament()
    truth = load_truth_config(get_settings().truth_path)
    validate_truth_config(tournament, truth)
    fixtures: list[dict[str, Any]] = []
    now = _utcnow()

    for metadata in sorted(_fixture_metadata(tournament), key=_fixture_sort_key):
        kickoff_at = metadata["kickoff_at"]
        kickoff_has_passed = kickoff_at is not None and kickoff_at <= now

        if metadata["kind"] == "group":
            result = truth.results.get(metadata["fixture_id"])
            show_result = result is not None and kickoff_has_passed
            fixtures.append(
                serialize_live_fixture(
                    _build_fixture_state(
                        metadata,
                        status="final" if show_result else "scheduled",
                        display_status="Final" if show_result else "Manual truth source",
                        updated_at=None,
                        home_score=result.home_score if show_result else None,
                        away_score=result.away_score if show_result else None,
                    )
                )
            )
            continue

        winner_team = (truth.knockout_results or {}).get(metadata["fixture_id"])
        show_winner = winner_team is not None and kickoff_has_passed
        fixtures.append(
            serialize_live_fixture(
                _build_fixture_state(
                    metadata,
                    status="final" if show_winner else "scheduled",
                    display_status="Final" if show_winner else "Manual truth source",
                    updated_at=None,
                    winner_team=winner_team if show_winner else None,
                )
            )
        )

    return {
        "provider": "file",
        "sync_status": "manual",
        "synced_at": None,
        "stale": False,
        "fixtures": fixtures,
    }


def load_live_scoreboard_snapshot() -> dict[str, Any]:
    """Return the best live-scoreboard payload available for the current provider."""
    settings = get_settings()
    if settings.truth_provider == "file":
        return build_file_truth_scoreboard()

    tournament = _load_tournament()
    session = get_session_factory()()
    try:
        state = session.get(TruthSyncState, SYNC_STATE_ID)
        if state is None or not state.scoreboard_payload:
            return _build_placeholder_scoreboard(
                tournament,
                provider="espn_cached",
                sync_status=state.sync_status if state is not None else "never_synced",
                synced_at=state.last_success_at if state is not None else None,
            )

        return {
            "provider": state.provider_name,
            "sync_status": state.sync_status,
            "synced_at": _isoformat(state.last_success_at),
            "stale": _stale(state.last_success_at),
            "fixtures": list(state.scoreboard_payload.get("fixtures", [])),
        }
    finally:
        session.close()


def sync_truth_once_and_maybe_rescore(
    service: EspnSyncService | None = None,
) -> dict[str, Any]:
    """Run one sync cycle and rescore persisted entries only when truth changes."""
    sync_service = service or EspnSyncService()
    session = get_session_factory()()
    try:
        result = sync_service.sync_once(session)
        if result.get("changed"):
            from .service import rescore_all_entries

            rescored = rescore_all_entries(session)
            result["rescored_entries"] = rescored
        else:
            result["rescored_entries"] = 0
        return result
    finally:
        session.close()


class EspnSyncPoller:
    """Single-process background poller for ESPN live truth syncing."""

    def __init__(self) -> None:
        """Prepare the polling thread and stop signal."""
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._run, name="espn-sync-poller", daemon=True)

    def start(self) -> None:
        """Start the background sync thread once."""
        if not self._thread.is_alive():
            self._thread.start()

    def stop(self) -> None:
        """Request poller shutdown and wait briefly for the thread to exit."""
        self._stop_event.set()
        self._thread.join(timeout=2)

    def _run(self) -> None:
        """Poll ESPN at the configured interval until asked to stop."""
        interval_seconds = max(5, get_settings().espn_poll_interval_seconds)
        while not self._stop_event.is_set():
            sync_truth_once_and_maybe_rescore()
            self._stop_event.wait(interval_seconds)


def start_espn_sync_poller() -> EspnSyncPoller:
    """Start and return the singleton-like ESPN sync poller."""
    poller = EspnSyncPoller()
    poller.start()
    return poller
