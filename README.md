# Quorum

`Quorum` is the chosen brand name for the public prediction market dashboard project.

This project was previously referred to as `Naija Pulse`. The code should stay provider-agnostic so the product can keep expanding without being locked to a single region or provider.

## Product Direction

Build a public-facing web app that makes prediction markets legible for normal users:

- track culturally relevant events
- show live odds and price history
- surface trending markets and sharp moves
- make the product easy to extend to more regions and more prediction market APIs

## v1 Scope

- event discovery page
- event detail page
- live odds updates
- price history charts
- category and trend views
- smart money signal feed and whale leaderboard
- email auth for alert subscriptions
- wallet alert subscriptions and delivery
- editorial framing around why a market moved

## v1 Non-Goals

- trading execution
- user portfolios
- auto-trading
- broad account features beyond alerts

## Workspace Structure

- `frontend/` holds the public UI and is locked to `Vite + React + TanStack Router + TanStack Query`.
- `backend/` is the owned API, ingestion, normalization, matching, and real-time workspace.
- `docs/` holds the product blueprint and supporting architecture notes.

## Local Development

From the repo root:

- `make api` starts the backend and the local Postgres container it expects
- `make worker` starts the smart-money worker and the local Postgres container it expects
- `make frontend` starts the frontend dev server
- `make dev` starts backend + smart-money worker + frontend together
- `make postgres-down` stops the local Postgres container

By default the root `Makefile` runs Postgres in Docker on `127.0.0.1:54329` and
passes that connection string to the backend. `make dev` disables the scheduler
inside the API process and runs it in the dedicated worker instead.

For Phase 7 email delivery, the backend worker will use Resend when these env
vars are set:

- `RESEND_API_KEY=...`
- `PULSE_EMAIL_FROM=alerts@your-domain.com`

Without a Resend key, auth code and alert email sending fall back to a local
no-op mode that is useful for tests and UI development, but it will not deliver
real email.

## Tracking

- Delivery tracker: `docs/implementation-tracker.md`

## Bayse API Mapping

- `GET /v1/pm/events` for discovery and category pages
- `GET /v1/pm/events/{eventId}/price-history` for charts
- `GET /v1/pm/events/{eventId}` for detail enrichment
- `wss://socket.bayse.markets/ws/v1/markets` for live price updates

## Next Build Step

Use an adapter layer from day one so Bayse is one provider, not the whole app, and keep the repo split between `frontend/` and `backend/`. See `docs/provider-model.md`.
