# 2026-05-08 — Comments Community Pipeline

Branch: `codex/bb-sports-comments-pipeline`

## Scope

Ship the internal comments pipeline required before article-page pipeline status can move toward GREEN.

## Implementation

- Added first-party `comments` schema and bootstrap DDL.
- Added public comments API under `/api/articles/[slug]/comments`.
- Added article-page comments UI with loading, empty, error, reply, and moderated-submit states.
- Added `/admin/comments` moderation queue.
- Added admin moderation API for approve, flag, hide, and spam.
- Added rules-based moderation and persistent DB-backed IP rate limiting.

## Verification Target

- `npm run check`
- Public article page render across mobile and desktop.
- Live comments GET route behind the access gate.
- Public POST validation/fail-closed behavior without creating fake public engagement.

## Resume Pointer

Next after this slice: wire newsletter unsubscribe/welcome-state controls or add first-party analytics rollups for article retention and support conversion.
