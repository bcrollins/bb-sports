# BB Sports Admin Dashboard Operating System

Updated: 2026-05-07

## Purpose

The BB Sports admin is Bradley Benson's no-code control room. It is not a developer console. Brad should be able to publish, edit, protect, and operate the site from a phone or laptop without reading code.

## Shipped Surfaces

- `/admin` — command center with launch meter, article counts, audience pulse, and primary actions.
- `/admin/articles` — article roster with edit, publish, unpublish, delete, and public-view actions.
- `/admin/articles/new` — markdown article editor with live preview, hero metadata, AI-assisted labeling, Brad's Take, and publish controls.
- `/admin/site` — no-code site copy controls for breaking ticker, homepage hero, about bio, and footer tagline.
- `/admin/audience` — first-party ledgers for newsletter subscribers, contact/tip/sponsor messages, and donation interest.
- `/admin/access-wall` — no-code access-wall password rotation for the blank white public wall.
- `/admin/launch` — launch readiness and provider posture.

## Guardrails

- The white access wall only opens public site access. It does not bypass admin authentication.
- AI-assisted pieces cannot publish unless Brad's Take is present.
- Hero images require alt text and credit before saving/publishing.
- Newsletter, contact, and donation-interest records are stored first-party in Postgres before external services are wired.
- The wall default password is `calebwilliamsMVP` until Brad changes it in `/admin/access-wall`.

## Verification Standard

Every admin change must pass:

- `npm run typecheck`
- `npm run test`
- `npm run build`
- Browser verification for `/coming-soon`, `/admin`, `/admin/audience`, `/admin/access-wall`, and one article edit path when credentials are available.
