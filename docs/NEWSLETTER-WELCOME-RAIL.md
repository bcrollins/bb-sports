# Newsletter Welcome Rail

Updated: 2026-05-10

BB Sports owns newsletter consent, status, unsubscribe tokens, and suppression in Postgres. Resend is transport only.

## Modes

- `disabled`: default. Missing `RESEND_API_KEY`, `RESEND_FROM`, or `BBSPORTS_APPROVED_RESEND=true`. Signup still writes the first-party ledger.
- `sent`: Resend accepted the welcome email. `welcome_sent_at` and `welcome_provider_id` are written to `newsletter_subscribers`.
- `failed`: Resend returned an error or the request failed. Signup still succeeds, and `welcome_error` records the operator-visible failure.

## Welcome Email Rules

- Send only once per subscriber row unless `welcome_sent_at` is cleared by an operator.
- Never send without an unsubscribe token.
- Include visible unsubscribe copy in the body.
- Include `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers.
- Unsubscribe links point to `/newsletter/unsubscribe?token=...`, which is gate-bypassed.

## Provider Gate

Production sends require:

- `RESEND_API_KEY`
- `RESEND_FROM`
- `BBSPORTS_APPROVED_RESEND=true`

Do not enable the approval flag until the sending domain is verified and commercial terms remain stored in `docs/legal/PROVIDER-POSTURE.md`.
