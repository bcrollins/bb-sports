# BB Sports State - Donation Admin Ledger

Updated: 2026-05-09

## Slice

Lane 9 / Mode C. Expanded the admin audience ledger so Stripe donation reconciliation is visible after Checkout and webhook events begin moving money.

## Root Cause

The Stripe donation rail could mark first-party donation intents as checkout-open, paid, expired, or failed, but the admin audience dashboard still treated donation rows like a pre-Stripe waitlist. Brad and Brandon needed internal visibility into open checkout sessions, paid totals, failed rails, and compact Stripe references.

## Implementation

- Added `lib/donation-ledger.ts` for operator-readable donation status labels, badge tones, money formatting, compact Stripe IDs, and ledger summaries.
- Expanded `getAudienceSnapshot()` with donation open, paid, failed, and gross paid counters from `donation_intents`.
- Updated `/admin/audience` with support gross, checkout-open, paid summary, received amount, paid timestamp, session, payment intent, customer, source, and updated-time fields.
- Updated `/admin` overview inbox note to show donation wait and paid counts together.
- Added `tests/donation-ledger.test.ts` for donation lifecycle labels, display formatting, Stripe reference compaction, and summary math.

## Verification

- PASS: `npm run check` (lint, typecheck, 32 node tests, production build).
- PASS: local authenticated Chrome DevTools proof for `/admin/audience` at 393px mobile and 1440px desktop using a valid local `bb_session`; no console errors, no network failures, no horizontal overflow.
- Evidence screenshots: `/tmp/bb-admin-audience-mobile.png`, `/tmp/bb-admin-audience-desktop.png`.
- PASS: `PRODUCTION_BASE_URL=http://localhost:3000 BB_PRODUCTION_GATE_COOKIE=bb_gate=1 npm run smoke:production` (16/16; local DB intentionally not configured).
- PASS: PR #16 merged as `c8b68e7d19bb081807c7245c5a64238bbe8e01a1`.
- PASS: Railway health reported live commit `c8b68e7d19bb081807c7245c5a64238bbe8e01a1` with DB reachable at 2026-05-09T21:59:26Z.
- PASS: `EXPECTED_COMMIT=c8b68e7d19bb081807c7245c5a64238bbe8e01a1 npm run smoke:production` passed 16/16 against live Railway.

## Provider Posture

YELLOW. This is internal-first admin visibility over the Stripe rail. Stripe remains fail-closed until live tenant secret and webhook secret are configured.
