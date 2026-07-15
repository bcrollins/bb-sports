# Signed Access Wall and Shell Isolation

Date: 2026-07-15
Branch: `agent/lowercase-signed-access-wall`
Lane: 2 Code Work / Fix
Mode: E Security / auth / privacy
Status: locally verified; production deployment pending merge

## Root Cause

The soft-launch credential was committed as a fallback, Railway used the same value, and middleware accepted the forgeable one-year cookie `bb_gate=1`. Credential rotation therefore could not revoke existing visitors. The `/coming-soon` route also lived inside the public `(site)` layout: a fixed white layer hid the public chrome visually, but the ticker, header, footer, analytics, and links remained in the DOM and keyboard focus order.

## Implementation

- Removed every committed/default access-wall credential and made Railway `GATE_PASSWORD` the operator recovery credential.
- Preserved the admin-managed bcrypt credential as an additional wall credential without weakening the separate newsroom login.
- Added `GATE_COOKIE_SECRET` and HS256-signed access-wall cookies with issuer, audience, subject, purpose, expiration, httpOnly, secure-in-production, Strict SameSite, and high-priority attributes.
- Middleware now cryptographically verifies the wall cookie. The retired boolean cookie is rejected.
- Moved `/coming-soon` outside the public site route group so only the white wall form is rendered.
- Updated the production smoke harness to exchange a password for a fresh signed cookie.
- Added focused credential, cookie-rotation, route-shell, and smoke-contract regression tests.

## Preservation Affidavit

- Preserved the `/coming-soon` URL and `next` redirect behavior.
- Preserved the one-field wall form and server-side password validation.
- Preserved the separate `/admin/login` newsroom credential and all admin URLs.
- Preserved Brad-managed additional wall passwords in `site_config`.
- Preserved gate bypasses for health, newsletter intake/unsubscribe, rankings, Stripe webhook, RSS, sitemap, robots, and static assets.
- No public or admin capability was dropped.

## Verification

- PASS: `npm run check` — lint, strict typecheck, 86/86 tests, and Next production build.
- PASS: production-mode local smoke — 18/18 checks with the Brandon-approved lowercase Railway credential.
- PASS: retired `Cookie: bb_gate=1` receives a 307 redirect to `/coming-soon`.
- PASS: Playwright wall matrix at 375x667, 393x852, 440x956, 820x1180, 1440x1000, and 1920x1080.
- PASS: every wall viewport had exact viewport/scroll width, one access form, zero links, zero public header/footer, and zero breaking-news region.
- PASS: the lowercase credential issued a signed httpOnly cookie and routed to `/admin/login`, not through newsroom authentication.
- PASS: `/admin/login` matrix at the same six viewports had exact viewport/scroll width, newsroom UI present, no wall form, and no public chrome.
- PASS: zero browser console errors.

## Provider Posture

No new external provider. Signing uses the existing `jose` runtime dependency. `GATE_PASSWORD` and `GATE_COOKIE_SECRET` are Railway-only values and are not exposed by readiness endpoints or admin UI.

## Deployment Checklist

1. Set the Brandon-approved lowercase `GATE_PASSWORD` in Railway production.
2. Set a unique 32-byte-or-longer `GATE_COOKIE_SECRET` in Railway production.
3. Merge to `main` and wait for Railway `web` to report the merge SHA.
4. Run the 18-check production smoke with `BB_PRODUCTION_GATE_PASSWORD`.
5. Repeat the wall/admin-login device matrix against the live Railway URL.

## Path to 10.0

Next security interval: patch the current Next.js middleware advisories, enforce route-level admin authorization independent of middleware, and clear all high/critical production dependency findings. Next editorial-pipeline interval: reconcile filesystem and Postgres article inventories so homepage, archive, search, RSS, sitemap, and direct routes expose the same approved corpus.

## Resume Pointer

After this interval is live, start from `main`, confirm no open PR/deploy is in flight, and execute the Next.js/admin defense-in-depth interval before any presentation work.
