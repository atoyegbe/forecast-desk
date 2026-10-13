# Quorum

Quorum is a read-first prediction market desk. It brings public markets from
Bayse, Polymarket, Kalshi, and Manifold into one interface for discovery,
comparison, price history, and live updates. It does not execute trades.

## What it offers

- Market, category, search, comparison, and divergence views
- Live market updates and stored price history
- Polymarket smart-money signals, wallet profiles, and leaderboards
- Passwordless accounts with email and Telegram alerts

## How it works

The React and TypeScript app in [`frontend/`](frontend/) reads Quorum's API. The
Fastify and TypeScript service in [`backend/`](backend/) normalizes provider data,
stores it in PostgreSQL, and runs live feeds and background jobs. Redis supports
shared caching and coordination. Provider-specific payloads stay behind the API.

## Run locally

Requires Node.js 22, npm, and Docker.

```bash
npm --prefix backend ci
npm --prefix frontend ci
cp backend/.env.example backend/.env
make dev
```

Open <http://localhost:5173>. The API runs on <http://localhost:8787>.
`make dev` starts PostgreSQL and Redis with Docker Compose, then the API, worker,
and frontend. External email and Telegram credentials are optional for local
read-only development.

For port conflicts, service-by-service commands, environment variables, and
troubleshooting, see the [development guide](docs/development.md).

## Documentation

- [Development and local commands](docs/development.md)
- [API routes](docs/api.md)
- [Provider model](docs/provider-model.md)
- [MVP scope](docs/mvp.md)
- [Railway deployment](docs/railway-deployment.md)

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) before sending a pull request. Quorum is
released under the [MIT License](LICENSE). The logo and hero artwork are
included with the copyright holder's permission.
