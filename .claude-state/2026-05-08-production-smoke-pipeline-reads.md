# BB Sports State - Production Smoke Pipeline Reads

Updated: 2026-05-08

## Slice

Lane 2 / Mode E. Expanded `npm run smoke:production` from health/search/analytics basics into read-only editorial pipeline coverage.

## Root Cause

The first smoke gate proved deploy health and one search HTML path, but it did not yet prove that the CMS-to-article render, search API JSON, comments read path, and sitemap were live after deploy.

## Implementation

- Added search API JSON coverage for the known Bears article.
- Added article page render coverage for headline, byline, and editorial note.
- Added comments GET coverage without creating reader data.
- Added sitemap coverage for the known article and search route.
- Updated smoke docs and static smoke contract test coverage.

## Verification

Local and pre-merge live checks:

- `npm run check` passed: lint, typecheck, 22 tests, production build.
- `npm run smoke:production` passed 10/10 against `https://web-production-c65d6.up.railway.app` while it served commit `8b0fb99640cae1173db28279b8a0551155cf9ce8`.
- Commit, push, PR, merge, deploy verify with `EXPECTED_COMMIT` pending.

## Resume Pointer

After merge, wait for Railway `/api/health` to report the merged SHA, then run `EXPECTED_COMMIT=<sha> npm run smoke:production`.
