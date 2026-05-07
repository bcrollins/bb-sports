# 2026-05-07 Admin Wall + Dashboard Slice

Status: media/domain/dashboard slice code complete, local checks passing, pending commit/push/Railway deploy/live proof.

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
- `npm run check`: lint, typecheck, tests, and production build pass after the Grok media desk and Bradley brand assets.
- Local browser fallback verification: 393x852 and 1440x1000 screenshots for `/`, `/about`, and `/admin/media` redirect path; no horizontal overflow; profile icon visible; Bradley founder photo upright.
- Local gate/API checks: `bb_gate` wall opens with `calebwilliamsMVP`; `/api/admin/media` returns 401 without admin session; `/admin/media` redirects to `/admin/login?next=%2Fadmin%2Fmedia`.
- xAI fail-closed check: `generateXaiImages` returns 503 until `XAI_API_KEY` and `BBSPORTS_APPROVED_XAI=true` are configured.

## Added in Current Slice

- `/admin/media` Grok-backed media desk for no-code image/video generation, provider readiness, staged approval, copyable asset URLs, and article hero handoff packets.
- First-party `media_assets` table and public approved-asset streaming route.
- Homepage generated-media rail that renders approved generated assets only and hides cleanly when no approved media exists.
- Bradley brand library in `public/brand/bradley`, surfaced on `/about`, `/admin/site`, and `docs/BRAND-KIT.md`.
- Header profile/login icon visible from public surfaces.
- xAI provider legal posture in `docs/legal/XAI-GROK.md` and `docs/legal/PROVIDER-POSTURE.md`.
- Railway custom-domain records captured in `docs/DOMAIN-DNS.md`; Railway has `bbsports.fans` and `www.bbsports.fans` attached but Namecheap DNS is still parked until registrar records are changed.

## Resume Pointer

Next: commit and push to `main`, wait for Railway deploy, and verify live `/api/health`, wall behavior, public gated access, Bradley images, `/about`, `/admin/media` redirect, and `/api/admin/media` 401 without admin session. Namecheap still needs the exact DNS records from `docs/DOMAIN-DNS.md` applied at the registrar.
