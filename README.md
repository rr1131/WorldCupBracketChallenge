# WorldCupBracketChallenge

World Cup bracket challenge / pick'em app for `ratracefantasy.com`.

This repo currently has two main parts:

- A Python/FastAPI backend for auth, entries, pools, persistence, scoring, and admin commands
- A Next.js frontend in [`web/`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/web) for the interactive entry and pool experience

## Current State

The app now runs as a real two-service web product:

- The FastAPI backend persists users, entries, pools, scores, and ESPN sync state
- The Next.js frontend uses the backend API for auth, entry CRUD, pool CRUD, and pool joins
- Live match data is cached server-side from ESPN and exposed to the browser through `/api/live/scoreboard`

For local testing and production deployment, run both the backend and the frontend.

## Repo Layout

- [`api.py`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/api.py): FastAPI app entrypoint
- [`app/`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/app): backend domain logic, models, scoring, CLI helpers
- [`config/`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/config): tournament and truth data
- [`config/espn_mapping.json`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/config/espn_mapping.json): checked-in ESPN kickoff and event-id mapping
- [`testing/`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/testing): Python tests
- [`web/`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/web): Next.js UI

## Local Setup

### Backend

Python `3.11+` is required.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

Notes:

- By default the app creates a local SQLite database at `worldcup.db`
- Default CORS origins are `http://localhost:3000` and `http://127.0.0.1:3000`
- `SESSION_COOKIE_SECURE` defaults to `false` for local HTTP development
- `create_database()` runs automatically on API startup

### Frontend

Node `18+` is a good baseline for the current Next.js app.

```bash
cd web
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Commands To Test Locally

If you want to check the current changes quickly, these are the main commands:

### Run the app

Terminal 1:

```bash
source .venv/bin/activate
uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
cd web
npm run dev
```

### Backend tests

```bash
source .venv/bin/activate
python -m pytest testing
```

### Frontend lint

```bash
cd web
npm run lint
```

## Helpful URLs

- Frontend: `http://localhost:3000`
- Backend docs: `http://127.0.0.1:8000/docs`

## Useful Backend Commands

Initialize the database:

```bash
python -m app.main init-db
```

Rescore all saved entries:

```bash
python -m app.main rescore-all
```

Run one ESPN truth sync:

```bash
python -m app.main sync-truth
```

Validate current ESPN mapping coverage:

```bash
python -m app.main validate-espn-mapping
```

## Runtime Configuration

The backend reads configuration from environment variables.

- `DATABASE_URL`: defaults to a local SQLite file
- `JWT_SECRET`: defaults to `dev-secret-change-me`
- `JWT_ALGORITHM`: defaults to `HS256`
- `SESSION_COOKIE_NAME`: defaults to `wc_session`
- `SESSION_DURATION_HOURS`: defaults to `168`
- `CORS_ORIGINS`: defaults to `http://localhost:3000,http://127.0.0.1:3000`
- `TOURNAMENT_PATH`: defaults to `config/tournament.json`
- `ESPN_MAPPING_PATH`: defaults to `config/espn_mapping.json`
- `TRUTH_PATH`: defaults to `config/truth/woshisim.json`
- `TRUTH_OVERRIDE_PATH`: defaults to `config/truth/override.json`
- `TRUTH_PROVIDER`: defaults to `espn_cached`
- `ENTRY_LOCK_AT`: optional ISO timestamp for globally locking edits
- `SESSION_COOKIE_SECURE`: defaults to `false`
- `ESPN_SYNC_ENABLED`: defaults to `true`
- `ESPN_POLL_INTERVAL_SECONDS`: defaults to `60`
- `ESPN_SYNC_STALE_AFTER_SECONDS`: defaults to `300`

Example:

```bash
export JWT_SECRET="replace-me"
export TRUTH_PROVIDER="espn_cached"
export ESPN_SYNC_ENABLED="true"
export SESSION_COOKIE_SECURE="true"
export ENTRY_LOCK_AT="2026-06-11T18:00:00Z"
uvicorn api:app --reload
```

## ESPN Workflow

The ESPN integration does not use an API key in the current implementation. It relies on the public `site.api.espn.com` scoreboard endpoint family and a checked-in mapping file.

Stage 1 before launch:

- Populate the group-stage rows in [`config/espn_mapping.json`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/config/espn_mapping.json) with real `kickoff_at` and `espn_event_id` values
- Leave knockout rows `M73`-`M104` empty until ESPN publishes them
- Run `python -m app.main validate-espn-mapping`
- Start the backend with `TRUTH_PROVIDER=espn_cached` and `ESPN_SYNC_ENABLED=true`

Stage 2 after the group stage:

- Update the knockout rows in [`config/espn_mapping.json`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/config/espn_mapping.json)
- Redeploy the backend
- Run `python -m app.main sync-truth`

## Frontend Notes

The main UI flow now expects a live backend session and persistent API data.

The builder flow lives primarily in:

- [`web/components/entry/EntryBuilder.tsx`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/web/components/entry/EntryBuilder.tsx)
- [`web/components/providers/AppDataProvider.tsx`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/web/components/providers/AppDataProvider.tsx)

## Deployment

The repo now includes:

- [`render.yaml`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/render.yaml): Render blueprint for one backend web service and one frontend web service
- [`.env.example`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/.env.example): backend env template
- [`web/.env.example`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/web/.env.example): frontend env template

Recommended production stack:

- Neon Postgres for `DATABASE_URL`
- Render web service for the FastAPI backend
- Render web service for the Next.js frontend

### Suggested Domains

The easiest production setup is:

- Frontend: `worldcup.ratracefantasy.com`
- Backend: `api.ratracefantasy.com`

Using `ratracefantasy.com/worldcup` is possible, but it requires a reverse proxy or CDN rule outside Render.
That is an inference from Render's custom-domain model, which attaches at the host level rather than managing path-prefix routing for you.

### Render / Neon Checklist

1. Create a Neon Postgres project.
2. Copy the pooled connection string and set `DATABASE_URL` with `sslmode=require`.
3. Create two Render web services from this repo, or use the Blueprint flow with `render.yaml`.
4. Set backend env vars:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CORS_ORIGINS`
   - `SESSION_COOKIE_SECURE=true`
   - `TRUTH_PROVIDER=espn_cached`
   - `ESPN_SYNC_ENABLED=true`
5. Set frontend env vars:
   - `NEXT_PUBLIC_API_BASE_URL`
   - optionally `NEXT_PUBLIC_BASE_PATH` if you later serve the app under a path prefix
6. Add your final custom domains in Render.
7. Update `CORS_ORIGINS` to exactly match the final frontend origin(s).
8. Redeploy the backend after changing ESPN mappings or production env values.

### Blueprint Defaults

The included `render.yaml` assumes:

- backend service name: `worldcup-api`
- frontend service name: `worldcup-web`
- backend health check: `/api/healthz`
- Node runtime: `20`
- Python runtime: `3.11`

## Known Gaps

- Some files under `testing/` are placeholders right now, so Python test coverage is incomplete
- Production deployment still assumes one backend instance owns the ESPN poller
