# Pulse Markets Web

`Pulse Markets` is the UI for the `naija-pulse` project. It is a read-only
prediction market dashboard built on public Bayse data.

## Stack

- `Vite`
- `React`
- `TypeScript`
- `React Router`
- `TanStack Query`
- `Tailwind CSS`
- `Recharts`

## Run locally

```bash
npm install
npm run dev
```

The app expects `/api` to proxy to `https://relay.bayse.markets`.

## Deployment

The app is configured for `Netlify` via
[netlify.toml](/Users/atoyegbe/dev/quant/projects/naija-pulse/web/netlify.toml):

- `/api/*` proxies to Bayse
- `/*` falls back to `index.html` for SPA routing

If you move to `Railway` later, keep the same `/api` contract and add a tiny
Node proxy in front of the built assets rather than changing the UI code.
