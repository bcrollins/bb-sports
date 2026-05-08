# BB Sports State - Production Smoke Gate

Updated: 2026-05-08

## Slice

Lane 2 / Mode E. Added a repeatable production smoke gate for deploy truth after each shipped interval.

## Root Cause

Production verification had been manual curl/browser work per slice. That proved the live behavior, but it made the next deploy more dependent on operator memory than repo-owned release tooling.

## Implementation

- Added `scripts/smoke-production.mjs`.
- Added `npm run smoke:production`.
- Added static contract coverage in `tests/production-smoke.test.ts`.
- Documented the gate in `docs/PRODUCTION-SMOKE.md`.
- Updated provider posture to record the smoke gate as first-party/GREEN.

## Verification

Local and live checks before commit:

- `npm run check` passed: lint, typecheck, 22 tests, production build.
- `npm run smoke:production` passed against `https://web-production-c65d6.up.railway.app`: health, gate redirect, gated search, analytics GET, analytics validation guard, analytics write.
- Commit, push, PR, merge, deploy verify pending.

## Resume Pointer

Run the production smoke gate against `https://web-production-c65d6.up.railway.app` with `EXPECTED_COMMIT` set to the deployed commit after merge.
