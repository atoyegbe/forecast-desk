# Pulse Markets Backend

`backend/` is the owned service layer for `naija-pulse`.

The backend now owns the v1 discovery contract for Bayse, Polymarket, Kalshi,
and Manifold. It persists normalized discovery records in Postgres and serves
the public read API that `frontend/` consumes.

## Planned Stack

- `Fastify`
- `TypeScript`
- `PostgreSQL`
- `Redis`
- `BullMQ`

## Responsibilities

- provider connectors
- normalization into local domain models
- entity matching and divergence computation
- price history storage
- smart money jobs and signal delivery
- public REST API and WebSocket fan-out

## Current Status

- `GET /health`
- `GET /api/v1/events`
- `GET /api/v1/events/:eventId`
- `GET /api/v1/events/:eventId/history`
- `GET /api/v1/events/:eventId/compare`
- `GET /api/v1/divergence`
- `GET /api/v1/search`
- `GET /api/v1/smart-money/signals`
- `GET /api/v1/smart-money/wallets`
- `GET /api/v1/smart-money/wallets/:address`
- `WS /api/v1/live/runtime`
- `WS /api/v1/live/events/:eventId`

Discovery, event detail, and event history are now served from persisted
Postgres records. Responses include freshness metadata so the frontend can
distinguish current snapshots from delayed ones. Provider live sockets remain a
separate backend concern and the browser now subscribes through the owned live
route instead of Bayse directly. Cross-platform links are also persisted, so the
backend now serves compare and divergence reads from owned event-link records
instead of ad hoc frontend joins.

Kalshi and Manifold now join Bayse and Polymarket as first-class read
providers. Discovery uses Kalshi's public event feed with nested markets, while
stored history is hydrated from Kalshi event candlesticks. Manifold discovery
uses the public market search API plus batched probability reads, while price
history is synthesized from public bet probability transitions.

Smart money is now started as an owned backend surface as well. The current
implementation seeds from the public Polymarket leaderboard, enriches those
wallets with position and recent activity data from the public Data API, scores
them locally, stores the snapshot in Postgres, and serves a public signal feed,
leaderboard, and wallet-detail read model from owned routes.

## Local Setup

1. Copy `.env.example` to `.env`
2. Create a local database, for example `createdb naija_pulse`
3. Run `npm install`
4. Run `npm run dev`

The backend bootstraps its discovery schema on startup. If `DATABASE_URL` is not
set, it falls back to `postgresql:///postgres` for local development.

The first Smart Money request can take noticeably longer than normal discovery
reads because it may need to refresh the wallet snapshot on demand before
serving the response.

## Expected Source Layout

```text
src/
  app/
  routes/
  providers/
  normaliser/
  matcher/
  smart-money/
  jobs/
  db/
  server.ts
```
