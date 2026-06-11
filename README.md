# World Cup Bracket Challenge

World Cup bracket challenge / pick'em app built for `ratracefantasy.com`.

This project combines a FastAPI backend for persistence, scoring, auth, and live result sync with a Next.js frontend for entry building, pools, and the main user experience.

## What It Does

- Lets users register, log in, and manage persistent accounts
- Supports creating multiple bracket entries with:
  - group-stage score predictions
  - third-place advancement selection
  - knockout-stage winner picks
- Supports private pools with invite codes and optional shared passwords
- Scores entries against live ESPN-backed match truth, with manual truth overrides as a fallback
- Shows a live Match Center feed with scheduled, in-progress, and final match status

## Architecture

The app has two main services:

- Backend: FastAPI + SQLAlchemy
- Frontend: Next.js App Router + React

### Backend responsibilities

- user authentication and session cookies
- entry CRUD
- pool CRUD and membership
- scoring and max-points calculations
- cached ESPN sync and live truth generation
- admin / operational commands

### Frontend responsibilities

- login / registration flow
- My Wizard workspace
- entry builder for group-stage and knockout predictions
- pool pages, leaderboard views, and entry management
- live Match Center display

### Browser/API flow

In production, the frontend serves browser requests from the web origin and proxies `/api/...` requests to the backend service. This keeps auth/session behavior simpler than direct cross-origin browser calls.

## Repo Layout

- [`api.py`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/api.py): FastAPI entrypoint
- [`app/`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/app): backend services, models, scoring, sync, and CLI helpers
- [`config/`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/config): tournament structure, ESPN mapping, and truth files
- [`testing/`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/testing): backend tests
- [`web/`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/web): Next.js frontend

## Technology Stack

### Backend

- Python 3.11+
- FastAPI
- SQLAlchemy
- Pydantic
- PostgreSQL or SQLite
- JWT/session-cookie auth
- ESPN public scoreboard endpoint

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

### Deployment

- Render for the frontend and backend services
- Neon Postgres for production persistence

## Local Development

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

Notes:

- defaults to a local SQLite DB at `worldcup.db`
- default local CORS origins are `http://localhost:3000` and `http://127.0.0.1:3000`
- `create_database()` runs automatically on API startup
- `SESSION_COOKIE_SECURE` should stay `false` for local HTTP development

### Frontend

```bash
cd web
npm install
npm run dev
```

Open:

- Frontend: `http://localhost:3000`
- Backend docs: `http://127.0.0.1:8000/docs`

## Common Commands

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

### Frontend checks

```bash
cd web
npm run lint
npm run build
```

### Backend operational commands

Initialize the database:

```bash
python -m app.main init-db
```

Rescore all entries:

```bash
python -m app.main rescore-all
```

Run one ESPN truth sync:

```bash
python -m app.main sync-truth
```

Validate ESPN mapping coverage:

```bash
python -m app.main validate-espn-mapping
```

## Runtime Configuration

### Backend environment variables

- `DATABASE_URL`: defaults to local SQLite
- `JWT_SECRET`: signing secret for sessions/tokens
- `JWT_ALGORITHM`: defaults to `HS256`
- `SESSION_COOKIE_NAME`: defaults to `wc_session`
- `SESSION_DURATION_HOURS`: defaults to `168`
- `SESSION_COOKIE_SECURE`: defaults to `false`
- `SESSION_COOKIE_SAMESITE`: defaults to `lax` locally and `none` when secure cookies are enabled
- `CORS_ORIGINS`: comma-separated frontend origins
- `ENTRY_LOCK_AT`: optional ISO timestamp to globally lock edits
- `TOURNAMENT_PATH`: defaults to `config/tournament.json`
- `ESPN_MAPPING_PATH`: defaults to `config/espn_mapping.json`
- `TRUTH_PATH`: defaults to `config/truth/woshisim.json`
- `TRUTH_OVERRIDE_PATH`: defaults to `config/truth/override.json`
- `TRUTH_PROVIDER`: defaults to `espn_cached`
- `ESPN_SYNC_ENABLED`: defaults to `true`
- `ESPN_POLL_INTERVAL_SECONDS`: defaults to `60`
- `ESPN_SYNC_STALE_AFTER_SECONDS`: defaults to `300`

### Frontend environment variables

- `API_UPSTREAM_URL`: backend origin used by the frontend server-side proxy
- `NEXT_PUBLIC_API_BASE_URL`: backend origin used for local/dev fallbacks and configuration
- `NEXT_PUBLIC_BASE_PATH`: optional path prefix if the app is served under one

## ESPN Workflow

The app currently uses ESPN’s public scoreboard endpoint family and a checked-in mapping file. No ESPN API key is required in the current implementation.

### Stage 1 before launch

- populate group-stage rows in [`config/espn_mapping.json`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/config/espn_mapping.json)
- leave knockout rows empty until ESPN publishes the correct event IDs
- run:

```bash
python -m app.main validate-espn-mapping
```

- start the backend with:
  - `TRUTH_PROVIDER=espn_cached`
  - `ESPN_SYNC_ENABLED=true`

### Stage 2 after the group stage

- update knockout rows in [`config/espn_mapping.json`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/config/espn_mapping.json)
- redeploy the backend
- run:

```bash
python -m app.main sync-truth
```

## Deployment

The repo includes:

- [`render.yaml`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/render.yaml): Render blueprint
- [`.env.example`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/.env.example): backend env template
- [`web/.env.example`](/Users/rodrigoruiz/Documents/wosher/WorldCupBracketChallenge/web/.env.example): frontend env template

### Recommended production setup

- Neon Postgres for `DATABASE_URL`
- Render web service for `worldcup-api`
- Render web service for `worldcup-web`

### Suggested domains

- Frontend: `worldcup.ratracefantasy.com`
- Backend: `api.ratracefantasy.com`

Using a path like `ratracefantasy.com/worldcup` is possible, but it usually requires reverse-proxy or CDN path-prefix routing outside Render.

### Render / Neon checklist

1. Create a Neon Postgres project.
2. Set `DATABASE_URL` with SSL enabled.
3. Deploy the backend and frontend services from this repo.
4. Set backend env vars:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CORS_ORIGINS`
   - `SESSION_COOKIE_SECURE=true`
   - `TRUTH_PROVIDER=espn_cached`
   - `ESPN_SYNC_ENABLED=true`
5. Set frontend env vars:
   - `API_UPSTREAM_URL`
   - `NEXT_PUBLIC_API_BASE_URL`
   - optionally `NEXT_PUBLIC_BASE_PATH`
6. Add custom domains.
7. Update `CORS_ORIGINS` to match final frontend origin(s).

## Operational Notes

- The current ESPN poller assumes one backend instance owns sync.
- If the app is hosted on free-tier Render services, idle spin-down can interrupt auth/API availability.
- Pool pages cache pool detail independently from the general entry list, so cross-account updates are not truly real-time.

## Known Gaps

- backend test coverage is still partial
- pool/member updates across tabs and accounts currently rely on refresh/focus-based revalidation rather than realtime events
- multi-instance live-sync ownership is not yet coordinated
