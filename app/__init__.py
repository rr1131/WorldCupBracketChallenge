"""Application package bootstrap and small runtime patches."""

from __future__ import annotations

from datetime import timedelta, timezone


def _patch_live_sync_active_dates() -> None:
    try:
        from . import live_sync
    except Exception:
        return

    current = getattr(live_sync, "_select_active_dates", None)
    if not callable(current):
        return

    if getattr(current, "__name__", "") == "_select_active_dates_patched":
        return

    original = current

    def _select_active_dates_patched(fixtures, cached_status_by_fixture, now):
        selected_dates = set()
        window_start = now - timedelta(days=live_sync.ACTIVE_WINDOW_DAYS)
        window_end = now + timedelta(days=live_sync.ACTIVE_WINDOW_DAYS)

        for fixture in fixtures:
            kickoff_at = fixture["kickoff_at"]
            event_id = fixture["espn_event_id"]
            if not event_id or kickoff_at is None:
                continue

            fixture_id = fixture["fixture_id"]
            current_status = cached_status_by_fixture.get(fixture_id)
            in_window = window_start <= kickoff_at <= window_end
            unresolved = current_status != "final"

            # Keep already-cached completed fixtures in the fetch set so
            # historical truth does not disappear once a match falls out of
            # the rolling active window.
            if not (in_window or unresolved or fixture_id in cached_status_by_fixture):
                continue

            selected_dates.add(kickoff_at.astimezone(timezone.utc).strftime("%Y%m%d"))

        return sorted(selected_dates)

    _select_active_dates_patched.__name__ = "_select_active_dates_patched"
    setattr(_select_active_dates_patched, "__wrapped__", original)
    live_sync._select_active_dates = _select_active_dates_patched


_patch_live_sync_active_dates()
