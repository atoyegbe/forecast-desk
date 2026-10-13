# Local development

## Services and ports

The default setup uses:

| Service | Address |
| --- | --- |
| Frontend | <http://localhost:5173> |
| API | <http://localhost:8787> |
| PostgreSQL | `127.0.0.1:54329` |
| Redis | `127.0.0.1:6379` |

From the repository root, `make dev` starts PostgreSQL and Redis through Docker
Compose, then the API, smart-money worker, and frontend. Copy
[`backend/.env.example`](../backend/.env.example) to `backend/.env` first.

If either database port is in use, choose free ports:

```bash
POSTGRES_PORT=54330 REDIS_PORT=6380 make dev
```

The root [`Makefile`](../Makefile) adjusts `DATABASE_URL` and `REDIS_URL` for
those overrides. A `502 Bad Gateway` from the Vite proxy usually means the API
did not start; check the API and Docker output first.

## Useful commands

Run these from the repository root:

```bash
make api            # API plus local PostgreSQL and Redis
make worker         # worker plus local PostgreSQL and Redis
make frontend       # frontend only
make dev            # API, worker, frontend, and local infrastructure
make infra-up       # start PostgreSQL and Redis
make infra-down     # stop PostgreSQL and Redis
make infra-logs     # follow infrastructure logs
```

Each workspace also has its own scripts:

```bash
npm --prefix backend run dev
npm --prefix backend run dev:worker
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run dev
npm --prefix frontend run build
```

Backend tests create temporary PostgreSQL databases. CI supplies
`TEST_ADMIN_DATABASE_URL`; locally, point it at a PostgreSQL database on which
you can create databases. See [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
for the CI configuration.

## Environment variables

Backend options are documented in [`backend/.env.example`](../backend/.env.example).
Important ones include `DATABASE_URL`, `PORT`, `REDIS_URL`, `CACHE_ENABLED`,
`RESEND_API_KEY`, `QUORUM_EMAIL_FROM`, `TELEGRAM_BOT_TOKEN` or
`QUORUM_TELEGRAM_BOT_TOKEN`, provider URLs, and scheduler controls. Without a
Resend key, email auth and alert delivery use the local development fallback.

The Vite server proxies `/api/v1`, `/health`, and `/og` to the local API. For
split deployments, see [`frontend/.env.example`](../frontend/.env.example) for
the public API, WebSocket, health, site URL, and prerender settings. Keep real
credentials in local `.env` files or deployment secrets.
