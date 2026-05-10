# Admin Root Chrome Isolation

Date: 2026-05-10
Branch: codex/bb-sports-admin-root-chrome
Worktree: /private/tmp/bb-sports-admin-root-chrome
Status: Deployed and live.

## Scope

Lane 9 / Mode H: admin dashboard professionalism and UI/UX hardening.

## Root Cause

The root app layout rendered public site chrome around every route, including `/admin`.
The admin shell used a fixed overlay, so the defect was easy to miss visually, but the public
header, breaking-news strip, footer, analytics tracker, and public links still existed behind
admin pages in DOM/focus order. That doubled the link surface on authenticated `/admin` and made
the newsroom feel like a public page wearing an admin mask.

## Implementation

- Moved public pages into the `(site)` route group while preserving their public URLs.
- Reduced `app/layout.tsx` to document-level metadata, viewport, globals, and `{children}` only.
- Added `app/(site)/layout.tsx` to own the public skip link, breaking-news strip, site header,
  public main landmark, footer, analytics tracker, and NewsMediaOrganization JSON-LD.
- Added `id="main"` to authenticated and unauthenticated admin main landmarks.
- Added `tests/root-chrome.test.ts` to prevent public chrome from returning to root layout.
- Updated the search layout test to read the moved public search route.

## Capability Preserved

- Public URLs preserved: `/`, `/about`, `/articles`, `/articles/[slug]`, `/coming-soon`,
  `/contact`, `/corrections`, `/editorial-standards`, `/newsletter/unsubscribe`, `/podcast`,
  `/search`, `/support`, `/support/terms`, `/videos`.
- Admin URLs preserved: `/admin`, `/admin/login`, and existing admin section links.
- Public homepage chrome preserved on public pages.
- Analytics tracker and organization JSON-LD preserved on public pages only.
- API routes, middleware, auth, donation, newsletter, comments, search, sitemap, and robots paths
  were not moved.

## Verification

- `npm run check`: passed locally before state write.
- Browser plugin: unauthenticated `/admin` redirected to `/admin/login?next=%2Fadmin`, rendered
  the newsroom login, had no public header marker, and logged zero browser errors.
- Authenticated Playwright/Chrome matrix passed for `/admin` and `/`:
  - 375x667, 393x852, 440x956, 820x1180, 1440x1000, 1920x1080.
  - `/admin`: no public primary nav, breaking-news region, footer, or public social link; admin
    nav and admin command-center markers present; no horizontal overflow.
  - `/`: public primary nav, breaking-news region, footer, and X link present; admin nav and
    operator queue absent; no horizontal overflow.
- Screenshots written:
  - `/tmp/bb-root-chrome-admin-iphone-se.jpg`
  - `/tmp/bb-root-chrome-admin-iphone-standard.jpg`
  - `/tmp/bb-root-chrome-admin-iphone-pro-max.jpg`
  - `/tmp/bb-root-chrome-admin-ipad.jpg`
  - `/tmp/bb-root-chrome-admin-desktop-1440.jpg`
  - `/tmp/bb-root-chrome-admin-desktop-1920.jpg`
  - matching `/tmp/bb-root-chrome-home-*` screenshots.
- Local production smoke: `PRODUCTION_BASE_URL=http://localhost:3000 BB_PRODUCTION_GATE_COOKIE=bb_gate=1 npm run smoke:production` passed 17/17.
- Provider posture: no new provider added. `npm audit --audit-level=high` passed; remaining advisories are moderate dev/build-tool advisories.

## Deployment Status

- PR: https://github.com/bcrollins/bb-sports/pull/22
- Local commit: `8103348f6766a59c5c165827444b3c6a27cd002d`
- Merged commit on `main`: `fb498243762ffdc1edac9ced2efd03208915ea39`
- Live `/api/health`: `fb498243762ffdc1edac9ced2efd03208915ea39`, DB configured and reachable.
- Live production smoke: `PRODUCTION_BASE_URL=https://web-production-c65d6.up.railway.app BB_PRODUCTION_GATE_COOKIE=bb_gate=1 npm run smoke:production` passed 17/17.
- Live route check:
  - `/admin` with `bb_gate=1` redirects 307 to `/admin/login?next=%2Fadmin`.
  - `/admin/login?next=%2Fadmin` contains the newsroom marker and does not contain public primary
    nav, breaking-news region, or footer.
  - `/` contains public primary nav, breaking-news region, and footer, and does not contain the
    admin nav.

## Resume Pointer

Next admin-dashboard slice can build on the isolated route shells. The admin/public chrome leak is
closed live; do not reintroduce public site chrome in `app/layout.tsx`.
