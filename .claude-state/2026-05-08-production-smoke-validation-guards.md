# BB Sports State - Production Smoke Validation Guards

Updated: 2026-05-08

## Slice

Lane 2 / Mode E. Expanded `npm run smoke:production` to prove public write endpoints reject malformed payloads without creating production reader records.

## Root Cause

The smoke gate covered analytics validation but not newsletter, contact, donation, or comment validation. Those endpoints are launch-critical because they face public traffic before Brad has a full operations team.

## Implementation

- Added invalid-payload checks for `/api/newsletter`, `/api/contact`, `/api/donations`, and `/api/articles/[slug]/comments`.
- Added a per-run test-net `X-Forwarded-For` header so newsletter/contact rate limits do not make repeated release smokes flaky.
- Updated production smoke docs and source-level contract tests.

## Verification

Local and pre-merge live checks:

- `npm run check` passed: lint, typecheck, 22 tests, production build.
- `npm run smoke:production` passed 14/14 against `https://web-production-c65d6.up.railway.app` while it served commit `e99b725cf9f9ad638a876ef61bacbd879ce22f38`.
- Commit, push, PR, merge, deploy verify with `EXPECTED_COMMIT` pending.

## Resume Pointer

After merge, wait for Railway `/api/health` to report the merged SHA, then run `EXPECTED_COMMIT=<sha> npm run smoke:production`.
