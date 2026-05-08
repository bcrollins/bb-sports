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
- `BB_SMOKE_ARTICLE_SLUG=why-the-bears-finally-have-a-real-shot`
- `BB_SMOKE_ARTICLE_TITLE="Why the Bears finally have a real shot"`
- `BB_SMOKE_IP=198.51.100.10` for public write validation guard rate-limit isolation.

## Checks

- `GET /api/health` returns `status=ok`, `service=bb-sports`, and a reachable database when configured.
- `GET /search?q=Bears` without `bb_gate=1` redirects to `/coming-soon` with a `next` value.
- `GET /search?q=Bears` with `bb_gate=1` returns the search page headline and the known Bears article.
- `GET /api/search?q=Bears` returns JSON results including the known Bears article.
- `GET /articles/why-the-bears-finally-have-a-real-shot` returns the headline, byline, and editorial note.
- `GET /api/articles/why-the-bears-finally-have-a-real-shot/comments` returns the public comments array without creating reader data.
- `GET /sitemap.xml` includes the known article and search route.
- Invalid newsletter, contact, donation, and comment payloads return `400` without creating production records.
- `GET /api/analytics` advertises the POST contract.
- Invalid analytics event names return `400`.
- A valid `page_view` event writes through `POST /api/analytics`.

## Provider Posture

GREEN. This smoke uses only BB Sports-owned production endpoints and the existing Railway deployment. It does not add any external provider.

## Path To 10.0

- Add admin-authenticated smoke coverage once a non-personal smoke account exists.
- Add newsletter/donation success-path smokes with deterministic cleanup.
- Run this automatically after every Railway deploy.
