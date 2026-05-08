# BB Sports Newsletter Suppression

Built: 2026-05-08

## Purpose

Newsletter signup was already first-party. This slice adds the missing exit path: every subscriber row gets a durable one-click unsubscribe token, and suppression lives in BB Sports before Resend is used as email transport.

## Source Of Truth

- Table: `newsletter_subscribers`
- Column: `unsubscribe_token`
- Public page: `/newsletter/unsubscribe?token=...`
- API: `/api/newsletter/unsubscribe`

## Behavior

- Tokens are 24 random bytes rendered as 48 hex characters.
- Signup preserves an existing token when a reader signs up again.
- Unsubscribe sets `status = unsubscribed`, records `unsubscribed_at`, and keeps the row for consent/suppression history.
- The unsubscribe page and API bypass the pre-launch gate so future email links still work.
- Invalid tokens return a clear error and do not expose subscriber data.

## Resend Boundary

Resend remains transport only. BB Sports owns the list, status, consent text/version, signup count, and suppression state.

## Path To 10.0

- Send Resend welcome email only after sender domain is verified.
- Include the one-click unsubscribe URL in every BB Sports email.
- Add admin resend/welcome status filters after real newsletter volume exists.
