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

The app expects `/api` to proxy upstream market APIs:

- `/api/*` -> Bayse relay
- `/api/polymarket/gamma/*` -> Polymarket Gamma
- `/api/polymarket/clob/*` -> Polymarket CLOB

## Deployment

The app is configured for `Netlify` via
[netlify.toml](/Users/atoyegbe/dev/quant/projects/naija-pulse/frontend/netlify.toml):

- `/api/*` proxies to Bayse
- `/api/polymarket/gamma/*` proxies to Polymarket Gamma
- `/api/polymarket/clob/*` proxies to Polymarket CLOB
- `/*` falls back to `index.html` for SPA routing

If you move to `Railway` later, keep the same `/api` contract and add a tiny
Node proxy in front of the built assets rather than changing the UI code.
