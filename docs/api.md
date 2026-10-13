# API routes

The API serves normalized Quorum data at `/api/v1`. See the route implementations
in [`backend/src/routes/`](../backend/src/routes/) for request and response details.

## Market reads

| Method | Route |
| --- | --- |
| GET | `/health` |
| GET | `/api/v1/events` |
| GET | `/api/v1/search` |
| GET | `/api/v1/divergence` |
| GET | `/api/v1/events/:eventId` |
| GET | `/api/v1/events/:eventId/history` |
| GET | `/api/v1/events/:eventId/compare` |

## Smart money and live feeds

| Method | Route |
| --- | --- |
| GET | `/api/v1/smart-money/status` |
| GET | `/api/v1/smart-money/signals` |
| GET | `/api/v1/smart-money/wallets` |
| GET | `/api/v1/smart-money/wallets/:address` |
| WS | `/api/v1/live/smart-money/signals` |
| WS | `/api/v1/live/runtime` |
| WS | `/api/v1/live/events/:eventId` |

## Accounts and alerts

| Method | Route |
| --- | --- |
| POST | `/api/v1/auth/request-link` |
| POST | `/api/v1/auth/verify-link` |
| GET | `/api/v1/auth/me` |
| POST | `/api/v1/auth/logout` |
| GET | `/api/v1/user/me` |
| PATCH | `/api/v1/user/preferences` |
| POST | `/api/v1/telegram/connect` |
| DELETE | `/api/v1/telegram/connect` |
| GET | `/api/v1/alerts/subscriptions` |
| POST | `/api/v1/alerts/subscriptions` |
| PATCH | `/api/v1/alerts/subscriptions/:id` |
| DELETE | `/api/v1/alerts/subscriptions/:id` |
| GET | `/api/v1/alerts/deliveries/recent` |
| POST | `/api/v1/alerts/unsubscribe` |
