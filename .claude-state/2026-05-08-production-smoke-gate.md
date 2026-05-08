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

- `npm run check` passed: lint, typecheck, 22 tests, production build.
- Pre-merge `npm run smoke:production` passed against `https://web-production-c65d6.up.railway.app`: health, gate redirect, gated search, analytics GET, analytics validation guard, analytics write.
- PR #8 merged by squash to `3f88b1aa4638545068f02ee531e4122b26c20819`.
- Railway live health returned commit `3f88b1aa4638545068f02ee531e4122b26c20819` with DB reachable.
- `EXPECTED_COMMIT=3f88b1aa4638545068f02ee531e4122b26c20819 npm run smoke:production` passed 6/6 against the live deployment.

## Resume Pointer

Next release interval should run `EXPECTED_COMMIT=<deployed-sha> npm run smoke:production` after Railway advances.
