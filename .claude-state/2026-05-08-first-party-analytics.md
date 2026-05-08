# 2026-05-08 — First-Party Analytics

Branch: `codex/bb-sports-first-party-analytics`

## Scope

Build internal-first analytics capture and admin rollups without adding a new external tracker.

## Implementation

- Added `analytics_events` to Drizzle schema and boot-time Postgres bootstrap.
- Added `/api/analytics` ingestion with privacy-filtered payload validation.
- Added client page/article tracking and search-result tracking.
- Added server-side events for newsletter signup/unsubscribe, contact, donation interest, and comments.
- Added `/admin/audience` analytics rollups.

## Provider Posture

GREEN. Internal Postgres only. No new external provider.

## Verification Target

- `npm run check`
- Live `/api/analytics` accepts an allowed event and rejects invalid event names.
- Live `/admin/audience` remains protected behind admin auth.

## Resume Pointer

Next revenue slice: Stripe webhook reconciliation and supporter ledger once live Stripe tenant credentials are verified.
