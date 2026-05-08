# 2026-05-08 — Production Start Command

Branch: `codex/bb-sports-start-command`

## Scope

Fix the repo production start command after verification exposed that `npm run start` referenced a missing root `server.js`.

## Root Cause

`next.config.mjs` uses `output: 'standalone'`, which emits the production server at `.next/standalone/server.js`. `package.json` still pointed at `server.js` in the repo root.

## Implementation

- Updated `npm run start` to execute `node .next/standalone/server.js`.

## Verification

- `PORT=3000 node .next/standalone/server.js`
- `GET /api/health` returned 200 locally.
- `GET /search?q=Bears` with `bb_gate=1` returned 200 locally.

## Resume Pointer

Continue launch-hardening with Stripe webhook reconciliation after tenant credentials are verified.
