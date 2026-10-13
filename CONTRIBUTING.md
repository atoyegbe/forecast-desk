# Contributing to Quorum

Thanks for helping improve Quorum. For a significant change, open an issue first
so the approach can be discussed. Small fixes can go directly to a pull request.

## Set up locally

Use Node.js 22, npm, and Docker. From the repository root:

```bash
npm --prefix backend ci
npm --prefix frontend ci
cp backend/.env.example backend/.env
make dev
```

Open <http://localhost:5173>. The default local setup starts PostgreSQL and
Redis through Docker Compose. See the [development guide](docs/development.md)
for port overrides and test database setup.
Keep real credentials in local `.env` files or deployment secrets; never commit
them, database exports, or private user data.

## Checks before a pull request

```bash
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run build
```

Describe the behavior you changed and the checks you ran. Include screenshots
for visible UI changes. Keep provider-specific payload handling in `backend/`;
the frontend should consume Quorum's API contract.

By submitting a contribution, you agree that it may be distributed under the
repository's [MIT License](LICENSE).
