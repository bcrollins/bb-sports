# 2026-05-08 — First-Party Search

Branch: `codex/bb-sports-first-party-search`

## Scope

Close the launch-readiness search gap with a named public search page and JSON API.

## Implementation

- Added `lib/search.ts` for deterministic ranked article search.
- Added `/search` page.
- Added `/api/search` endpoint.
- Added named header/footer links and sitemap entry.
- Added docs and tests.

## Verification Target

- `npm run check`
- Browser proof for `/search?q=Bears` on mobile and desktop.
- Live `/api/search?q=Bears` returns the Bears article after deployment.

## Resume Pointer

Next internal-first candidate: first-party article/support analytics rollups, then Stripe webhook reconciliation once tenant credentials are verified.
