# Pulse Markets Frontend

`Pulse Markets` is the frontend workspace for the `naija-pulse` project. It is
the public read-only prediction market dashboard built on normalized public
Bayse and Polymarket data.

## Frontend Direction

- `Vite`
- `React`
- `TypeScript`
- `TanStack Router` (locked-in target)
- `TanStack Query`
- `Tailwind CSS`
- `Recharts`

The current codebase still runs on `React Router`. The project direction is now
locked to `TanStack Router` without introducing a framework rewrite.

## Run locally

```bash
npm install
npm run dev
```

The app expects the owned backend to serve:

- `/health`
- `/api/v1/*`
- `/api/v1/live/*` for websocket subscriptions

## Deployment

The app is configured for `Netlify` via
[netlify.toml](/Users/atoyegbe/dev/quant/projects/naija-pulse/frontend/netlify.toml):

- `/*` falls back to `index.html` for SPA routing

Before deploying the frontend, point `/health`, `/api/v1/*`, and
`/api/v1/live/*` at the owned backend service. The frontend should not proxy
directly to Bayse or Polymarket anymore.
