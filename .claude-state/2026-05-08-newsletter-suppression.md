# 2026-05-08 — Newsletter Suppression

Branch: `codex/bb-sports-newsletter-suppression`

## Scope

Close the newsletter pipeline gap: signup exists, but first-party unsubscribe/suppression did not.

## Implementation

- Added nullable unique `newsletter_subscribers.unsubscribe_token`.
- Added bootstrap DDL and unique partial index for existing databases.
- Signup creates and preserves a durable unsubscribe token.
- Added `/newsletter/unsubscribe?token=...` page.
- Added `/api/newsletter/unsubscribe` JSON endpoint.
- Gate-bypassed unsubscribe routes in middleware.

## Verification Target

- `npm run check`
- Unsubscribe page invalid-token render without `bb_gate`
- API invalid-token validation without `bb_gate`
- Live deploy health at merged commit

## Resume Pointer

Next pipeline candidate: Resend welcome-email wiring once sender-domain credentials are verified, or first-party article retention analytics.
