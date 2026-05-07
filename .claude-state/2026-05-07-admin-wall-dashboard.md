# 2026-05-07 Admin Wall + Dashboard Slice

Status: code complete, local checks passing, pending push/deploy/live proof.

## Shipped Locally

- Replaced the branded soft-launch page with a plain white access wall.
- Default wall password: `calebwilliamsMVP`.
- Middleware now applies the wall before admin login; admin sessions still bypass the wall, and admin auth remains separate.
- Added `/admin/access-wall` for no-code password rotation.
- Rebuilt `/admin` into a command center with launch meter, article counts, audience pulse, and action routing.
- Added `/admin/audience` for newsletter/contact/donation-interest ledgers.
- Added `/admin/launch` for launch/provider posture.
- Persisted newsletter subscribers, contact messages, and donation intents in Postgres.
- Added Zod validation and API guardrails for intake and article publishing.
- Blocked publishing AI-assisted pieces without Brad's Take.
- Required hero alt text and credit when an article has a hero image.
- Upgraded Next to 15.5.15 and Drizzle ORM to 0.45.2.

## Verified Locally

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm audit --json`: no high or critical advisories; 6 moderate advisories remain.

## Resume Pointer

Next: browser/device verification, then commit, push to `main`, wait for Railway deploy, and verify live `/api/health`, wall behavior, public gated access, and admin redirects.
