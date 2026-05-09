# BB Sports Stripe Donation Rail

Built: 2026-05-09

## Purpose

Reader support must never create a paywall, editorial influence, or an off-ledger payment path. BB Sports now owns the supporter intent record first, then opens Stripe Checkout only when the Stripe tenant is configured.

## Runtime Modes

- `disabled`: no `STRIPE_SECRET_KEY` and no valid HTTPS `STRIPE_DONATION_LINK`. The API records supporter interest only when an email is supplied.
- `payment_link`: no SDK checkout, but a valid HTTPS `STRIPE_DONATION_LINK` exists. The first-party donation intent is still recorded before returning the link.
- `checkout`: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` both exist. BB Sports creates a Checkout Session with the donation intent ID in session and PaymentIntent metadata.

## Routes

- `GET /api/donations`: reports donation mode without exposing secrets.
- `POST /api/donations`: validates supporter input, writes `donation_intents`, then opens Stripe Checkout when configured.
- `GET /api/stripe/webhook`: reports webhook readiness and handled event names.
- `POST /api/stripe/webhook`: reads `await req.text()` and verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET` before touching the ledger.

## Webhook Events

- `checkout.session.completed`: marks the donation intent `paid` and stores session, payment intent, customer, currency, amount, and paid timestamp.
- `checkout.session.expired`: marks the intent `checkout_expired`.
- `payment_intent.payment_failed`: marks the intent `payment_failed` when metadata identifies a donation intent.

## Provider Posture

Stripe SDK `22.1.1` is MIT licensed and uses API version `2026-04-22.dahlia`. Stripe remains YELLOW until the live BB Sports tenant, webhook secret, and go-live terms are verified.

## Path To 10.0

- Add a deterministic success-path smoke after a Stripe test tenant is connected.
- Add admin refund/reconciliation controls after Stripe live payments are approved.
- Add receipt email through Resend once the sending domain is verified.
