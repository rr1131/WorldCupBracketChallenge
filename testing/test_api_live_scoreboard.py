from __future__ import annotations

import importlib
import importlib.metadata
import json
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.config import get_settings
from app.database import create_database, get_engine, get_session_factory
from app.db_models import TruthSyncState
from app.live_sync import _load_tournament
from app.service import load_tournament


def clear_runtime_caches() -> None:
    try:
        get_engine().dispose()
    except Exception:  # noqa: BLE001
        pass
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    load_tournament.cache_clear()
    _load_tournament.cache_clear()


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def test_live_scoreboard_endpoint_reports_stale_cache(monkeypatch, tmp_path: Path) -> None:
    now = datetime.now(timezone.utc)
    tournament_path = tmp_path / "tournament.json"
    mapping_path = tmp_path / "espn_mapping.json"
    truth_path = tmp_path / "truth.json"
    override_path = tmp_path / "override.json"

    write_json(
        tournament_path,
        {
            "groups": [{"id": "A", "teams": ["AAA", "BBB", "CCC", "DDD"]}],
            "matches": [
                {
                    "id": "A1",
                    "group_id": "A",
                    "home_team": "AAA",
                    "away_team": "BBB",
                }
            ],
            "knockout_fixtures": [],
        },
    )
    write_json(
        mapping_path,
        {
            "fixtures": [
                {
                    "fixture_id": "A1",
                    "kickoff_at": now.isoformat().replace("+00:00", "Z"),
                    "espn_event_id": "1001",
                }
            ]
        },
    )
    write_json(truth_path, {"results": [], "group_overrides": {}, "knockout_results": {}})
    write_json(override_path, {"results": [], "group_overrides": {}, "knockout_results": {}})

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'api.db'}")
    monkeypatch.setenv("TOURNAMENT_PATH", str(tournament_path))
    monkeypatch.setenv("ESPN_MAPPING_PATH", str(mapping_path))
    monkeypatch.setenv("TRUTH_PATH", str(truth_path))
    monkeypatch.setenv("TRUTH_OVERRIDE_PATH", str(override_path))
    monkeypatch.setenv("TRUTH_PROVIDER", "espn_cached")
    monkeypatch.setenv("ESPN_SYNC_ENABLED", "false")
    monkeypatch.setenv("ESPN_SYNC_STALE_AFTER_SECONDS", "1")
    clear_runtime_caches()
    create_database()

    session = get_session_factory()()
    try:
        state = TruthSyncState(
            id="espn_cached",
            provider_name="espn_cached",
            truth_payload={"results": [], "group_overrides": {}, "knockout_results": {}},
            scoreboard_payload={
                "fixtures": [
                    {
                        "fixture_id": "A1",
                        "kind": "group",
                        "group_id": "A",
                        "round_name": None,
                        "kickoff_at": now.isoformat(),
                        "home_team": "AAA",
                        "away_team": "BBB",
                        "home_score": 1,
                        "away_score": 0,
                        "status": "final",
                        "display_status": "Final",
                        "winner_team": "AAA",
                        "espn_event_id": "1001",
                        "updated_at": now.isoformat(),
                    }
                ]
            },
            truth_hash="abc123",
            sync_status="success",
            last_attempt_at=now - timedelta(minutes=10),
            last_success_at=now - timedelta(minutes=10),
            last_error=None,
        )
        session.merge(state)
        session.commit()
    finally:
        session.close()

    fake_email_validator = types.ModuleType("email_validator")
    fake_email_validator.EmailNotValidError = ValueError
    fake_email_validator.validate_email = lambda value, **kwargs: types.SimpleNamespace(email=value)
    monkeypatch.setitem(sys.modules, "email_validator", fake_email_validator)
    original_version = importlib.metadata.version
    monkeypatch.setattr(
        importlib.metadata,
        "version",
        lambda name: "2.0.0" if name == "email-validator" else original_version(name),
    )

    import api as api_module

    api_module = importlib.reload(api_module)
    payload = api_module.live_scoreboard()
    assert payload["provider"] == "espn_cached"
    assert payload["sync_status"] == "success"
    assert payload["stale"] is True
    assert payload["fixtures"][0]["fixture_id"] == "A1"
