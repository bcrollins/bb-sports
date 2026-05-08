# BB Sports First-Party Analytics

Built: 2026-05-08

## Purpose

BB Sports needs launch funnel truth without making GA4, PostHog, or another external tracker the source of record. The first-party analytics ledger stores privacy-filtered behavioral events in BB Sports Postgres.

## Surfaces

- Table: `analytics_events`
- API: `POST /api/analytics`
- Client tracker: `components/AnalyticsTracker.tsx`
- Admin rollup: `/admin/audience`

## Event Coverage

- `page_view`
- `article_view`
- `search_performed`
- `newsletter_signup`
- `newsletter_unsubscribe`
- `donation_interest_created`
- `contact_message_created`
- `comment_submitted`

## Privacy Posture

- No raw emails, names, messages, tokens, passwords, phone numbers, IPs, or raw user agents in event properties.
- IP and user-agent values are hashed server-side when present.
- Search analytics records query length, result count, sport filter, and filtered state, not the raw query text.

## Provider Posture

GREEN. Internal Postgres only. GA4 may remain a top-of-funnel marketing supplement, but the operating dashboard reads BB Sports-owned events.

## Path To 10.0

- Add article reading-depth milestones after scroll-depth thresholds are tuned.
- Add daily rollup materialization once traffic volume warrants it.
- Add zero-result search review to the editorial planning loop.
