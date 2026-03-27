# Pulse Markets Backend

`backend/` is the owned service layer for `naija-pulse`.

The backend now owns the v1 discovery contract for Bayse and Polymarket. It
persists normalized discovery records in Postgres and serves the public read API
that `frontend/` consumes.

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
- `WS /api/v1/live/events/:eventId`

Discovery, event detail, and event history are now served from persisted
Postgres records. Responses include freshness metadata so the frontend can
distinguish current snapshots from delayed ones. Provider live sockets remain a
separate backend concern and the browser now subscribes through the owned live
route instead of Bayse directly.

## Local Setup

1. Copy `.env.example` to `.env`
2. Create a local database, for example `createdb naija_pulse`
3. Run `npm install`
4. Run `npm run dev`

The backend bootstraps its discovery schema on startup. If `DATABASE_URL` is not
set, it falls back to `postgresql:///postgres` for local development.

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
