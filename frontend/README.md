# Pulse Markets Frontend

`Pulse Markets` is the frontend workspace for the `naija-pulse` project. It is
the public read-only prediction market dashboard built on normalized public
Bayse and Polymarket data.

## Frontend Direction

- `Vite`
- `React`
- `TypeScript`
- `TanStack Router`
- `TanStack Query`
- `Tailwind CSS`
- `Recharts`

The frontend now runs on `TanStack Router` with the existing product URLs and
page behavior preserved.

The shipped UI follows a dark, data-dense market-desk model: compact nav,
monospaced numeric emphasis, strong platform badges, and leaderboard-style
comparison surfaces instead of the earlier editorial light theme.

## Run locally

```bash
npm install
npm run dev
```

The app expects the owned backend to serve:

- `/health`
- `/api/v1/*`
- `/api/v1/live/runtime` for the shell live-status connection
- `/api/v1/live/*` for websocket subscriptions

The current frontend surface includes:

- backend-backed discovery, detail, and stored history
- a dedicated `/search` results desk backed by the owned search endpoint
- backend-owned live event updates
- a dedicated compare desk plus event-level compare read driven by `/api/v1/events/:eventId/compare`
- a divergence leaderboard driven by `/api/v1/divergence`

## Deployment

The app is configured for `Netlify` via
[netlify.toml](/Users/atoyegbe/dev/quant/projects/naija-pulse/frontend/netlify.toml):

- `/*` falls back to `index.html` for SPA routing

Before deploying the frontend, point `/health`, `/api/v1/*`, and
`/api/v1/live/*` at the owned backend service. The frontend should not proxy
directly to Bayse or Polymarket anymore.
