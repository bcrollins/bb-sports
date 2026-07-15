# BB Sports Admin Dashboard Operating System

Updated: 2026-05-10

## Purpose

The BB Sports admin is Bradley Benson's no-code control room. It is not a developer console. Brad should be able to publish, edit, protect, and operate the site from a phone or laptop without reading code.

## Shipped Surfaces

- `/admin` — command center with readiness verdict, weighted launch gates, provider posture, P0/P1 operator queue, article risk cues, audience pulse, and primary actions.
- `/admin/articles` — article roster with edit, publish, unpublish, delete, and public-view actions.
- `/admin/articles/new` — markdown article editor with live preview, hero metadata, AI-assisted labeling, Brad's Take, and publish controls.
- `/admin/media` — Grok-backed media desk for staged AI images and motion clips, with approval controls before public placement.
- `/admin/comments` — first-party article comment moderation with approve, flag, hide, and spam actions.
- `/admin/site` — no-code site copy controls for breaking ticker, homepage hero, about bio, and footer tagline.
- `/admin/audience` — first-party ledgers for newsletter subscribers, contact/tip/sponsor messages, and donation interest.
- `/admin/access-wall` — no-code access-wall password rotation for the blank white public wall.
- `/admin/launch` — launch readiness and provider posture.

## Guardrails

- The white access wall only opens public site access. It does not bypass admin authentication.
- `/admin/login` and `/api/admin/login` are **not** blocked by the soft-launch wall. Brad signs in with his newsroom email/password only. Unauthenticated visits to other `/admin/*` paths redirect to login (not the white wall).
- Railway `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` are upserted on every boot. Rotating the hash in Railway restores Brad’s login after redeploy.
- AI-assisted pieces cannot publish unless Brad's Take is present.
- Hero images require alt text and credit before saving/publishing.
- Generated media fails closed until xAI is commercially approved and configured, and public surfaces render approved assets only.
- Public article comments render approved rows only; spam and flagged rows stay in the newsroom queue.
- Newsletter, contact, and donation-interest records are stored first-party in Postgres before external services are wired.
- Newsletter unsubscribe tokens are first-party and gate-bypassed; Resend is transport only, not the suppression source of truth.
- The operator recovery password lives only in Railway. Brad can add an admin-managed password in `/admin/access-wall`; neither credential is rendered or committed.

## Command Center Contract

`/admin` is driven by `lib/admin-command-center.ts`, not by hard-coded dashboard vibes. The model converts existing runtime truth into:

- Readiness verdict: `Ship`, `Watch`, or `Block`.
- Weighted readiness score: anchor articles, draft queue, newsletter ledger, comment queue, donation rail, welcome email, first-party analytics, and admin auth.
- Provider posture: Postgres, admin JWT, Stripe checkout/webhook, Resend, xAI, and R2 without exposing secret values.
- Ranked operator actions: P0/P1/P2 items with a named owner, reason, destination, and CTA.
- Operating lanes: Editorial, Community, Audience, Revenue, Providers.

This keeps the dashboard from becoming decoration. If a provider, queue, or launch gate regresses, the first screen should tell Brad or Brandon exactly where to click next.

## Verification Standard

Every admin change must pass:

- `npm run typecheck`
- `npm run test`
- `npm run build`
- Browser verification for `/admin` at the primary mobile breakpoint and desktop.
- Adjacent browser verification for `/admin/launch` or `/admin/audience` when the command model or provider/audience data changes.
- Protected-route proof: unauthenticated admin routes redirect to `/admin/login`, authenticated admin routes render with a valid session cookie.
