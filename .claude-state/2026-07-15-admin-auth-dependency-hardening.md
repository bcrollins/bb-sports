# Admin Authentication and Dependency Hardening

Date: 2026-07-15
Branch: `agent/admin-auth-dependency-hardening`
Lane: 2 Code Work / Fix
Mode: E Security / auth / privacy
Status: locally verified; production deployment pending merge

## Root Cause

The newsroom trusted middleware and a signed seven-day JWT more than the active database session. Logout wrote `revoked_at`, but authorization never read it. Protected server pages had no local guard, five admin API methods relied only on middleware, and generic site-configuration reads could serialize the access-wall bcrypt hash. The live database also contained a malformed, double-encoded historical access-wall row whose retired credential remained valid.

The dependency floor had drifted to a Next.js release with middleware-auth advisories and the install tree contained critical/high/moderate audit findings.

## Implementation

- Upgraded Next.js and `eslint-config-next` to 15.5.20, PostCSS to 8.5.19, and all transitive esbuild copies to 0.28.1.
- Added `npm run audit:security` at moderate severity to the mandatory `npm run check` release gate.
- Added issuer, audience, purpose, subject, JTI, and role contracts to admin JWTs.
- Made `getCurrentUser` require a matching user/JTI session row whose database expiry is future and `revoked_at` is null, then authorize the current database role.
- Made login persist that authoritative row before issuing the cookie; made logout retain the cookie and return 503 if durable revocation cannot be recorded.
- Added `requireAdminPage` before protected data access on every newsroom server page.
- Added handler-level active-session authorization before every protected admin API read/mutation.
- Replaced unrestricted site-config reads/writes with an allowlisted Zod contract for ticker, hero, about bio, and footer tagline.
- Prevented signature-only/revoked sessions from revealing unapproved media.
- Added an idempotent boot cleanup that removes only malformed string-valued `access_wall` JSONB rows; valid object-valued settings and all unrelated rows are preserved.

## Preservation Affidavit

- Preserved the separate public access wall and newsroom email/password login.
- Preserved every protected admin URL, page, editor, and API operation for active authorized sessions.
- Preserved current `super_admin`, `admin`, and `editor` newsroom roles.
- Preserved the four intended site-content editors and the dedicated access-wall password endpoint.
- Preserved approved public media delivery while tightening only unapproved asset access.
- Preserved all articles, comments, subscribers, contact messages, donation intents, media, analytics, users, valid sessions, and non-wall configuration rows.
- Removed only a malformed historical credential row already proven to authorize the retired password.

## Verification Contract

- Targeted admin security regression suite: seven structural security controls.
- Behavioral JWT tests: current contract accepted; legacy claim-less and wrong-audience tokens rejected.
- Behavioral site-config tests: allowed values accepted; external CTA, secret key, and unknown fields rejected.
- Strict TypeScript, lint, full unit suite, zero-vulnerability audit, Next production build, and standalone start.
- Live proof after merge: exact SHA health, lowercase operator credential accepted, retired credential rejected, boolean cookie rejected, pre-rotation signed cookie rejected after Railway secret rotation, admin/API anonymous denial, and production smoke.

## Rollback

Rollback presentation or DTO changes independently if necessary. Do not roll back active-session checks, route-level authorization, secret redaction, the patched framework floor, or the malformed-credential cleanup. If a login outage occurs, use the separate Railway-managed public-wall operator path for site access while repairing newsroom database/session state; it does not grant publishing authority.
