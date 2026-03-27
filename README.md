# Naija Pulse

`Naija Pulse` is the current working name for the public prediction market dashboard project.

The name is intentionally temporary. If this product expands beyond Nigeria or Bayse, the code should stay provider-agnostic and the brand can be swapped later without changing the core architecture.

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
- editorial framing around why a market moved

## v1 Non-Goals

- trading execution
- user portfolios
- auto-trading
- private authenticated features

## Workspace Structure

- `frontend/` holds the public UI and is locked to `Vite + React`, moving toward `TanStack Router + TanStack Query`.
- `backend/` is the owned API, ingestion, normalization, matching, and real-time workspace.
- `docs/` holds the product blueprint and supporting architecture notes.

## Tracking

- Delivery tracker: `docs/implementation-tracker.md`

## Bayse API Mapping

- `GET /v1/pm/events` for discovery and category pages
- `GET /v1/pm/events/{eventId}/price-history` for charts
- `GET /v1/pm/events/{eventId}` for detail enrichment
- `wss://socket.bayse.markets/ws/v1/markets` for live price updates

## Naming Direction

If you want a broader brand later, these are better than locking into `Naija`:

- `Pulse Markets`
- `Event Pulse`
- `Market Current`
- `Signal Markets`
- `Outcome Watch`

## Next Build Step

Use an adapter layer from day one so Bayse is one provider, not the whole app, and keep the repo split between `frontend/` and `backend/`. See `docs/provider-model.md`.
