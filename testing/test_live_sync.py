from __future__ import annotations
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app import main as app_main
from app import service as service_module
from app.config import get_settings
from app.database import create_database, get_engine, get_session_factory
from app.live_sync import (
    EspnSyncService,
    _load_tournament,
    assemble_truth_from_fixtures,
    format_mapping_report,
    load_live_scoreboard_snapshot,
    load_tournament_structure,
    load_tournament_with_espn_mapping,
    mapping_report,
    merge_truth_configs,
    normalize_espn_event,
    sync_truth_once_and_maybe_rescore,
)
from app.models import LiveFixtureState, MatchResult, TruthConfig
from app.truth import get_truth_provider


def clear_runtime_caches() -> None:
    try:
        get_engine().dispose()
    except Exception:  # noqa: BLE001
        pass
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    service_module.load_tournament.cache_clear()
    _load_tournament.cache_clear()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def build_tournament_payload(now: datetime) -> dict[str, Any]:
    return {
        "groups": [{"id": "A", "teams": ["AAA", "BBB", "CCC", "DDD"]}],
        "matches": [
            {
                "id": "A1",
                "group_id": "A",
                "home_team": "AAA",
                "away_team": "BBB",
            }
        ],
        "knockout_fixtures": [
            {
                "slot_id": "M73",
                "round_name": "R32",
            },
            {
                "slot_id": "M103",
                "round_name": "THIRD_PLACE",
            },
        ],
    }


def build_mapping_payload(now: datetime) -> dict[str, Any]:
    kickoff = (now + timedelta(days=1)).isoformat().replace("+00:00", "Z")
    knockout_kickoff = (now + timedelta(days=2)).isoformat().replace("+00:00", "Z")
    return {
        "fixtures": [
            {
                "fixture_id": "A1",
                "kickoff_at": kickoff,
                "espn_event_id": "1001",
            },
            {
                "fixture_id": "M73",
                "kickoff_at": knockout_kickoff,
                "espn_event_id": "2001",
            },
            {
                "fixture_id": "M103",
                "kickoff_at": None,
                "espn_event_id": None,
            },
        ]
    }


def build_empty_truth_payload() -> dict[str, Any]:
    return {
        "results": [],
        "group_overrides": {},
        "knockout_results": {},
    }


def build_fallback_truth_payload() -> dict[str, Any]:
    return {
        "results": [{"match_id": "A1", "home_score": 9, "away_score": 0}],
        "group_overrides": {},
        "knockout_results": {"M73": "AAA"},
    }


def build_group_event(*, state: str, completed: bool, detail: str, home_score: str, away_score: str) -> dict[str, Any]:
    return {
        "id": "1001",
        "competitions": [
            {
                "competitors": [
                    {
                        "homeAway": "home",
                        "team": {"abbreviation": "AAA"},
                        "score": home_score,
                        "winner": int(home_score) > int(away_score),
                    },
                    {
                        "homeAway": "away",
                        "team": {"abbreviation": "BBB"},
                        "score": away_score,
                        "winner": int(away_score) > int(home_score),
                    },
                ],
                "status": {
                    "type": {
                        "state": state,
                        "completed": completed,
                        "detail": detail,
                        "description": detail,
                    }
                },
            }
        ],
    }


def build_knockout_event(
    *,
    home_team: str = "AAA",
    away_team: str = "CCC",
    home_score: str = "1",
    away_score: str = "1",
    home_winner: bool = False,
    away_winner: bool = True,
    detail: str = "Final/PK",
) -> dict[str, Any]:
    return {
        "id": "2001",
        "competitions": [
            {
                "competitors": [
                    {
                        "homeAway": "home",
                        "team": {"abbreviation": home_team},
                        "score": home_score,
                        "winner": home_winner,
                    },
                    {
                        "homeAway": "away",
                        "team": {"abbreviation": away_team},
                        "score": away_score,
                        "winner": away_winner,
                    },
                ],
                "status": {
                    "type": {
                        "state": "post",
                        "completed": True,
                        "detail": detail,
                        "description": "Final",
                    }
                },
            }
        ],
    }


def configure_runtime(monkeypatch, tmp_path: Path) -> tuple[Path, Path, Path, Path]:
    now = datetime.now(timezone.utc)
    tournament_path = tmp_path / "tournament.json"
    mapping_path = tmp_path / "espn_mapping.json"
    truth_path = tmp_path / "fallback_truth.json"
    override_path = tmp_path / "override.json"

    write_json(tournament_path, build_tournament_payload(now))
    write_json(mapping_path, build_mapping_payload(now))
    write_json(truth_path, build_fallback_truth_payload())
    write_json(override_path, build_empty_truth_payload())

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("TOURNAMENT_PATH", str(tournament_path))
    monkeypatch.setenv("ESPN_MAPPING_PATH", str(mapping_path))
    monkeypatch.setenv("TRUTH_PATH", str(truth_path))
    monkeypatch.setenv("TRUTH_OVERRIDE_PATH", str(override_path))
    monkeypatch.setenv("TRUTH_PROVIDER", "espn_cached")
    monkeypatch.setenv("ESPN_SYNC_ENABLED", "false")
    monkeypatch.setenv("ESPN_SYNC_STALE_AFTER_SECONDS", "1")
    clear_runtime_caches()
    create_database()
    return tournament_path, mapping_path, truth_path, override_path


def session_factory() -> Session:
    return get_session_factory()()


def test_normalize_espn_event_group_states() -> None:
    metadata = {
        "fixture_id": "A1",
        "kind": "group",
        "group_id": "A",
        "round_name": None,
        "kickoff_at": datetime.now(timezone.utc),
        "home_team": "AAA",
        "away_team": "BBB",
        "espn_event_id": "1001",
    }
    updated_at = datetime.now(timezone.utc)

    scheduled = normalize_espn_event(
        metadata,
        build_group_event(state="pre", completed=False, detail="Scheduled", home_score="0", away_score="0"),
        updated_at,
    )
    assert scheduled.status == "scheduled"

    in_progress = normalize_espn_event(
        metadata,
        build_group_event(state="in", completed=False, detail="45'", home_score="1", away_score="0"),
        updated_at,
    )
    assert in_progress.status == "in_progress"
    assert in_progress.home_score == 1

    final_reversed = normalize_espn_event(
        metadata,
        {
            "id": "1001",
            "competitions": [
                {
                    "competitors": [
                        {
                            "homeAway": "home",
                            "team": {"abbreviation": "BBB"},
                            "score": "2",
                            "winner": True,
                        },
                        {
                            "homeAway": "away",
                            "team": {"abbreviation": "AAA"},
                            "score": "0",
                            "winner": False,
                        },
                    ],
                    "status": {
                        "type": {
                            "state": "post",
                            "completed": True,
                            "detail": "Final",
                            "description": "Final",
                        }
                    },
                }
            ],
        },
        updated_at,
    )
    assert final_reversed.status == "final"
    assert final_reversed.home_team == "AAA"
    assert final_reversed.away_team == "BBB"
    assert final_reversed.home_score == 0
    assert final_reversed.away_score == 2
    assert final_reversed.winner_team == "BBB"


def test_tournament_mapping_overlay_and_report(monkeypatch, tmp_path: Path) -> None:
    configure_runtime(monkeypatch, tmp_path)

    structural = load_tournament_structure()
    assert structural.matches["A1"].kickoff_at is None
    assert structural.matches["A1"].espn_event_id is None

    overlaid = load_tournament_with_espn_mapping()
    assert overlaid.matches["A1"].espn_event_id == "1001"
    assert overlaid.knockout_fixtures["M73"].espn_event_id == "2001"
    assert overlaid.knockout_fixtures["M103"].espn_event_id is None

    report = mapping_report()
    assert report["mapped_group_fixtures"] == ["A1"]
    assert "M73" in report["mapped_knockout_fixtures"]
    assert "M103" in report["unmapped_knockout_fixtures"]
    assert "Unmapped knockout fixtures" in format_mapping_report(report)


def test_normalize_espn_event_knockout_and_edge_states() -> None:
    metadata = {
        "fixture_id": "M73",
        "kind": "knockout",
        "group_id": None,
        "round_name": "R32",
        "kickoff_at": datetime.now(timezone.utc),
        "home_team": None,
        "away_team": None,
        "espn_event_id": "2001",
    }
    updated_at = datetime.now(timezone.utc)

    final_penalties = normalize_espn_event(metadata, build_knockout_event(), updated_at)
    assert final_penalties.status == "final"
    assert final_penalties.winner_team == "CCC"

    postponed_event = build_knockout_event(detail="Postponed")
    postponed_event["competitions"][0]["status"]["type"]["state"] = "pre"
    postponed_event["competitions"][0]["status"]["type"]["completed"] = False
    postponed = normalize_espn_event(metadata, postponed_event, updated_at)
    assert postponed.status == "postponed"

    unknown_event = {
        "id": "2001",
        "competitions": [
            {
                "competitors": [],
                "status": {"type": {"state": "", "completed": False, "detail": ""}},
            }
        ],
    }
    unknown = normalize_espn_event(metadata, unknown_event, updated_at)
    assert unknown.status == "unknown"

    mismatched_group = normalize_espn_event(
        {
            **metadata,
            "fixture_id": "A1",
            "kind": "group",
            "group_id": "A",
            "home_team": "AAA",
            "away_team": "BBB",
        },
        build_knockout_event(home_team="ZZZ", away_team="YYY"),
        updated_at,
    )
    assert mismatched_group.status == "unknown"
    assert "do not match" in mismatched_group.display_status


def test_normalize_espn_event_applies_team_aliases() -> None:
    updated_at = datetime.now(timezone.utc)

    curacao_fixture = normalize_espn_event(
        {
            "fixture_id": "E1",
            "kind": "group",
            "group_id": "E",
            "round_name": None,
            "kickoff_at": datetime.now(timezone.utc),
            "home_team": "GER",
            "away_team": "CUR",
            "espn_event_id": "3001",
        },
        {
            "id": "3001",
            "competitions": [
                {
                    "competitors": [
                        {
                            "homeAway": "home",
                            "team": {"abbreviation": "GER", "displayName": "Germany"},
                            "score": "2",
                            "winner": True,
                        },
                        {
                            "homeAway": "away",
                            "team": {"abbreviation": "CUW", "displayName": "Curacao"},
                            "score": "0",
                            "winner": False,
                        },
                    ],
                    "status": {
                        "type": {
                            "state": "post",
                            "completed": True,
                            "detail": "Final",
                            "description": "Final",
                        }
                    },
                }
            ],
        },
        updated_at,
    )
    assert curacao_fixture.status == "final"
    assert curacao_fixture.away_team == "CUR"

    turkiye_fixture = normalize_espn_event(
        {
            "fixture_id": "D2",
            "kind": "group",
            "group_id": "D",
            "round_name": None,
            "kickoff_at": datetime.now(timezone.utc),
            "home_team": "AUS",
            "away_team": "TUR",
            "espn_event_id": "3002",
        },
        {
            "id": "3002",
            "competitions": [
                {
                    "competitors": [
                        {
                            "homeAway": "home",
                            "team": {"displayName": "Australia"},
                            "score": "1",
                            "winner": False,
                        },
                        {
                            "homeAway": "away",
                            "team": {"displayName": "Türkiye"},
                            "score": "2",
                            "winner": True,
                        },
                    ],
                    "status": {
                        "type": {
                            "state": "post",
                            "completed": True,
                            "detail": "Final",
                            "description": "Final",
                        }
                    },
                }
            ],
        },
        updated_at,
    )
    assert turkiye_fixture.status == "final"
    assert turkiye_fixture.away_team == "TUR"
    assert turkiye_fixture.winner_team == "TUR"


def test_assemble_truth_and_manual_override_merge() -> None:
    base_truth = assemble_truth_from_fixtures(
        [
            LiveFixtureState(
                fixture_id="A1",
                kind="group",
                group_id="A",
                round_name=None,
                kickoff_at=None,
                home_team="AAA",
                away_team="BBB",
                home_score=1,
                away_score=0,
                status="final",
                display_status="Final",
                winner_team="AAA",
                espn_event_id="1001",
                updated_at=None,
            ),
            LiveFixtureState(
                fixture_id="M73",
                kind="knockout",
                group_id=None,
                round_name="R32",
                kickoff_at=None,
                home_team="AAA",
                away_team="CCC",
                home_score=1,
                away_score=1,
                status="final",
                display_status="Final/PK",
                winner_team="CCC",
                espn_event_id="2001",
                updated_at=None,
            ),
        ]
    )
    override = TruthConfig(
        results={"A1": MatchResult(match_id="A1", home_score=9, away_score=0)},
        group_overrides={"A": ["AAA", "BBB", "CCC", "DDD"]},
        advancing_third_place_groups=["A", "B", "C", "D", "E", "F", "G", "H"],
        knockout_results={"M73": "AAA"},
    )

    merged = merge_truth_configs(base_truth, override)

    assert merged.results["A1"].home_score == 9
    assert merged.group_overrides["A"][0] == "AAA"
    assert merged.advancing_third_place_groups == ["A", "B", "C", "D", "E", "F", "G", "H"]
    assert merged.knockout_results == {"M73": "AAA"}


def test_sync_once_seeds_cache_and_skips_unchanged_rescore(monkeypatch, tmp_path: Path) -> None:
    configure_runtime(monkeypatch, tmp_path)

    def fetch_json(url: str) -> dict[str, Any]:
        if "1001" in url:
            return {"events": []}
        return {
            "events": [
                build_group_event(
                    state="post",
                    completed=True,
                    detail="Final",
                    home_score="2",
                    away_score="1",
                ),
                build_knockout_event(),
            ]
        }

    rescored_calls: list[int] = []

    def fake_rescore_all_entries(session) -> int:  # noqa: ANN001
        rescored_calls.append(1)
        return 7

    monkeypatch.setattr("app.service.rescore_all_entries", fake_rescore_all_entries)

    result_one = sync_truth_once_and_maybe_rescore(EspnSyncService(fetch_json=fetch_json))
    assert result_one["changed"] is True
    assert result_one["rescored_entries"] == 7

    result_two = sync_truth_once_and_maybe_rescore(EspnSyncService(fetch_json=fetch_json))
    assert result_two["changed"] is False
    assert result_two["rescored_entries"] == 0
    assert len(rescored_calls) == 1

    truth = get_truth_provider().load_truth()
    assert truth.results["A1"].home_score == 2
    assert truth.knockout_results == {"M73": "CCC"}
    scoreboard = load_live_scoreboard_snapshot()
    assert scoreboard["provider"] == "espn_cached"
    fixture_lookup = {fixture["fixture_id"]: fixture for fixture in scoreboard["fixtures"]}
    assert fixture_lookup["A1"]["status"] == "final"
    assert fixture_lookup["M103"]["status"] == "unknown"
    assert fixture_lookup["M103"]["display_status"] == "Awaiting ESPN mapping"


def test_sync_failure_preserves_cached_snapshot_and_no_cache_falls_back_to_file(
    monkeypatch,
    tmp_path: Path,
) -> None:
    configure_runtime(monkeypatch, tmp_path)

    service = EspnSyncService(
        fetch_json=lambda url: {
            "events": [
                build_group_event(
                    state="post",
                    completed=True,
                    detail="Final",
                    home_score="3",
                    away_score="0",
                ),
                build_knockout_event(home_team="AAA", away_team="CCC", away_winner=False, home_winner=True),
            ]
        }
    )
    sync_truth_once_and_maybe_rescore(service)

    failing_service = EspnSyncService(fetch_json=lambda url: (_ for _ in ()).throw(RuntimeError("boom")))
    failed = sync_truth_once_and_maybe_rescore(failing_service)
    assert failed["sync_status"] == "error"

    cached_truth = get_truth_provider().load_truth()
    assert cached_truth.results["A1"].home_score == 3

    fresh_tmp = tmp_path / "fresh"
    fresh_tmp.mkdir()
    configure_runtime(monkeypatch, fresh_tmp)
    fallback_truth = get_truth_provider().load_truth()
    assert fallback_truth.results["A1"].home_score == 9


def test_main_sync_truth_command(monkeypatch, capsys) -> None:
    monkeypatch.setattr(app_main, "create_database", lambda: None)
    monkeypatch.setattr(
        app_main,
        "sync_truth_once_and_maybe_rescore",
        lambda: {"sync_status": "success", "changed": True, "rescored_entries": 4},
    )
    monkeypatch.setattr("sys.argv", ["app.main", "sync-truth"])
    app_main.main()
    captured = capsys.readouterr()
    assert "status=success" in captured.out
    assert "rescored_entries=4" in captured.out


def test_main_validate_espn_mapping_command(monkeypatch, capsys) -> None:
    monkeypatch.setattr(app_main, "create_database", lambda: None)
    monkeypatch.setattr(
        app_main,
        "mapping_report",
        lambda: {
            "mapped_group_fixtures": ["A1"],
            "unmapped_group_fixtures": [],
            "mapped_knockout_fixtures": [],
            "unmapped_knockout_fixtures": ["M73"],
        },
    )
    monkeypatch.setattr("sys.argv", ["app.main", "validate-espn-mapping"])
    app_main.main()
    captured = capsys.readouterr()
    assert "Mapped group fixtures (1): A1" in captured.out
    assert "Unmapped knockout fixtures (1): M73" in captured.out
