# BB Sports Comments And Community Pipeline

Built: 2026-05-08

## Purpose

Article comments are now a first-party BB Sports system, not a placeholder and not an external embed. The target is simple: readers can respond to a take, reply in-thread, and Brad can moderate from the newsroom OS before public trust gets damaged.

## Source Of Truth

- Table: `comments`
- Public API: `/api/articles/[slug]/comments`
- Admin action API: `/api/admin/comments/[id]`
- Public UI: article pages under `#comments`
- Admin UI: `/admin/comments`

## Public Behavior

- Approved comments render publicly.
- Clean comments are approved by rules-based moderation immediately.
- Spam, gambling-promo, excessive-link, excessive-caps, and review-keyword comments are stored but do not render publicly until approved.
- Reply targets must be approved comments on the same article.
- Public responses never include email, IP address, user agent, or moderation metadata.

## Moderation

The first-pass moderation layer lives in `lib/comment-moderation.ts` and is intentionally first-party. It is not a fake engagement system and it does not invent comments.

Rules:

- More than one link: spam.
- Gambling-promo / sportsbook / guaranteed-pick language: spam.
- Manual-review terms: flagged.
- Excessive caps: flagged.
- Everything else: approved.

## Rate Limit

Comment posting is capped at 5 comments per IP per 10 minutes using the first-party comments table. That survives server restarts and avoids the in-memory-only trap.

## Launch Posture

GREEN when:

- `DATABASE_URL` is configured.
- `/api/articles/[slug]/comments` returns approved comments.
- Posting a clean comment returns `201`.
- Posting a moderated comment returns `202` or spam status without rendering publicly.
- `/admin/comments` can approve, flag, hide, or mark spam.

YELLOW / degraded when:

- Database is absent in local development. The API returns `503`, the UI renders a clear unavailable state, and the app does not fake comment counts.

## Path To 10.0

- Add daily flagged-comment digest to Brad.
- Add commenter reputation once real volume exists.
- Add per-article moderation filters and bulk actions.
- Add AI-assisted classification only after commercial/provider terms are documented and gated.
