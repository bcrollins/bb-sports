# BB Sports Production Smoke Gate

Built: 2026-05-08

## Purpose

Every shipped interval needs a repeatable live check. `npm run smoke:production` verifies the production Railway app, the soft-launch gate, the first-party search surface, and the analytics write path from outside the process.

## Command

```sh
npm run smoke:production
```

Optional controls:

- `PRODUCTION_BASE_URL=https://web-production-c65d6.up.railway.app`
- `EXPECTED_COMMIT=<git-sha>`
- `BB_PRODUCTION_GATE_COOKIE=bb_gate=1`
- `BB_SMOKE_SEARCH_QUERY=Bears`
- `BB_SMOKE_REQUIRED_TEXT="Why the Bears finally have a real shot"`

## Checks

- `GET /api/health` returns `status=ok`, `service=bb-sports`, and a reachable database when configured.
- `GET /search?q=Bears` without `bb_gate=1` redirects to `/coming-soon` with a `next` value.
- `GET /search?q=Bears` with `bb_gate=1` returns the search page headline and the known Bears article.
- `GET /api/analytics` advertises the POST contract.
- Invalid analytics event names return `400`.
- A valid `page_view` event writes through `POST /api/analytics`.

## Provider Posture

GREEN. This smoke uses only BB Sports-owned production endpoints and the existing Railway deployment. It does not add any external provider.

## Path To 10.0

- Add admin-authenticated smoke coverage once a non-personal smoke account exists.
- Add comments/newsletter/donation write-path smokes with deterministic cleanup.
- Run this automatically after every Railway deploy.
