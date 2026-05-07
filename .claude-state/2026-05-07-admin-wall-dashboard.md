# 2026-05-07 Admin Wall + Dashboard Slice

Status: media/domain/dashboard slice committed, pushed, deployed to Railway, and live-verified on the Railway-provided domain. Namecheap DNS remains blocked at registrar.

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
- Live Railway deploy: deployment `3b6d9005-9a2b-451e-ac97-ed9d9c54cad3` reached `SUCCESS` for commit `726f81e84452a0cf0da43b67bd9e9828c1082e40` using the Dockerfile manifest, `node server.js`, and `/api/health`.
- Live Railway health: `https://web-production-c65d6.up.railway.app/api/health` returned 200 with commit `726f81e84452a0cf0da43b67bd9e9828c1082e40`, DB configured/reachable.
- Live wall checks: no-cookie `/` redirects to `/coming-soon`; wrong wall password returns 401; `calebwilliamsMVP` returns 200 and sets `bb_gate=1`.
- Live UI checks: `/` and `/about` include the profile icon; `/about` includes Bradley visuals and the founder image; live brand image and Next optimizer both return JPEGs; 393x852 and 1440x1000 live screenshots showed no horizontal overflow.
- Live admin checks: `/admin/media` redirects to `/admin/login?next=%2Fadmin%2Fmedia` without admin session; `/api/admin/media` returns 401 without admin session.

## Added in Current Slice

- `/admin/media` Grok-backed media desk for no-code image/video generation, provider readiness, staged approval, copyable asset URLs, and article hero handoff packets.
- First-party `media_assets` table and public approved-asset streaming route.
- Homepage generated-media rail that renders approved generated assets only and hides cleanly when no approved media exists.
- Bradley brand library in `public/brand/bradley`, surfaced on `/about`, `/admin/site`, and `docs/BRAND-KIT.md`.
- Header profile/login icon visible from public surfaces.
- xAI provider legal posture in `docs/legal/XAI-GROK.md` and `docs/legal/PROVIDER-POSTURE.md`.
- Railway custom-domain records captured in `docs/DOMAIN-DNS.md`; Railway has `bbsports.fans` and `www.bbsports.fans` attached but Namecheap DNS is still parked until registrar records are changed.

## Resume Pointer

Next: apply the exact Namecheap DNS records from `docs/DOMAIN-DNS.md`, add `XAI_API_KEY` and `BBSPORTS_APPROVED_XAI=true` when xAI commercial use is approved, then sign into `/admin/media` as Bradley and generate/approve the first real BB Sports media assets.
