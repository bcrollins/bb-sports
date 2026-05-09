# BB Sports State - Stripe Donation Rail

Updated: 2026-05-09

## Slice

Lane 6 / Mode K. Added the Stripe-ready donation rail while preserving first-party supporter intent as the source of record.

## Root Cause

Donations had a public support form and first-party `donation_intents`, but the Stripe side was only an optional payment-link handoff. There was no SDK checkout session creation, raw-body webhook verification, or webhook reconciliation into the internal ledger.

## Implementation

- Added official `stripe@22.1.1` SDK with API version `2026-04-22.dahlia`.
- Added `lib/stripe.ts` for fail-closed donation mode detection, Checkout params, metadata, and webhook helpers.
- Expanded `donation_intents` with Checkout Session, PaymentIntent, customer, amount, currency, and paid timestamp columns.
- Updated `/api/donations` to create first-party intents first, then create Stripe Checkout Sessions when `STRIPE_SECRET_KEY` is configured.
- Added `/api/stripe/webhook` with raw-body signature verification and reconciliation for completed, expired, and failed payment states.
- Bypassed the soft-launch wall for `/api/stripe/webhook` so Stripe can deliver signed webhooks without a browser cookie.
- Updated support return-state messaging, docs, provider posture, env example, and production smoke coverage.
- Added `scripts/prepare-standalone.mjs` so local `npm run start` copies standalone static/public/content assets before launching, matching the Railway Docker runtime.

## Verification

- PASS: `npm run check` (lint, typecheck, 29 node tests, production build).
- PASS: local standalone start copied `.next/static` into `.next/standalone/.next/static`.
- PASS: `PRODUCTION_BASE_URL=http://localhost:3000 BB_PRODUCTION_GATE_COOKIE=bb_gate=1 npm run smoke:production` (16/16; local DB intentionally not configured).
- PASS: Chrome DevTools rendered `/support?status=success` and `/support?status=cancelled` at 393px mobile and `/support?status=success` at 1440px desktop with `bb_gate=1`; no console errors, no network failures, no horizontal overflow.
- Evidence screenshots: `/tmp/bb-support-success-mobile.png`, `/tmp/bb-support-cancelled-mobile.png`, `/tmp/bb-support-success-desktop.png`.
- PASS: PR #14 merged as `c790a8404d9090fe5f429f6e4cf88c5cdd89fdd4`.
- PASS: Railway health reported live commit `c790a8404d9090fe5f429f6e4cf88c5cdd89fdd4` with DB reachable at 2026-05-09T21:46:59Z.
- PASS: `EXPECTED_COMMIT=c790a8404d9090fe5f429f6e4cf88c5cdd89fdd4 npm run smoke:production` passed 16/16 against live Railway.

## Provider Posture

YELLOW. Stripe code is installed and fails closed. Live payments still require tenant secret, webhook secret, and go-live account verification.
