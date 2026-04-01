# Quorum

Quorum is a public prediction market desk for people who want to read markets,
not trade them.

It aggregates public market data from multiple venues, normalizes it into one
owned backend contract, and presents it through a fast, editorially structured
web app with live updates, comparison views, divergence reads, and smart-money
signals.

This project was originally started as `Naija Pulse`. The product name is now
`Quorum`, but some internal docs and folder names still use the earlier name.

## What Quorum Does

- aggregates public prediction market data into one read model
- makes active markets easier to scan across venues and categories
- shows stored history and live price updates through owned APIs
- highlights cross-platform divergence and market repricing
- surfaces smart-money signals, wallet leaderboards, and wallet detail pages
- supports passwordless auth plus alert and Telegram connection flows

Quorum is intentionally read-first. It does not handle trading execution,
portfolios, or broker-style account workflows.

## Current Product Surface

Frontend:

- homepage market desk
- category desks
- market detail pages
- search results desk
- compare view and divergence leaderboard
- smart money signal feed, leaderboard, and wallet profiles
- alert, account, and Telegram connection flows

Backend:

- normalized event discovery across Bayse, Polymarket, Kalshi, and Manifold
- owned event detail, history, comparison, search, and divergence endpoints
- websocket fan-out for runtime status, live market updates, and smart-money signals
- smart-money snapshot refresh worker
- passwordless auth, alert subscription, and delivery endpoints

## Stack

### Frontend

- Vite
- React 19
- TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS v4
- Recharts

### Backend

- Fastify
- TypeScript
- PostgreSQL
- Redis for shared caching and cross-process coordination when enabled
- WebSockets for live runtime and market updates

## Architecture

Quorum is split into two workspaces:

- `frontend/`: the public web app
- `backend/`: the owned API, normalization layer, realtime hub, worker jobs, and persistence

The key design rule is provider abstraction: the UI reads Quorum's local domain
model, not raw provider payloads. Adding a new market venue should mostly mean
adding a new adapter and mapping layer in `backend/`, not rewriting pages.

## Supported Providers

Current read providers:

- Bayse
- Polymarket
- Kalshi
- Manifold

Current smart-money coverage:

- Polymarket only

## Repository Layout

```text
.
├── backend/   # Fastify API, worker, provider adapters, persistence, realtime
├── compose.yml # Local Postgres + Redis services for development
├── docs/      # Product, architecture, deployment, and tracking docs
├── frontend/  # Vite + React public web app
└── Makefile   # Root local development shortcuts
```

## Quick Start

### Prerequisites

- Node.js and npm
- Docker

### 1. Install dependencies

Install dependencies in each workspace:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

The default local setup expects:

- backend API on `http://localhost:8787`
- frontend on `http://localhost:5173`
- Postgres in Docker on `127.0.0.1:54329`
- Redis in Docker on `127.0.0.1:6379`

### 3. Start everything

From the repo root:

```bash
make dev
```

That starts:

- the backend API
- the smart-money worker
- the frontend dev server
- local Postgres and Redis services through Docker Compose if needed

Then open `http://localhost:5173`.

If Docker reports that `54329` or `6379` is already allocated, another local
container or process already owns the default Postgres or Redis port. Either
stop that process, or override the ports for this project:

```bash
POSTGRES_PORT=54330 REDIS_PORT=6380 make dev
```

The root `Makefile` recalculates `DATABASE_URL` and `REDIS_URL` automatically
from those overrides. A `502 Bad Gateway` from `localhost:5173/api/v1/...`
usually means the frontend is up but the backend never started because local
infra failed to boot.

If you want the local infrastructure up before starting the app processes, use:

```bash
make infra-up
```

Or run Docker Compose directly:

```bash
docker compose up -d postgres redis
```

## Local Development Commands

From the repo root:

```bash
make api            # backend API + local Postgres + Redis
make worker         # smart-money worker + local Postgres + Redis
make frontend       # frontend only
make dev            # API + worker + frontend
make infra-up       # start local Postgres + Redis
make infra-down     # stop local Postgres + Redis
make infra-logs     # tail local Postgres + Redis logs
make postgres-up    # start local Postgres service
make postgres-down  # stop local Postgres service
make postgres-logs  # tail Postgres logs
make redis-up       # start local Redis service
make redis-down     # stop local Redis service
make redis-logs     # tail Redis logs
```

Per workspace:

```bash
cd frontend && npm run dev
cd frontend && npm run build

cd backend && npm run dev
cd backend && npm run dev:worker
cd backend && npm run build
cd backend && npm run test
```

## Environment Notes

### Backend

The backend reads its env from [backend/.env.example](backend/.env.example).
Important variables include:

- `DATABASE_URL`
- `PORT`
- `REDIS_URL`
- `CACHE_ENABLED`
- `RESEND_API_KEY`
- `QUORUM_EMAIL_FROM`
- `TELEGRAM_BOT_TOKEN` or `QUORUM_TELEGRAM_BOT_TOKEN`
- provider base URLs and websocket URLs
- smart-money scheduler and refresh controls

Notes:

- The checked-in [compose.yml](/Users/atoyegbe/dev/quant/projects/naija-pulse/compose.yml) is the supported local path for Postgres and Redis.
- `make api`, `make worker`, and `make dev` all start Postgres and Redis first.
- Redis is still optional if you run processes manually, but it is now recommended for local caching and API/worker coordination.
- Without `RESEND_API_KEY`, email auth and alert delivery fall back to local
  no-op behavior suitable for development only.

### Frontend

In local development, the Vite dev server proxies `/api/v1`, `/health`, and
`/og` to `http://localhost:8787`, so no frontend env is required if the backend
is running locally.

For split environments or deployment, the frontend supports:

- `QUORUM_PUBLIC_BACKEND_API_BASE`
- `QUORUM_PUBLIC_BACKEND_WS_BASE`
- `QUORUM_PUBLIC_BACKEND_HEALTH_URL`
- `QUORUM_PUBLIC_SITE_URL`
- `QUORUM_PRERENDER_WALLET_LIMIT`

## API Overview

Core read routes:

- `GET /health`
- `GET /api/v1/events`
- `GET /api/v1/search`
- `GET /api/v1/divergence`
- `GET /api/v1/events/:eventId`
- `GET /api/v1/events/:eventId/history`
- `GET /api/v1/events/:eventId/compare`

Smart money:

- `GET /api/v1/smart-money/status`
- `GET /api/v1/smart-money/signals`
- `GET /api/v1/smart-money/wallets`
- `GET /api/v1/smart-money/wallets/:address`
- `WS /api/v1/live/smart-money/signals`

Realtime:

- `WS /api/v1/live/runtime`
- `WS /api/v1/live/events/:eventId`

Auth, user, and alerts:

- `POST /api/v1/auth/request-link`
- `POST /api/v1/auth/verify-link`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/user/me`
- `PATCH /api/v1/user/preferences`
- `POST /api/v1/telegram/connect`
- `DELETE /api/v1/telegram/connect`
- `GET /api/v1/alerts/subscriptions`
- `POST /api/v1/alerts/subscriptions`
- `PATCH /api/v1/alerts/subscriptions/:id`
- `DELETE /api/v1/alerts/subscriptions/:id`
- `GET /api/v1/alerts/deliveries/recent`
- `POST /api/v1/alerts/unsubscribe`

## Deployment

Railway is the intended production target.

Recommended service split:

- `frontend/` as one Railway service
- `backend/` API as one Railway service
- `backend/` worker as a second Railway service
- Railway Postgres as the shared database

Relevant config files:

- `frontend/railway.toml`
- `backend/railway.toml`
- `backend/railway.worker.toml`

Deployment notes:

- [docs/railway-deployment.md](docs/railway-deployment.md)

## Docs

Key project docs:

- [docs/implementation-tracker.md](docs/implementation-tracker.md) - working delivery tracker
- [docs/mvp.md](docs/mvp.md) - MVP guardrails
- [docs/provider-model.md](docs/provider-model.md) - provider abstraction model
- [docs/naijapulse-blueprint.md](docs/naijapulse-blueprint.md) - product and architecture blueprint
- [docs/naijapulse-uiux.md](docs/naijapulse-uiux.md) - UI and UX direction
- [docs/caching.md](docs/caching.md) - backend and client caching notes

## Current Focus

The implementation tracker currently has the project in the Smart Money slice,
with the public read product already live across discovery, detail, comparison,
divergence, and owned realtime reads.

## Guiding Principles

- provider-agnostic backend contract
- read-first product design
- live market context without pretending odds are certainty
- vertical slices across backend and frontend
- owned APIs before provider-specific frontend logic
