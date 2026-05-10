# BB Sports State - Newsletter Welcome Rail

Updated: 2026-05-10

## Slice

Lane 4 / Mode C. Added the Resend-gated newsletter welcome rail while preserving BB Sports' first-party subscriber ledger and suppression state as the source of truth.

## Root Cause

Newsletter signup wrote to Postgres and unsubscribe suppression existed, but the welcome-email path was only documented as future work. The signup API also was not gate-bypassed even though the public capture form posts to `/api/newsletter` during soft launch.

## Implementation

- Added direct Resend REST transport helper in `lib/resend.ts`; no new runtime dependency.
- Gated live sends behind `RESEND_API_KEY`, `RESEND_FROM`, and `BBSPORTS_APPROVED_RESEND=true`.
- Added welcome email body plus `List-Unsubscribe` and `List-Unsubscribe-Post` headers pointing to BB Sports' first-party unsubscribe route.
- Added `welcome_provider_id` and `welcome_error` newsletter ledger fields, with idempotent bootstrapping.
- Updated newsletter signup to write the subscriber first, send welcome when approved, record success/failure, and never let transport failure block signup.
- Added `/api/newsletter` GET readiness metadata and production-smoke coverage.
- Bypassed the soft-launch wall for `/api/newsletter` so pre-launch capture can post without a gate cookie.
- Added admin launch visibility for `BBSPORTS_APPROVED_RESEND`.
- Added `docs/NEWSLETTER-WELCOME-RAIL.md` and provider-posture notes.

## Verification

- PASS: `npm run check` (lint, typecheck, 38 node tests, production build).
- PASS: `PRODUCTION_BASE_URL=http://localhost:3000 BB_PRODUCTION_GATE_COOKIE=bb_gate=1 npm run smoke:production` (17/17; local DB intentionally not configured).
- PASS: `GET http://localhost:3000/api/newsletter` returned `welcomeReady=false` and missing `BBSPORTS_APPROVED_RESEND`, `RESEND_API_KEY`, `RESEND_FROM`.
- PASS: local authenticated Chrome DevTools proof for `/admin/launch` at 393px mobile and 1440px desktop; no console errors, no network failures, no horizontal overflow.
- Evidence screenshots: `/tmp/bb-admin-launch-resend-mobile.jpg`, `/tmp/bb-admin-launch-resend-desktop.jpg`.
- PASS: PR #18 merged as `5e9fa239fa7bad17debd0d0064516486bfba9208`.
- PASS: Railway health reported live commit `5e9fa239fa7bad17debd0d0064516486bfba9208` with DB reachable at 2026-05-10T00:07:24Z.
- PASS: `EXPECTED_COMMIT=5e9fa239fa7bad17debd0d0064516486bfba9208 npm run smoke:production` passed 17/17 against live Railway.

## Provider Posture

YELLOW. Resend remains transport-only and disabled by default. BB Sports owns subscriber status, unsubscribe tokens, welcome status, and suppression.

## Sources

- Resend API reference: https://resend.com/docs/api-reference/emails
- Resend List-Unsubscribe guidance: https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails
- Resend custom headers guidance: https://resend.com/docs/dashboard/emails/custom-headers
