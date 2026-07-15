# BB Sports service level objectives

**Audience:** Brandon (operator)  
**Status:** Living document — targets are honest for a soft-launch personal publication.

## Product SLOs (reader-facing)

| Journey | SLI | Target | Window | Notes |
| --- | --- | --- | --- | --- |
| Process live | `GET /api/health/live` returns 200 | 99.9% | 30d | Process only |
| Ready | `GET /api/health/ready` returns 200 when DB required | 99.5% | 30d | Soft-launch may tolerate short deploys |
| Public article | Gated article HTML 200 after wall | 99% | 30d | Exclude wall misconfig |
| Search | `GET /api/search?q=` 200 | 99% | 30d | |
| Publish-to-live | Brad publish → public URL shows revision | ≤ 5 min | each event | Railway deploy not in path for content |

## Explicit non-goals (until commercial)

- Live scores availability (fail closed until approved)
- Resend welcome delivery (fail closed until approved)
- Stripe donations (fail closed until approved)

## Alerting floors (manual until pager wired)

1. **Ready 503 > 5 min** — check Railway + DATABASE_URL + Postgres.
2. **Smoke 25/25 fails after deploy** — roll back per `docs/operations/ROLLBACK.md`.
3. **Wall lockout** — gate rate limit / credential rotation.

## Measurement

- Probe: `npm run smoke:production` with `EXPECTED_COMMIT` after every production deploy.
- Status page: `/status` (human) + `/api/health/*` (machine).
- Release pin: public `release.commit` on `/api/health`.

## Review cadence

Monthly: re-read targets after traffic appears; never invent green lights for unproven providers.
