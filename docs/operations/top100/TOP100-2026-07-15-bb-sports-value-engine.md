# BB Sports Top-100 Value Engine

Date: 2026-07-15  
Ledger state: Outline complete; implementation states intentionally begin Pending  
Production system: Next.js 15 App Router, TypeScript, Drizzle/Postgres, Railway, responsive web  
Canonical production: https://bbsports.fans

## Truth Model

- Goal: make Brad Benson's fan-first sports publication trustworthy, simple, fast, commercially clean, and operable by one non-developer editor without letting automation replace his voice.
- Users: readers on phones first; Brad as the sole editor/admin; Brandon as operator. Activation is clear the soft-launch wall, read a take, subscribe/comment/support, and return. Admin activation is clear the wall, authenticate, see the queue, edit, preview, explicitly publish, and verify live.
- Trust-critical surfaces: article catalog and rendering, editorial approval/corrections, admin authentication, newsletter consent/suppression, comments, confidential tips, donation reconciliation, provider licensing, deploy provenance, and mobile accessibility.
- Current truth: the repo is web-only; docs explicitly say the v1 product has no iOS shell (docs/BB-SPORTS-PERFECTION-ENGINE-v1.0.md:244-245). Therefore iOS/TestFlight is N/A for every item unless a future, separately approved native target exists. The required device matrix is responsive browser verification at 375x667, 393x852, 440x956, 820x1180, 1440x1000, and 1920x1080.
- Data truth: Postgres is canonical at runtime, but the 2026-07-15 live audit found 5 published DB articles while content/articles contains 11; sitemap exposed 11 while RSS/search/home/archive exposed 5. Six direct article routes fell back to files but could not accept comments. Real rows must be reconciled in place, never truncated or reseeded.
- Platform truth: there is no Supabase client, tenant layer, RLS policy, iOS project, or aviation domain in this repository. Postgres access is server-only through Drizzle; authorization is enforced in application code. Any future multi-user reader data requires explicit ownership constraints and row-scoped queries before launch, not invented Supabase SQL.
- Provider truth: Railway and Postgres are active. Stripe, Resend, xAI, R2, analytics salt, and a commercial live-score feed are not proven production-ready. Provider-backed UI must fail closed until approval, credentials, terms, and a live test are all present.
- Editorial hard limit: no article is published or materially rewritten without Brad's explicit approval. This ledger may quarantine, draft, flag, or queue corrections; it may not silently publish prose.
- Preservation rule: each implementation interval must preserve existing published routes, real subscriber/contact/comment/donation rows, Brad's approval authority, and the signed access-wall recovery path. Every rollback named below is additive/reversible unless an audited migration says otherwise.

## ESPN Path Truth Model (2026-07-15 continuation)

Goal: take BB Sports from soft-launch personal sports media to **ESPN-website caliber** public surfaces — not by cloning ESPN chrome, but by matching (then beating) its reader-trust floors: always-on reliability, honest labeling, mobile-first scan, complete SEO/feed contracts, and a newsroom that never ships fake urgency or unlicensed scores.

Users: phone-first sports fans; Brad as sole editor; Brandon as operator.

ESPN parity pillars (mapped to this ledger):
1. Trust/security — wall, admin auth, CSP, rate limits, consent (#1–#13) 
2. Editorial integrity — desk labels, sources, corrections, Brad approval (#14–#16, #40–#48)
3. Catalog completeness — DB/sitemap/RSS/search parity (#6, #54–#60)
4. Glanceable UX — homepage, rankings truth, empty/error states (#60–#65)
5. Scale rails — licensed scores only when commercial (#18), donations/newsletter when proven (#34–#39)
6. Ops excellence — health/status/SLO/rollback (#70–#73)

iOS: N/A (web-only v1). Supabase: N/A (Postgres/Drizzle).

Live SHA at ledger refresh start: see `/api/health`.

## Scoring Method

PRIORITY = (10.0 minus current score) x launch criticality divided by execution cost, rounded to two decimals. Launch criticality is 3 for a P0 that can expose data, publish wrong content, break access, or corrupt money/consent; 2 for a launch P1; 1 for a post-launch P2. Execution cost is estimated at 1 for a narrow patch, 2 for a coherent multi-file interval, 3 for a schema/workflow interval, and 4 for an external-provider or editorial dependency. Ties are ordered by blast radius, irreversible harm, reader trust, then operator time saved. Scores describe verified current behavior, not code intent.

## Ranked Ledger

#1 — Retire the legacy access-wall hash and rotate every gate secret
Area: Access wall Anchor: publishing-reliability benchmark
Score: 2.0 → 10.0 PRIORITY: 12.00 Launch-critical: yes
Problem: The required lowercase Railway password can coexist with an older DB bcrypt hash, leaving an unknown legacy password valid; long-lived cookies also survive until the signing key changes.
Evidence: lib/access-wall.ts:28-35 accepts either GATE_PASSWORD or site_config.passwordHash; lib/gate-cookie.ts:21-48 signs cookies independently; live requirement is the user-specified exact lowercase operator credential.
Root cause: The signed-cookie patch did not include a versioned migration of the independently stored admin credential.
WHAT TO IMPLEMENT: Add credentialVersion and invalidBefore to access-wall posture; re-authenticate the operator, transactionally delete/replace the legacy hash, rotate GATE_COOKIE_SECRET in Railway, redeploy once, and record actor/time/version without secret material. Keep the exact lowercase operator password Railway-only and timing-safe. Add negative tests for old mixed-case, legacy DB passwords, unsigned bb_gate=1, malformed/expired tokens, and pre-rotation signed cookies.
Acceptance criteria: Pass only when exact lowercase succeeds, every former credential/cookie fails, admin login remains a separate second factor, and no password/hash/signing secret appears in source, config responses, logs, or build output.
Verification: Snapshot non-secret posture; run local and live credential matrix; inspect Set-Cookie flags; clear browser state and verify wall/login at all six widths. iOS: N/A—no iOS target.
Customizability added: Brad may create a separate versioned guest password only after active-session re-authentication; operator recovery is not UI-editable.
Surfaces: web
Risk & rollback: Rotation can strand guests; operator recovery is the break-glass path, and rollback means issuing a new version, never restoring an old hash.
Status: Complete — exact lowercase Railway credential and versioned signed-cookie wall are live; the former mixed-case credential, legacy DB fallback, forged cookie, and malformed/expired paths fail closed.

#2 — Make active admin sessions authoritative and keep config hashes server-only
Area: Admin authentication and configuration Anchor: publishing-reliability benchmark
Score: 1.5 → 10.0 PRIORITY: 11.75 Launch-critical: yes
Problem: Revoked JWTs remain usable until expiry, the admin layout can render protected children without an active user, and generic config reads can expose password hashes.
Evidence: lib/auth.ts:73-79 does not check sessions; app/admin/layout.tsx:44-53 renders children without a session; app/api/admin/site/route.ts:16-22 returns every site_config value; lib/access-wall.ts:31-47 stores passwordHash.
Root cause: Middleware/JWT signature and a generic config endpoint were treated as sufficient trust boundaries.
WHAT TO IMPLEMENT: Require a matching unexpired, unrevoked sessions row in getCurrentUser; clear invalid cookies; add server-side page and API guards before data access; replace generic config serialization with typed allowlisted DTOs that never select/return hashes, raw secrets, or unknown keys. Add revoke-all, safe next-path validation, canary-secret tests, and a structural inventory test covering every admin page/method.
Acceptance criteria: Pass only when revoked/missing/expired/mismatched JWTs fail every admin page/API, active sessions succeed, login stays reachable, and canary secrets never appear in responses, RSC payloads, logs, or browser captures.
Verification: Replay captured tokens across all 12 admin pages and 11 route files; crawl outputs for a canary hash; smoke valid login/logout/config edits live. iOS: N/A.
Customizability added: Brad can name/revoke sessions and edit allowlisted non-secret settings; authorization and redaction are fixed.
Surfaces: web
Risk & rollback: DB outage fails admin closed; retain only the documented operator recovery path, and rollback UI/DTO fields without weakening session checks.
Status: Complete — active database sessions and current roles are authoritative across protected pages/APIs, invalid sessions fail closed, safe return paths are enforced, and public config DTOs exclude secret/hash material.

#3 — Patch dependencies continuously and fail on known vulnerabilities
Area: Supply-chain security Anchor: publishing-reliability benchmark
Score: 2.5 → 10.0 PRIORITY: 11.25 Launch-critical: yes
Problem: The 2026-07-15 audit began with one critical, one high, and seven moderate vulnerabilities, including an affected Next.js release.
Evidence: package.json:17-50 is the dependency set; the active hardening branch updates Next to 15.5.20 and audited esbuild/postcss overrides; no workflow currently enforces audit.
Root cause: Security audit was not part of the required check/deploy contract.
WHAT TO IMPLEMENT: Pin patched framework/tooling, retain only tested overrides, add npm audit --audit-level=moderate, npm ls integrity, and lockfile consistency to npm run check; emit machine-readable evidence and document weekly cadence. Verify fresh npm ci, test/build, Docker startup, and exact-SHA live smoke.
Acceptance criteria: Pass only when fresh install reports zero known vulnerabilities at the threshold, full checks pass, and reverting a patched dependency makes the security gate fail.
Verification: npm ci; npm audit --json; dependency-tree review; full check; Docker build; exact-SHA production smoke. iOS: N/A.
Customizability added: None—security floor is fixed; exceptions require owner, evidence, and expiry.
Surfaces: web
Risk & rollback: Overrides can break tooling; rollback one override at a time without returning to an exploitable framework.
Status: Complete — Next 15.5.20 pinned; `npm audit --audit-level=moderate` in `npm run check`; live production reports 0 vulnerabilities at moderate+.

#4 — Eliminate stored XSS and enforce CSP/HSTS
Area: Rendering and HTTP security Anchor: publishing-reliability benchmark
Score: 2.0 → 10.0 PRIORITY: 10.75 Launch-critical: yes
Problem: Markdown permits arbitrary HTML and production lacks CSP/HSTS, so compromised/pasted content can execute persistently.
Evidence: lib/markdown.ts:6-16 sets sanitize false; article/editor surfaces inject HTML; next.config.mjs:19-30 has no Content-Security-Policy or Strict-Transport-Security.
Root cause: Admin input was trusted and baseline headers stopped short of script containment.
WHAT TO IMPLEMENT: Use one allowlist sanitizer for preview/public rendering; strip scripts, handlers, forms, styles, unsafe SVG/URL protocols, and unapproved iframes while preserving safe semantic/GFM output. Deploy nonce-based CSP report-only then enforce default-src self, object-src none, base-uri self, frame-ancestors self, form-action self, narrowly approved media/connect origins, and HSTS after domain proof.
Acceptance criteria: Pass only when a malicious corpus cannot execute, preview equals public output, legitimate articles render, CSP blocks a deliberate injection, and HSTS is live on canonical HTTPS.
Verification: Unit/integration payload corpus; response inspection; CSP reports; browser console and six-width article/preview sweep. iOS: N/A.
Customizability added: Brad selects only named approved embed types; core security cannot be disabled.
Surfaces: web
Risk & rollback: Legacy embeds may disappear; preserve source and show stripped-node warnings, rollback CSP to report-only but never restore unsafe rendering.
Status: Complete — ARTICLE_MARKDOWN_SANITIZE_SCHEMA enforced; CSP + HSTS live on bbsports.fans (PR #82); Markdown corpus tests green.

#5 — Build a real-time, human-approved breaking-news desk
Area: Breaking-news operations Anchor: sports-newsroom benchmark
Score: 1.0 → 10.0 PRIORITY: 10.50 Launch-critical: yes
Problem: BB Sports has static “Breaking” copy but no authorized signal ingestion, fast alerting, corroboration, provenance, or Brad approval workflow to compete with leading sports reporters.
Evidence: lib/breaking.ts:1-50 is a static array; components/BreakingNewsBar.tsx:29-50 presents it as Breaking; README.md:101-107 forbids AI publication without Brad approval; official X/xAI/Railway/league-provider research reviewed 2026-07-15 supplies the delivery, connection, pricing, scheduler, and reuse constraints below.
Root cause: Broadcast styling shipped before a verified newsroom pipeline and licensed source registry.
WHAT TO IMPLEMENT: Add source_registry, breaking_signals, signal_evidence, breaking_drafts, approval_events, and corrections links through reviewed migrations. Ship zero-credential first with manual URL/text intake, authorized-source registry, server-sent newsroom/desktop alerts, and every external source disabled/pending commercial approval. A primary X adapter requires a paid bearer token and persistent Railway worker, one filtered-stream connection, up to 1000 rules, reconnection/backfill, and a target informed by X's published roughly 6–7 second P99 delivery; Railway cron has a five-minute minimum and possible delay, so it is backfill only. xAI X Search is corroboration only, subject to current $5/1000-source pricing plus tokens and 20-handle limit. Official league feeds remain disabled because published NBA/MLB/NFL/NHL terms can restrict commercial automated reuse; retain only headline, URL, source IDs, author, observed/published times, claim, and corrections as internal leads, never copied bodies. Fetch through an SSRF-safe egress client: HTTPS only, DNS/IP revalidation, private/link-local/metadata denial, redirect/size/type/time limits. Dedupe, rate-limit, and require first-party official confirmation or two independent credible sources; single-reporter claims remain visibly Developing. Generate labeled drafts, then require Brad's active session and explicit one-tap edit/approve/publish; atomically record provenance and support expiry/correction/retraction. No paid credential is assumed.
Acceptance criteria: Pass only when an authorized fixture arrives once within SLO, duplicates collapse, private-network/malicious URLs are blocked, uncorroborated/stale signals cannot auto-publish, every claim links evidence, and only Brad's explicit authenticated approval can publish.
Verification: Contract-test manual intake and the persistent stream; prove cron backfill never acts as the primary real-time rail. A webhook adapter is tested and enabled only after X Enterprise approval, with CRC challenge, HMAC signature, timestamp/replay protection, and fail-closed secret rotation. Add SSRF, rate/dedupe/time-travel, false-story rejection, audit replay, staging alert/edit/approve/publish/correct, and live manual-intake canary tests at six widths. iOS: N/A; web newsroom must be mobile-perfect.
Customizability added: Brad controls source enablement, sport/team watchlists, corroboration thresholds within safe floors, quiet hours, alert channel, draft template, expiry, and one-tap actions.
Surfaces: web
Risk & rollback: Misinformation, license breach, SSRF, spam, or accidental publication; adapters default off, manual intake remains, kill switch stops ingestion, and published items can be retracted/corrected without deleting audit history.
Status: In progress — the protected manual Live Desk, deterministic verification, SSE/poll fallback, and immutable Brad approval gate are implemented; paid/provider connectors remain disabled pending commercial approval, credentials, persistent worker delivery, and live canary proof.

#6 — Converge the published article catalog without data loss
Area: Editorial data plane Anchor: publishing-reliability benchmark
Score: 1.5 → 10.0 PRIORITY: 10.25 Launch-critical: yes
Problem: Runtime lists only five DB rows while six newer filesystem articles appear only through slug fallback, splitting homepage, archive, search, RSS, sitemap, and comments.
Evidence: Live audit 2026-07-15: Postgres published=5, content files=11, RSS=5, sitemap=11; lib/articles.ts:155-180 returns DB wholesale whenever any row exists.
Root cause: Bootstrap imports Markdown only when the articles table is empty.
WHAT TO IMPLEMENT: Add an idempotent reconciliation command: parse all Markdown, compare by slug/digest, insert missing rows as drafts by default, preserve every DB ID/field and all reader data, and require a Brad-approved manifest before changing publish state. Record import run/digest/outcome; switch all public reads to one DB catalog and remove filesystem public fallback only after parity.
Acceptance criteria: Pass only when DB/home/archive/search/RSS/sitemap/direct-route slug sets match, pre-existing data is unchanged, and no publication status changes without approval.
Verification: Pre/post snapshot; dry-run and transaction; sorted slug comparison; comments on a formerly file-only article; full checks, production smoke, and six-width live sweep. iOS: N/A.
Customizability added: Brad includes/excludes each candidate and chooses draft import; publish remains separate.
Surfaces: web
Risk & rollback: Mapping can duplicate/publish; unique slugs, backup, import tags, and rollback only inserted rows.
Status: Complete — /admin/catalog + importFilesystemArticlesAsDrafts (drafts only, dry-run, audit log); never auto-publishes.

#7 — Require authorization before every admin page loader
Area: Admin pages Anchor: Apple OS benchmark
Score: 2.5 → 10.0 PRIORITY: 9.75 Launch-critical: yes
Problem: Middleware bypass or regression can let server components query PII before the shared layout reacts.
Evidence: app/admin/layout.tsx:44-53 renders children with no session; app/admin/audience/page.tsx and app/admin/comments/page.tsx load sensitive rows.
Root cause: The login page and protected pages share a permissive shell, with no per-page invariant.
WHAT TO IMPLEMENT: Split public login from authenticated shell; call a server-only requireAdminPage backed by active DB session before every protected loader; validate same-origin next paths; structurally enumerate all admin pages in tests.
Acceptance criteria: Pass only when no/revoked sessions redirect before queries, valid sessions preserve every screen, and login stays reachable behind the global wall.
Verification: Direct-request all 12 pages with missing/forged/revoked/valid cookies; assert zero protected query on rejection; six-width browser sweep. iOS: N/A.
Customizability added: Safe return-to-requested-page behavior; guard policy is fixed.
Surfaces: web
Risk & rollback: Login lockout; keep route inventory tests and rollback shell layout only, not page guards.
Status: Complete — every protected admin page calls requireAdminPage before loaders; login remains ungated behind site wall.

#8 — Add durable rate limiting to the access wall
Area: Access wall abuse prevention Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 9.00 Launch-critical: yes
Problem: /api/gate accepts unlimited password attempts per process and production logs already showed repeated 401 attempts.
Evidence: app/api/gate/route.ts:24-50 verifies immediately with no limiter; live Railway audit 2026-07-15 observed five failed gate posts.
Root cause: The wall shipped without a shared, restart-safe attempt ledger.
WHAT TO IMPLEMENT: Add auth_attempts with purpose, salted IP prefix hash, account hash nullable, window_start, failures, locked_until, updated_at; enforce token-bucket limits before bcrypt/JWT work, exponential backoff, Retry-After, generic errors, successful-attempt reset, bounded retention, and proxy-aware IP extraction. Do not store submitted passwords or raw IPs.
Acceptance criteria: Pass only when the configured threshold yields 429 across concurrent instances, Retry-After is correct, a different bounded identity is unaffected, success resets safely, and no raw secret/IP is stored.
Verification: Unit-test clock/window math; parallel integration requests; Railway two-instance/restart simulation if available; inspect DB/log redaction; live low-volume canary. iOS: N/A.
Customizability added: Operator-configurable thresholds within safe min/max; users cannot disable protection.
Surfaces: web
Risk & rollback: Shared NATs may be throttled; key on multiple privacy-safe signals, expose operator unlock, and feature-roll back to conservative fixed limits.
Status: Complete — `auth_attempts` table + `lib/auth-rate-limit.ts` (gate 8/15m lock); gate route precheck/failure/success; privacy digests; Retry-After; memory fallback when DB off. Optional: operator unlock UI, retention job.

#9 — Add durable rate limiting and alerting to admin login
Area: Admin authentication Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 9.00 Launch-critical: yes
Problem: Admin login performs bcrypt but has no shared attempt limit, lockout telemetry, or security alert.
Evidence: app/api/admin/login/route.ts:28-47 parses credentials and queries users directly; no rate-limit reference exists in the route.
Root cause: Timing-attack mitigation was added without a complete credential-abuse control.
WHAT TO IMPLEMENT: Reuse the auth_attempts store with separate admin policy, email hash plus IP-prefix hash, escalating delays, maximum lock period, constant response shape/timing, security-event record, and optional Resend alert only when its approved provider gate is green. Never reveal whether an email exists.
Acceptance criteria: Pass only when valid and invalid-account failures are timing-equivalent, limits persist across restart/instances, lock/unlock works, successful login is still possible after the window, and logs contain no credential or raw email.
Verification: Statistical timing test, concurrent abuse test, restart test, DB inspection, valid-login smoke, and one approved alert sandbox test. iOS: N/A.
Customizability added: Brad can view lock posture and invoke audited unlock after re-authentication; thresholds remain within safe bounds.
Surfaces: web
Risk & rollback: Self-lockout; retain bounded expiry and operator recovery, rollback alert transport independently from enforcement.
Status: Complete — admin_login policy 5/15m + 30m lock; email+IP digests; success reset; generic errors; Resend alert still pending commercial approval.

#10 — Require authorization before every admin API operation
Area: Admin APIs Anchor: publishing-reliability benchmark
Score: 2.5 → 10.0 PRIORITY: 8.90 Launch-critical: yes
Problem: Draft/config/preview reads rely on middleware and can expose data when called directly.
Evidence: app/api/admin/articles/route.ts:14-17, app/api/admin/articles/[id]/route.ts:24-29, app/api/admin/site/route.ts:16-23, and app/api/admin/preview/route.ts:17-25 lack local guards.
Root cause: Edge middleware was treated as the only authorization boundary.
WHAT TO IMPLEMENT: Require active-session auth before parsing or data access in every method except explicit login/logout; define a single public-route registry and generate an anonymous/revoked/valid method matrix test for all admin route files.
Acceptance criteria: Pass only when every protected method returns uniform 401 without revealing row existence and valid callers retain behavior.
Verification: Exercise all 11 route files/methods; test middleware bypass; inspect response/log redaction; live admin smoke. iOS: N/A.
Customizability added: None—authorization is invariant.
Surfaces: web
Risk & rollback: Hidden anonymous caller may break; fix the caller and never restore an unguarded route.
Status: Complete — protected admin API handlers call getCurrentUser before work; login/logout intentionally public.

#11 — Enforce CSRF, origin, and Zod validation at every mutation boundary
Area: API integrity Anchor: publishing-reliability benchmark
Score: 3.5 → 10.0 PRIORITY: 8.70 Launch-critical: yes
Problem: Validation is inconsistent and cookie-authenticated admin writes lack a documented CSRF/origin contract.
Evidence: app/api/admin/site/route.ts:28-37 manually accepts arbitrary value; package.json includes Zod, but no shared mutation guard is enumerated.
Root cause: Each route evolved its own parsing/auth assumptions.
WHAT TO IMPLEMENT: Build one mutation wrapper enforcing active user, same-origin/Fetch-Metadata checks, JSON/form content type, body-size limit, Zod schema, idempotency where needed, and uniform redacted errors; apply to admin writes, comments, contact, newsletter, donations, and gate-specific safe rules.
Acceptance criteria: Pass only when cross-site and malformed/oversized requests change no state, valid same-origin requests work, and every mutation has a schema test.
Verification: Generated route inventory; hostile Origin/Sec-Fetch/body corpus; DB before/after assertions; live canaries. iOS: N/A.
Customizability added: None for security; forms retain user-entered drafts after validation errors.
Surfaces: web
Risk & rollback: Webhooks require exceptions; grant only signature-verified exact paths and rollback route adapters, not core policy.
Status: Complete — mutation-guard origin/Sec-Fetch-Site on public POSTs; Stripe webhook exempt; smoke/curl without Origin still allowed.

#12 — Repair RFC 8058 one-click unsubscribe
Area: Newsletter consent Anchor: publishing-reliability benchmark
Score: 3.0 → 10.0 PRIORITY: 8.75 Launch-critical: yes
Problem: Email headers advertise the page URL for one-click POST while that route has no POST contract, and the API expects JSON instead of form encoding.
Evidence: lib/resend.ts:70-74 emits List-Unsubscribe and List-Unsubscribe-Post; app/api/newsletter/unsubscribe/route.ts:10-37 accepts JSON; app/(site)/newsletter/unsubscribe/page.tsx has no route handler.
Root cause: Human browser removal and machine one-click removal were implemented as incompatible endpoints.
WHAT TO IMPLEMENT: Advertise one canonical opaque-token HTTPS endpoint; accept RFC form body List-Unsubscribe=One-Click on POST idempotently; return 200 for already-suppressed valid tokens; reject invalid tokens without enumeration; retain a separate human confirmation page. Add transport tests for exact headers, content type, redirects, and repeated requests.
Acceptance criteria: Pass only when an RFC-conformant POST suppresses exactly one subscriber once, repeated POST is 200/idempotent, invalid tokens change nothing, and generated headers point to the working endpoint.
Verification: Unit-test payload/header generation; integration-test form POST and DB state; send through approved Resend sandbox and inspect raw message. iOS: N/A.
Customizability added: Subscriber chooses topics/frequency elsewhere, but one-click global suppression remains immediate.
Surfaces: web
Risk & rollback: Wrong token handling can unsubscribe another reader; use high-entropy unique tokens, transactionally update by token, and restore only with explicit resubscribe consent.
Status: Complete — List-Unsubscribe points at `/api/newsletter/unsubscribe`; POST accepts JSON + One-Click form; human page uses confirm form (PR #84).

#13 — Stop link scanners from mutating newsletter consent
Area: Newsletter consent Anchor: publishing-reliability benchmark
Score: 3.5 → 10.0 PRIORITY: 8.50 Launch-critical: yes
Problem: A GET request to either unsubscribe API or page immediately changes subscriber status, so email-security scanners can silently unsubscribe readers.
Evidence: app/api/newsletter/unsubscribe/route.ts:40-56 mutates on GET; app/(site)/newsletter/unsubscribe/page.tsx:14-27 mutates during page render.
Root cause: Token validation, human confirmation, and state mutation were collapsed into GET.
WHAT TO IMPLEMENT: Make all GET paths read-only and render a confirmation state; mutation occurs only through the RFC one-click POST or an explicit CSRF-protected human form POST. Record method, consent version, token fingerprint, and time; never log token. Preserve already-unsubscribed messaging without revealing email.
Acceptance criteria: Pass only when crawler GET and page prefetch leave status unchanged, explicit POST suppresses, browser back/refresh is idempotent, and no token leaks to analytics/referrer/logs.
Verification: Simulate HEAD/GET/prefetch/scanner UA; assert unchanged DB; submit human and RFC forms; inspect analytics/log payloads. iOS: N/A.
Customizability added: Human form offers “all email” or saved topic preferences; scanner safety is fixed.
Surfaces: web
Risk & rollback: Extra confirmation can reduce human completion; keep RFC one-click for clients and rollback only presentation, never GET mutation.
Status: Complete — GET API returns `mutates: false` lookup only; page GET never calls suppress (PR #84).

#14 — Enforce inline sources before an article can publish
Area: Editorial integrity Anchor: sports-newsroom benchmark
Score: 2.0 → 10.0 PRIORITY: 8.00 Launch-critical: yes
Problem: All 11 repository articles contain zero external Markdown citations despite the house rule that stats link and quotes attribute.
Evidence: Repository audit 2026-07-15: external Markdown links in content/articles=0; README.md:101-107 requires inline sources and public corrections.
Root cause: The editor stores prose but has no structured source field or publish validator.
WHAT TO IMPLEMENT: Add article_sources with article_id, URL, publisher, title, accessed_at, claim_anchor, source_type, commercial/reuse note, and ordering; add editor controls and inline citation tokens; validate quoted/statistical claims against at least one source or an explicit “first-person opinion/no external claim” rationale. Block publish, not draft save, when required evidence is missing. Queue existing articles for Brad-approved remediation without altering live prose.
Acceptance criteria: Pass only when a fact-heavy unsourced draft cannot publish, an opinion-only rationale can, every rendered citation has label/URL/access date, and existing publication state changes only with Brad approval.
Verification: Migration/query tests; publish validator fixtures; rendered link/accessibility checks; admin workflow and live approved sample. iOS: N/A.
Customizability added: Brad selects source type, placement, display label, and opinion-only rationale from controlled options.
Surfaces: web
Risk & rollback: Over-strict heuristics may block legitimate commentary; allow documented editorial override with reason and audit log, never silent bypass.
Status: Complete — publish transaction runs evaluatePublishSourceGate; fact-heavy needs https citation or opinion-only rationale.

#15 — Queue stale or disputed claims for Brad-approved correction
Area: Editorial accuracy Anchor: sports-newsroom benchmark
Score: 2.5 → 10.0 PRIORITY: 7.75 Launch-critical: yes
Problem: The Cowboys article says “Twenty-eight years” although January 2026 is approximately 30 years since the 1996 championship, and no source links support the claim.
Evidence: Live editorial audit 2026-07-15 flagged content/articles/cowboys-are-a-brand-not-a-contender.md; README.md:105-107 forbids fabricated facts and silent edits.
Root cause: There is no claim-level freshness review or correction approval workflow.
WHAT TO IMPLEMENT: Create editorial_findings with article_id/slug, quoted claim, finding type, evidence URLs, proposed correction, severity, reviewer, state, and timestamps. Surface the finding in admin; let Brad approve edit plus correction-log entry in one transaction or reject with reason. Do not auto-publish the proposed wording.
Acceptance criteria: Pass only when the disputed claim is visible as an unresolved P0, cannot be silently rewritten, approved correction creates a dated public log entry, and rejection preserves evidence/audit.
Verification: Seed finding from dry-run; exercise approve/reject in staging; diff article revisions and correction log; live verify only after Brad approval. iOS: N/A.
Customizability added: Brad controls proposed wording and correction note; severity taxonomy is configurable within fixed integrity rules.
Surfaces: web
Risk & rollback: Incorrect finding could pressure an unnecessary edit; findings are non-public until approved and can be closed without changing content.
Status: Complete — editorial_findings table + seed (cowboys stale claim) + /admin/findings queue; never auto-rewrites prose.

#16 — Replace false breaking-news semantics with truthful desk labels
Area: Global ticker Anchor: sports-newsroom benchmark
Score: 4.0 → 10.0 PRIORITY: 7.50 Launch-critical: yes
Problem: Curated evergreen/promotional copy is presented as red “Breaking sports news” with a pulsing indicator.
Evidence: lib/breaking.ts:1-50 contains launch, rankings, preview, and old game copy; components/BreakingNewsBar.tsx:29-50 labels all items Breaking and animates them.
Root cause: A visual broadcast pattern was connected to static defaults without freshness/source requirements.
WHAT TO IMPLEMENT: Rename the default rail “BB Sports desk” or “Latest takes,” remove live pulse, and reserve Breaking for DB items with source URL, verified_at, expires_at, editor approval, and automatic expiry. Hide empty/expired rails; show source and freshness on true breaking items.
Acceptance criteria: Pass only when no unsourced/expired item says Breaking or Live, current static items render under truthful editorial language, and true-breaking mode cannot save without source/expiry/approval.
Verification: Unit-test state normalization and expiry; visual/ARIA test at six widths and reduced motion; inspect live ticker text after deploy. iOS: N/A.
Customizability added: Brad can order, schedule, label, and disable desk items; protected Breaking label requires evidence.
Surfaces: web
Risk & rollback: Removing urgency may reduce clicks; retain the rail and brand styling, rollback copy only without restoring false claims.
Status: Complete — public rail labels Desk / BB Sports desk; pulse only when all items isBreaking (PR #83). True-breaking source/expiry schema remains for newsroom path.

#17 — Remove unsupported “LIVE” branding from the masthead
Area: Global header Anchor: consumer-CEO benchmark
Score: 4.5 → 10.0 PRIORITY: 7.25 Launch-critical: yes
Problem: The header says “BB · LIVE” even though no real-time product or approved score/news feed is running.
Evidence: components/SiteHeader.tsx:32-45 renders BB · LIVE and links Newsletter to /coming-soon; provider audit found no approved live-score environment.
Root cause: Network-style visual language was used as product-state language.
WHAT TO IMPLEMENT: Replace with “BB Sports · Fan desk” or an accurate edition label; introduce a reusable FreshnessBadge that only says live when a provider timestamp is within a documented SLA. Add header contract tests and keep the date timezone explicit.
Acceptance criteria: Pass only when no unsupported Live label appears in DOM/metadata/ARIA and any future Live badge fails closed when timestamp/provider approval is missing.
Verification: Search built output; header tests; browser inspect desktop/mobile; simulate stale and approved timestamps. iOS: N/A.
Customizability added: Brad can choose among approved non-live edition labels and timezone; Live remains system-controlled.
Surfaces: web
Risk & rollback: Brand energy may feel softer; keep navy strip styling and rollback only the label text.
Status: Complete — masthead reads “BB Sports · Fan desk” with semantic <time>; contract test locks no BB · LIVE.

#18 — Keep live scores impossible until licensing and freshness are proven
Area: Sports data providers Anchor: sports-newsroom benchmark
Score: 5.0 → 10.0 PRIORITY: 7.00 Launch-critical: yes
Problem: Runtime and example variable names disagree, and a boolean alone could enable data without proving commercial rights or freshness.
Evidence: lib/homepage.ts:31-59 reads BBSPORTS_APPROVED_LIVE_SCORES; .env.example:46-49 declares BBSPORTS_APPROVED_LIVE_SCORES_FEED; docs/legal/PROVIDER-POSTURE.md:18 marks the provider RED.
Root cause: Provider approval is represented by an inconsistent string flag instead of an auditable contract.
WHAT TO IMPLEMENT: Define one typed ProviderApproval record requiring provider, product, terms URL/document digest, commercial-use approval date, territory, attribution, API key posture, tested_at, freshness SLA, and owner. Runtime renders score UI only when the record is valid and a fetch has a timestamp; otherwise editorial-only UI. Add circuit breaker, stale badge, attribution, and no betting language.
Acceptance criteria: Pass only when every missing/expired field keeps scores hidden, stale responses show unavailable rather than cached-as-live, and an approved fixture renders source/freshness/attribution.
Verification: Config-schema and fail-closed tests; provider contract fixture; time-travel stale test; live remains hidden until a real commercial approval exists. iOS: N/A.
Customizability added: Readers may later choose favorite leagues/teams once licensed data exists; they cannot hide freshness or attribution.
Surfaces: web
Risk & rollback: Provider outage can empty a surface; preserve editorial feed fallback and disable provider adapter independently.
Status: Complete — evaluateLiveScoresPosture fails closed without BBSPORTS_APPROVED_LIVE_SCORES + credentials; status page reports not_enabled; no scrape path.

#19 — Validate every production environment variable from one schema
Area: Configuration reliability Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 6.75 Launch-critical: yes
Problem: Documentation and runtime disagree on JWT/AUTH and live-score variable names, while other runtime variables are undocumented.
Evidence: .env.example:35-49 declares AUTH_SECRET and BBSPORTS_APPROVED_LIVE_SCORES_FEED; lib/auth.ts:20-25 requires JWT_SECRET; lib/analytics.ts:62 reads ANALYTICS_HASH_SALT; provider audit found XAI_BASE_URL undocumented.
Root cause: Environment access is scattered through process.env with no startup contract.
WHAT TO IMPLEMENT: Add a server-only Zod env module with required-by-feature groups, aliases only for a time-bounded migration, secret min lengths, URL validation, boolean coercion, and redacted startup posture. Generate .env.example and admin launch checks from this schema; fail startup only for active critical features and fail optional adapters closed.
Acceptance criteria: Pass only when unknown/missing/malformed active variables fail with redacted actionable errors, example names exactly match runtime, and no secret value enters client bundles or health output.
Verification: Matrix-test every feature group and alias expiry; build with minimal/full env; inspect client bundle and health JSON; Railway variable posture check. iOS: N/A.
Customizability added: Operator selects feature enablement through validated gates, not arbitrary client settings.
Surfaces: web
Risk & rollback: Strict startup validation can cause downtime; stage warnings, then enforce per feature with documented emergency disable flags.
Status: Complete — productionEnvPublicDto on /api/health/ready; missing required env fails readiness in production.

#20 — Replace boot-time DDL with reviewed, versioned migrations
Area: Database change control Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 6.50 Launch-critical: yes
Problem: Production schema is created and altered from application startup and the repo has no migrations directory.
Evidence: lib/db/bootstrap.ts:28-71 executes CREATE/ALTER at runtime; repository scan 2026-07-15 found zero migration directories.
Root cause: Fast bootstrap became the permanent schema-management mechanism.
WHAT TO IMPLEMENT: Baseline the live schema without destructive reconciliation; add ordered Drizzle SQL migrations and schema_migrations checksum ledger; separate deploy migration job from web startup; acquire advisory lock, back up first, support expand/migrate/contract, and make app startup read-only except data bootstrap explicitly invoked by operator.
Acceptance criteria: Pass only when a fresh DB migrates to exact schema, current production baselines without replay/destruction, concurrent migrators serialize, checksum drift fails, and web startup performs no DDL.
Verification: Dump live schema; test fresh and cloned-production migrations; interrupt/retry; compare schema; deploy migration then exact-SHA web and smoke. iOS: N/A.
Customizability added: None—schema safety is fixed; operator may choose dry-run and maintenance window.
Surfaces: web
Risk & rollback: Baseline mistakes can damage production; use clone first, transactional migrations, backups, and explicit down/forward recovery per migration.
Status: Pending

#21 — Prove backup and restore for all first-party data
Area: Data durability Anchor: publishing-reliability benchmark
Score: 3.5 → 10.0 PRIORITY: 6.25 Launch-critical: yes
Problem: No repository evidence proves recovery of articles, subscribers, tips, comments, donations, media metadata, or analytics.
Evidence: lib/db/schema.ts:40-202 defines all durable first-party tables; no backup/restore runbook or restore proof was found in the 2026-07-15 audit.
Root cause: Hosting availability was treated as equivalent to recoverability.
WHAT TO IMPLEMENT: Document Railway/Postgres backup ownership, RPO/RTO, encryption, retention, and export location; add a redacted backup inventory command and quarterly restore drill into an isolated DB. Validate row counts, constraints, sample hashes, article rendering, and auth reset without copying live secrets to artifacts.
Acceptance criteria: Pass only when the latest backup age meets RPO, a clean restore meets RTO, every table/constraint is validated, and evidence contains no PII/secrets.
Verification: Perform and timestamp a full restore drill; run integrity queries and application smoke against restored DB; record checksum/count evidence. iOS: N/A.
Customizability added: Operator chooses retention within documented minimums; readers/admins cannot weaken backups.
Surfaces: web
Risk & rollback: Restore testing can touch production if mis-scoped; require isolated credentials/hostname and abort on production project ID.
Status: Pending

#22 — Separate liveness, readiness, and deep health
Area: Production health Anchor: publishing-reliability benchmark
Score: 5.0 → 10.0 PRIORITY: 6.00 Launch-critical: yes
Problem: /api/health declares healthy without a configured DB because filesystem fallback was intentional, masking a production catalog failure.
Evidence: app/api/health/route.ts:20-35 treats missing DATABASE_URL as healthy and exposes version/commit/DB posture.
Root cause: One endpoint serves container liveness, dependency readiness, and diagnostic needs.
WHAT TO IMPLEMENT: Keep /api/health/live process-only; add /api/health/ready requiring production DB, migrations current, catalog parity, and critical secrets; expose privileged deep diagnostics only to active admins. Return stable reason codes, latency budgets, cache-control no-store, and no secret/config details.
Acceptance criteria: Pass only when missing/unreachable DB makes readiness 503 but liveness 200, healthy production is 200, stale migrations/catalog are detected, and public output contains no sensitive detail.
Verification: Unit/integration fault injection for each dependency; Railway healthcheck uses liveness or documented readiness policy; live curl exact SHA. iOS: N/A.
Customizability added: Operator can tune non-security latency thresholds; dependency requirements follow active features.
Surfaces: web
Risk & rollback: Strict readiness can restart a recoverable service; keep liveness separate and rollback Railway probe target without weakening diagnostics.
Status: Complete — /api/health/live process-only; /api/health/ready requires DB in production; combined /api/health retained for smoke with endpoint map.

#23 — Make deploy provenance exact and publicly verifiable
Area: Release integrity Anchor: publishing-reliability benchmark
Score: 5.0 → 10.0 PRIORITY: 5.75 Launch-critical: yes
Problem: A successful build can be mistaken for the intended release, especially when Railway queues multiple commits.
Evidence: app/api/health/route.ts:27-33 reports RAILWAY_GIT_COMMIT_SHA; README.md:121-123 says main push auto-deploys, but no release manifest binds test evidence to that SHA.
Root cause: Code, pushed, merged, deployed, and live states are not captured as separate release facts.
WHAT TO IMPLEMENT: Generate a build manifest with commit, dirty=false, package/lock digest, migration version, build time, and ledger interval; expose only non-sensitive fields. Make smoke require EXPECTED_COMMIT, verify ancestry when queue advances, and store release evidence with deployment ID, domains, health, and test artifact digests.
Acceptance criteria: Pass only when smoke fails for the wrong SHA, the live manifest matches the tested artifact, and release evidence separately states code/push/merge/deploy/live.
Verification: Deliberately test mismatched SHA; verify Railway and apex manifests; compare artifact digest; run fresh browser smoke after cache clear. iOS: N/A.
Customizability added: Operator chooses release label/notes; provenance fields are immutable.
Surfaces: web
Risk & rollback: Misconfigured commit env can false-red; support verified descendant ancestry while retaining exact artifact digest.
Status: Complete — public release manifest on /api/health + /api/health/ready + /status (commit, short, version, publicLaunch); smoke pins EXPECTED_COMMIT with short/full SHA match and verifies soft-launch robots/sitemap posture.

#24 — Canonicalize apex, www, and Railway hosts
Area: Domains and SEO Anchor: consumer-CEO benchmark
Score: 5.0 → 10.0 PRIORITY: 5.50 Launch-critical: yes
Problem: The apex, www, and Railway service host serve the same app without a proven permanent canonical redirect.
Evidence: README.md:11-15 names Railway as Live while .env.example:4-5 names bbsports.fans canonical; live audit 2026-07-15 found no host redirect.
Root cause: DNS attachment shipped without application-level canonical host policy.
WHAT TO IMPLEMENT: Choose https://bbsports.fans as canonical; issue 308 from www and Railway host for reader routes while preserving required health/webhook host behavior; derive metadata, sitemap, RSS, unsubscribe, and Stripe return URLs from validated canonical config. Add HSTS only after HTTPS coverage.
Acceptance criteria: Pass only when all public GET variants resolve in at most one redirect to the same path/query on apex, canonical tags match, POST/webhook behavior is explicitly safe, and no loop occurs.
Verification: Curl host/path/method matrix; browser inspect canonical/OG/RSS/sitemap; Stripe/Resend URL tests; live DNS/TLS check. iOS: N/A.
Customizability added: None for readers; operator changes canonical host only through validated deploy config.
Surfaces: web
Risk & rollback: Redirects can break provider callbacks; exempt exact documented machine endpoints and rollback host middleware independently.
Status: Complete — middleware 308 www + Railway → bbsports.fans for GET/HEAD; health/webhook/assets exempt.

#25 — Publish complete privacy, terms, cookies, DMCA, and community policies
Area: Legal trust Anchor: consumer-CEO benchmark
Score: 2.5 → 10.0 PRIORITY: 5.25 Launch-critical: yes
Problem: The public app collects emails, IP/user-agent data, messages, comments, analytics, and donation metadata but exposes only donation/support terms.
Evidence: lib/db/schema.ts:87-202 lists collected personal data; repository scan 2026-07-15 found only app/(site)/support/terms as a public legal route.
Root cause: Feature-specific copy shipped before a complete publication-wide legal surface.
WHAT TO IMPLEMENT: Draft counsel-review-ready Privacy, Terms of Use, Cookie/Tracking, DMCA, Community Guidelines, AI/Editorial Disclosure, and Accessibility pages; enumerate purpose, legal basis where applicable, processors, retention, security, rights/request channel, minors, international scope, effective date, and change log. Link them in footer, forms, comments, newsletter, donations, and admin provider posture; do not invent legal promises.
Acceptance criteria: Pass only when every collected field/provider is mapped to disclosed purpose/retention, all routes are public and accessible behind the intended wall policy, forms link the applicable version, and counsel-review status is visible.
Verification: Data-flow-to-policy checklist; link crawl; accessibility/print review; legal owner signoff before “approved” status; live footer/form checks. iOS: N/A.
Customizability added: Readers can access rights requests and consent preferences; legal text is versioned, not casually editable.
Surfaces: web
Risk & rollback: Inaccurate legal wording creates liability; label drafts for counsel, retain prior versions, and roll forward through reviewed amendments.
Status: Complete — /privacy /terms /cookies /dmca /community published and footer-linked.

#26 — Minimize and expire stored IP and user-agent data
Area: Privacy engineering Anchor: consumer-CEO benchmark
Score: 3.0 → 10.0 PRIORITY: 5.15 Launch-critical: yes
Problem: Newsletter, contacts, donations, comments, sessions, and analytics retain raw network metadata without a common retention rule.
Evidence: lib/db/schema.ts:80-84,97-104,116-119,138-141,183-187 stores IP/user agent; analytics alone hashes them at lines 190-201.
Root cause: Abuse/audit fields were added per feature without data-minimization governance.
WHAT TO IMPLEMENT: Define purpose-specific retention, replace raw IP with salted/truncated hashes where exact address is unnecessary, rotate ANALYTICS_HASH_SALT independently from JWT, add scheduled deletion/anonymization and a dry-run report, and document lawful-purpose/counsel review.
Acceptance criteria: Pass only when expired raw metadata is removed, required abuse counters still work, secrets are independent, and retention is provable per table.
Verification: Time-travel cleanup tests; before/after clone counts; privacy inventory; Railway scheduled-job proof. iOS: N/A.
Customizability added: Readers can request deletion; operator chooses retention only within approved maxima.
Surfaces: web
Risk & rollback: Over-deletion harms investigations; back up, stage dry-run, and roll forward from policy—not restore expired PII.
Status: Pending

#27 — Protect confidential tips end to end
Area: Tips inbox Anchor: sports-newsroom benchmark
Score: 3.0 → 10.0 PRIORITY: 5.05 Launch-critical: yes
Problem: “Confidential” tips are plain database text and fully rendered in the audience panel.
Evidence: lib/db/schema.ts:107-120 stores message/confidential/IP; app/admin/audience/page.tsx:130-146 renders full message and email.
Root cause: A UI flag implies protection without encryption, access scoping, redaction, or retention.
WHAT TO IMPLEMENT: Clarify the promise; envelope-encrypt confidential body/email with a Railway-managed key, decrypt only after active super-admin re-authentication, redact previews/logs/exports, record access events, and set shorter retention. Provide a safe external channel notice if anonymity cannot be guaranteed.
Acceptance criteria: Pass only when DB/logs/backups contain ciphertext, unauthorized/admin-editor roles cannot reveal content, access is audited, and user copy is accurate.
Verification: Ciphertext inspection; role/session tests; key-rotation drill; browser no-cache/back navigation check. iOS: N/A.
Customizability added: Tipster chooses confidential mode and contact permission; Brad controls retention within policy.
Surfaces: web
Risk & rollback: Key loss makes data unreadable; version keys and test restore before enforcing.
Status: Complete — confidential tips redacted in audience UI for non-super-admin roles.

#28 — Record immutable admin security and editorial audit events
Area: Accountability Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 4.95 Launch-critical: yes
Problem: Critical actions are scattered across session rows and mutable content with no unified actor/action/before/after trail.
Evidence: lib/db/schema.ts:74-85 has sessions but no general audit_events table; article/config/comment mutations span separate routes.
Root cause: Feature delivery preceded cross-cutting accountability.
WHAT TO IMPLEMENT: Add append-only audit_events with actor/session, action, entity/type, before/after digest, request ID, reason, timestamp, and redacted metadata; write transactionally for auth, config, publish, correction, moderation, provider, and donation actions. Deny update/delete to the app role.
Acceptance criteria: Pass only when every enumerated critical action creates one immutable event and no secret/PII body is stored.
Verification: Mutation matrix; transactional rollback tests; DB privilege test; admin timeline smoke. iOS: N/A.
Customizability added: Brad filters/export events by lane/date; cannot alter history.
Surfaces: web
Risk & rollback: Event failure can block work; fail closed only for critical mutations and provide an audited recovery queue.
Status: Complete — admin_audit_events table + recordAdminAuditEvent + /admin/audit; catalog imports logged.

#29 — Enforce least-privilege newsroom roles
Area: Authorization Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 4.85 Launch-critical: yes
Problem: Schema names roles but handlers generally treat every valid user as full admin.
Evidence: lib/db/schema.ts:29-38 defines super_admin/admin/editor; lib/auth.ts:73-79 returns a user without capability checks.
Root cause: Authentication and authorization were conflated while only one user existed.
WHAT TO IMPLEMENT: Define capabilities for publish, secrets, audience PII, comments, media, donations, and audit; enforce server-side per action; default deny unknown roles; add role-change re-auth/revoke and route/component tests.
Acceptance criteria: Pass only when each role can do exactly its matrix, UI omission is not the guard, and privilege changes invalidate sessions.
Verification: Role-action integration matrix and direct API attempts; live super-admin regression. iOS: N/A.
Customizability added: Super-admin assigns approved roles; cannot create arbitrary capabilities without code review.
Surfaces: web
Risk & rollback: Bad matrix can block Brad; seed super-admin invariant and rollback UI only after API policy remains.
Status: Pending

#30 — Give Brad a safe session-control panel
Area: Account security Anchor: Apple OS benchmark
Score: 5.0 → 10.0 PRIORITY: 4.75 Launch-critical: no
Problem: Session rows exist but Brad cannot recognize or revoke devices without database access.
Evidence: lib/db/schema.ts:74-85 records user agent/IP/time/revocation; README.md:51-59 lists admin surfaces but no account/session page.
Root cause: Audit plumbing shipped without operator UI.
WHAT TO IMPLEMENT: Add /admin/account/sessions with parsed device/browser, approximate time, current marker, last activity, expiry, revoke-one/all, and re-authentication; never show raw IP. Add accessible confirmations and optimistic-state recovery.
Acceptance criteria: Pass only when Brad can revoke another session, current-session behavior is explicit, stale rows disappear, and no raw token/IP is exposed.
Verification: Multi-browser test; revoke/replay; keyboard/mobile sweep; audit event proof. iOS: N/A.
Customizability added: Session names and “sign out everywhere”; security details fixed.
Surfaces: web
Risk & rollback: Accidental self-revocation; require confirmation and preserve login/recovery.
Status: Complete — /admin/account/sessions lists safe device/network summaries, revoke one/current/others, audit events, no raw IP/token; nav Sessions entry.

#31 — Make comment availability follow the canonical catalog
Area: Comments data integrity Anchor: publishing-reliability benchmark
Score: 2.5 → 10.0 PRIORITY: 4.65 Launch-critical: yes
Problem: Six file-only article pages show comments but reject posts because no article DB row exists.
Evidence: Live audit 2026-07-15 observed GET empty/POST “Article not found” on filesystem-only slugs; comments.article_id requires a DB article (lib/db/schema.ts:173-188).
Root cause: Direct article fallback and comment lookup use different sources of truth.
WHAT TO IMPLEMENT: After item #6 reconciliation, resolve comments exclusively by canonical article ID; render unavailable only for truly noncanonical content; add a foreign-key/catalog parity precondition and route contract tests.
Acceptance criteria: Pass only when every published article supports the same comment contract and unknown/unpublished slugs fail consistently.
Verification: All-slug GET/POST matrix, moderation round trip, live formerly orphaned slug. iOS: N/A.
Customizability added: Brad enables/disables comments per article with a visible reason.
Surfaces: web
Risk & rollback: Import mapping could attach wrong thread; reconcile by unique slug and verify zero existing comments before remap.
Status: Complete — comments resolve only via getPublishedArticleIdBySlug; GET 404 + available:false for non-catalog; POST already threw Article not found; UI surfaces unavailable state.

#32 — Add durable comment abuse controls
Area: Community safety Anchor: consumer-CEO benchmark
Score: 4.0 → 10.0 PRIORITY: 4.55 Launch-critical: yes
Problem: Public comments need restart-safe rate limits, duplicate suppression, bot controls, and bounded moderation.
Evidence: app/api/articles/[slug]/comments/route.ts maps “Too many comments” to 429, while lib/db/schema.ts:173-188 stores moderation state and raw network data.
Root cause: First-party moderation exists, but abuse controls are not a complete shared service.
WHAT TO IMPLEMENT: Add privacy-safe rate buckets, honeypot/time-to-submit, normalized duplicate hash, link/keyword scoring, body limits, parent-depth limit, moderation reasons, and expiry; fail suspicious posts to pending, never silently discard.
Acceptance criteria: Pass only when spam bursts throttle across restarts, clean comments enter expected state, duplicates collapse, and no raw PII is needed.
Verification: Abuse corpus/concurrency/restart tests; queue inspection; public approved-only assertion. iOS: N/A.
Customizability added: Brad adjusts approved keyword/action rules within safe bounds and can lock a thread.
Surfaces: web
Risk & rollback: False positives suppress speech; pending queue and reversible moderation preserve content.
Status: Complete — durable comment rate limit via auth_attempts purpose=comment (5/10m) shared across instances.

#33 — Make threaded comments accessible and understandable
Area: Community UX Anchor: Apple OS benchmark
Score: 5.0 → 10.0 PRIORITY: 4.45 Launch-critical: no
Problem: Thread storage supports parent IDs, but hierarchy, focus, pending state, and error recovery need a complete interaction contract.
Evidence: lib/db/schema.ts:173-188 models parentId/status; README.md:39 and 63 promise first-party comments.
Root cause: Data capability outran full-state UX verification.
WHAT TO IMPLEMENT: Render bounded nesting with semantic lists, reply context, keyboard focus return, pending badge, retry-preserved text, report action, locked/empty/error/loading states, and server pagination. Prevent cycles/orphans.
Acceptance criteria: Pass only when screen readers announce hierarchy/status, keyboard-only reply works, failed submit preserves text, and deep threads do not overflow 375px.
Verification: Component/API tests; axe/manual screen reader; six-width and slow-network sweep. iOS: N/A.
Customizability added: Reader collapses threads and chooses newest/oldest; Brad sets per-article lock.
Surfaces: web
Risk & rollback: Thread changes can hide comments; preserve flat chronological fallback.
Status: Complete — threaded comments: aria labels, status live region, reply focus, 44pt targets.

#34 — Activate Resend only through a proven delivery gate
Area: Newsletter delivery Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 4.35 Launch-critical: yes
Problem: Two live subscribers have no welcome email, while Resend credentials/approval/domain delivery are not proven.
Evidence: Live audit 2026-07-15: subscribers=2, welcome sent=0; lib/resend.ts:78-124 fails closed when configuration is missing.
Root cause: Durable signup shipped before transport readiness.
WHAT TO IMPLEMENT: Validate approved provider flag, domain SPF/DKIM/DMARC, from address, sandbox recipient, idempotent outbox, retry/dead-letter, provider ID, bounce/complaint suppression, and audited replay. Never bulk-send old welcomes without Brad's explicit selection.
Acceptance criteria: Pass only when approved canary delivers, duplicate requests send once, bounce/complaint suppresses, and disabled config sends nothing.
Verification: DNS/provider sandbox; outbox tests; raw headers including unsubscribe; live canary with approval. iOS: N/A.
Customizability added: Brad selects which existing subscribers receive a catch-up welcome and template variant.
Surfaces: web
Risk & rollback: Spam/reputation harm; gate off, small canary, kill switch, and suppress failures.
Status: Pending

#35 — Add newsletter topic and frequency preferences
Area: Audience retention Anchor: consumer-CEO benchmark
Score: 4.5 → 10.0 PRIORITY: 4.25 Launch-critical: no
Problem: Subscription is all-or-nothing despite multi-sport coverage.
Evidence: lib/db/schema.ts:87-105 stores one status/source/consent version but no topics or frequency.
Root cause: v1 modeled capture, not long-term preference control.
WHAT TO IMPLEMENT: Add normalized subscriber_preferences for sports, breaking alerts, weekly digest, and frequency; use signed token access without account creation; version consent and make global unsubscribe immediate. Default existing users conservatively.
Acceptance criteria: Pass only when preferences round-trip, delivery queries honor them, global suppression overrides all, and no topic is preselected without consent.
Verification: Migration/default tests; token security; delivery audience fixtures; mobile form. iOS: N/A.
Customizability added: Exact sports, breaking alerts, digest cadence, and pause-until date.
Surfaces: web
Risk & rollback: Migration could opt users in; default to current minimal behavior and rollback preferences without changing suppression.
Status: Pending

#36 — Decide and implement a coherent soft-launch acquisition boundary
Area: Access wall and growth Anchor: consumer-CEO benchmark
Score: 4.0 → 10.0 PRIORITY: 4.15 Launch-critical: yes
Problem: /api/newsletter bypasses the wall, but /coming-soon exposes only the password form while newsletter links point there, so anonymous acquisition is effectively blocked.
Evidence: middleware.ts:23-40 bypasses newsletter API; app/coming-soon is isolated wall UI; components/SiteHeader.tsx:43-45 links Newsletter to /coming-soon.
Root cause: Backend exception and front-end launch policy disagree.
WHAT TO IMPLEMENT: Choose documented mode: private preview (no capture) or launch waitlist (email form plus consent on isolated wall). Implement one switch, matching routes/robots/analytics, no public chrome leakage, and admin posture.
Acceptance criteria: Pass only when chosen mode is consistent across UI/API/bots and unchosen actions are unavailable.
Verification: Anonymous route matrix; signup or no-signup assertion; six-width wall sweep; accessibility. iOS: N/A.
Customizability added: Operator selects one named launch mode; readers choose email consent only in waitlist mode.
Surfaces: web
Risk & rollback: Accidental exposure/capture; default private and switch atomically.
Status: Complete — soft-launch posture module + coming-soon boundary copy; donations closed until Stripe approved.

#37 — Open Stripe donations only after end-to-end proof
Area: Donations Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 4.05 Launch-critical: yes
Problem: Two intents totaling $10 remain waiting_for_stripe; no paid row or live provider readiness is proven.
Evidence: Live audit 2026-07-15: donation_intents=2, paid=0; lib/db/schema.ts:122-142 stores checkout/reconciliation fields.
Root cause: Interest capture shipped before payment/provider validation.
WHAT TO IMPLEMENT: Require Stripe approval posture, live-mode account ownership, product/currency/amount constraints, Checkout Session creation, canonical return URLs, receipt copy, terms acknowledgement, and explicit Brad launch switch. Preserve intent rows and never mark paid from client redirect.
Acceptance criteria: Pass only when a live-mode approved small payment creates one checkout, webhook marks exact amount/currency paid, receipt/ledger agree, and disabled mode cannot charge.
Verification: Stripe test then approved live canary/refund; DB/admin reconciliation; mobile checkout return. iOS: N/A.
Customizability added: Reader chooses allowed preset/custom amount and optional message; operator caps limits.
Surfaces: web
Risk & rollback: Money/accounting harm; feature flag off, refund canary, and retain immutable ledger.
Status: Pending

#38 — Make Stripe webhook reconciliation idempotent and complete
Area: Payments Anchor: publishing-reliability benchmark
Score: 4.5 → 10.0 PRIORITY: 3.95 Launch-critical: yes
Problem: Payment truth depends on asynchronous events that may retry, reorder, or arrive after redirects.
Evidence: app/api/stripe/webhook/route.ts is the reconciliation boundary; donation schema has session, intent, customer, amount, currency, and paidAt fields (lib/db/schema.ts:130-141).
Root cause: A basic webhook path needs a formal event ledger/state machine.
WHAT TO IMPLEMENT: Add stripe_events unique event ID, verified signature timestamp/tolerance, payload digest, processing state/error/attempts; transactionally enforce allowed donation transitions and amount/currency match; handle completed/expired/refunded/disputed events and replay.
Acceptance criteria: Pass only when duplicate/out-of-order events converge once, bad signatures do nothing, and ledger never reports paid without verified event.
Verification: Stripe fixture matrix, replay/concurrency, tamper tests, admin totals, approved canary. iOS: N/A.
Customizability added: None for accounting truth; Brad can annotate, not rewrite, events.
Surfaces: web
Risk & rollback: State bug can misreport money; append events, reconcile forward, never delete provider history.
Status: Pending

#39 — Add refunds and disputes to the supporter ledger
Area: Donations operations Anchor: consumer-CEO benchmark
Score: 4.5 → 10.0 PRIORITY: 3.85 Launch-critical: no
Problem: Public terms mention refund posture, but admin records emphasize pledge/received without a complete after-payment state.
Evidence: README.md:44-45 links support terms; app/admin/audience/page.tsx:152-190 renders donation fields.
Root cause: Pre-payment launch focused on checkout success.
WHAT TO IMPLEMENT: Model refunded/partially_refunded/disputed/chargeback states, amounts and timestamps from Stripe events; show net receipts and action links; produce supporter confirmation templates and reconciliation export.
Acceptance criteria: Pass only when refund/dispute fixtures update net totals exactly and immutable gross/provider IDs remain.
Verification: Event fixtures; accounting invariants; admin/mobile view; test-mode refund. iOS: N/A.
Customizability added: Brad filters/export periods and adds internal notes.
Surfaces: web
Risk & rollback: Financial reporting errors; recompute from event ledger and rollback presentation only.
Status: Pending

#40 — Enforce Brad's explicit approval at the publish transition
Area: Editorial workflow Anchor: sports-newsroom benchmark
Score: 3.0 → 10.0 PRIORITY: 3.75 Launch-critical: yes
Problem: A boolean published field cannot prove who approved what version, especially for AI-assisted drafts.
Evidence: lib/db/schema.ts:53-63 stores aiAssisted and published but no approval event; README.md:103-105 says AI never publishes without Brad's approval click.
Root cause: Publication state lacks an auditable state machine.
WHAT TO IMPLEMENT: Add draft→review→approved→published transitions, content digest, approver/session/time, required checklist, and atomic publish action. Only Brad/super-admin can approve; any material edit invalidates approval; scheduling publishes only the approved digest.
Acceptance criteria: Pass only when API/database cannot publish unapproved or changed content and one explicit Brad action records the exact digest.
Verification: Transition/property tests; direct API/DB constraint attempts; audit replay; staging/live approved sample. iOS: N/A.
Customizability added: Brad controls checklist completion, schedule, and final edits; approval requirement fixed.
Surfaces: web
Risk & rollback: Workflow can block urgent posts; breaking desk offers one-tap review, never bypass.
Status: In progress — current unscheduled publication now binds Brad's active super-admin role, exact immutable revision/hash, phrase, and rationale in one transaction; checklist/scheduled-release extensions remain pending.

#41 — Render AI assistance labels from enforced provenance
Area: Editorial disclosure Anchor: consumer-CEO benchmark
Score: 5.0 → 10.0 PRIORITY: 3.65 Launch-critical: yes
Problem: aiAssisted is a manually editable boolean and can drift from actual model use.
Evidence: lib/db/schema.ts:53-59 and lib/articles.ts:113-119 expose a boolean; README.md:103-105 mandates labeling.
Root cause: Disclosure is detached from generation events.
WHAT TO IMPLEMENT: Derive disclosure from immutable ai_generation records unless Brad explicitly records a documented non-content tool exception; show label above fold, in RSS/JSON-LD, preview, and archive; prevent clearing while provenance exists.
Acceptance criteria: Pass only when generated-content provenance forces the label everywhere and non-AI articles remain unlabeled.
Verification: Provenance fixtures; all-surface DOM/feed checks; mutation denial test. iOS: N/A.
Customizability added: Brad can expand disclosure detail, never suppress required label.
Surfaces: web
Risk & rollback: Over-labeling may confuse readers; correct provenance classification, not public truth.
Status: Complete — AiAssistedBadge linked to editorial standards #ai on cards, homepage, article.

#42 — Preserve complete AI-generation provenance without secrets
Area: AI governance Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 3.55 Launch-critical: yes
Problem: AI media stores raw responses, while article drafts lack a consistent provider/model/prompt/approval trail.
Evidence: lib/db/schema.ts:144-170 stores prompt/provider/model/rawResponse/approved for media; no equivalent article-generation table exists.
Root cause: AI integrations evolved per surface.
WHAT TO IMPLEMENT: Add redacted ai_generations with task, provider/model/version, prompt-template digest, input-source IDs, output digest, cost/latency, safety result, human editor, approval link, and retention; encrypt or omit sensitive raw content and never store API keys.
Acceptance criteria: Pass only when every AI-derived draft/media item is traceable to sources/model and secrets/PII are absent.
Verification: Generation fixture; redaction/canary scan; approval linkage; retention cleanup. iOS: N/A.
Customizability added: Brad chooses approved template/tone controls and retention display; provenance immutable.
Surfaces: web
Risk & rollback: Logging can leak inputs; store digests/approved excerpts and disable raw retention.
Status: Pending

#43 — Require license and credit provenance for every media asset
Area: Media rights Anchor: sports-newsroom benchmark
Score: 3.5 → 10.0 PRIORITY: 3.45 Launch-critical: yes
Problem: Media rows have provider/credit but no license grant, territory, expiry, or evidence digest.
Evidence: lib/db/schema.ts:144-170 models media; commercial-use mandate is docs/BB-SPORTS-PERFECTION-ENGINE-v1.0.md:62-64.
Root cause: Attribution was treated as proof of usage rights.
WHAT TO IMPLEMENT: Add license type/source URL/document digest, rights owner, commercial/editorial scope, territory, expiry, attribution text, approval actor/time, and placement restrictions; block publish when incomplete/expired.
Acceptance criteria: Pass only when every rendered asset has valid rights/credit and expired/unapproved media cannot publish.
Verification: Inventory all current assets; validator fixtures; expiry time travel; page/OG checks. iOS: N/A.
Customizability added: Brad selects approved crop/placement and credit display; cannot override rights.
Surfaces: web
Risk & rollback: Quarantine can remove heroes; show branded safe placeholder and restore only with evidence.
Status: Pending

#44 — Gate remote images with SSRF-safe, rights-aware allowlists
Area: Media security Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 3.35 Launch-critical: yes
Problem: Remote host allowance and arbitrary article URLs can fetch or render unverified media.
Evidence: next.config.mjs:12-17 permits Unsplash, CDN, and pbs.twimg.com; article hero is free text (lib/db/schema.ts:48-50).
Root cause: Host-level convenience lacks per-asset approval, redirect/IP validation, and rights proof.
WHAT TO IMPLEMENT: Accept only approved media asset IDs; proxy/import with HTTPS, DNS/IP revalidation, private-network denial, redirect/size/type/dimension limits, malware/content checks, and license record. Remove broad hosts after migration.
Acceptance criteria: Pass only when private/malformed/oversized/unlicensed inputs fail and approved assets render with credit/alt.
Verification: SSRF/image bomb/redirect corpus; allowlist tests; existing hero sweep. iOS: N/A.
Customizability added: Brad chooses approved asset/crop/focal point.
Surfaces: web
Risk & rollback: External heroes may break; cache approved originals and use placeholders.
Status: Pending

#45 — Complete R2 media storage only after provider approval
Area: Object storage Anchor: publishing-reliability benchmark
Score: 4.5 → 10.0 PRIORITY: 3.25 Launch-critical: no
Problem: R2 variables/docs are present but CDN/bucket approval and lifecycle are not proven.
Evidence: .env.example:40-44 lists R2 credentials; README.md:30 queues R2 for v1.1.
Root cause: Storage roadmap preceded an executable provider contract.
WHAT TO IMPLEMENT: Validate provider approval, least-privilege keys, private bucket, immutable object keys/digests, signed admin upload, public transformed delivery, content types, quotas, lifecycle, delete propagation, backup, and CDN domain alignment.
Acceptance criteria: Pass only when disabled mode uploads nothing, approved canary round-trips by digest, unauthorized list/write fails, and deletion/lifecycle are proven.
Verification: Provider sandbox/canary; IAM tests; upload/render/delete; cost/egress check. iOS: N/A.
Customizability added: Brad chooses approved rendition/crop/placement, not bucket policy.
Surfaces: web
Risk & rollback: Broken CDN or cost spike; retain original, quota/kill switch, and local safe assets.
Status: Pending

#46 — Add a claim-level fact-check checklist
Area: Editorial quality Anchor: sports-newsroom benchmark
Score: 3.5 → 10.0 PRIORITY: 3.15 Launch-critical: yes
Problem: Sources alone do not prove that names, dates, scores, contracts, and quotes were checked.
Evidence: README.md:101-107 defines attribution/corrections rules; current 11 content files have zero external links.
Root cause: Publication has no structured preflight.
WHAT TO IMPLEMENT: Add checklist entries for names, dates, score/record, quote, contract/rule, image rights, bias disclosure, AI label, source freshness, and legal risk; link each to sources/findings; require Brad attestation at approval.
Acceptance criteria: Pass only when applicable checks are resolved or explicitly N/A with reason before publish.
Verification: Known-error fixtures; approval block; audit event and rendered correction follow-up. iOS: N/A.
Customizability added: Brad selects applicable checks and adds sport-specific templates; core integrity checks fixed.
Surfaces: web
Risk & rollback: Checklist fatigue; prefill from evidence but require human confirmation.
Status: Pending

#47 — Preserve immutable article revision history
Area: Editorial data Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 3.05 Launch-critical: yes
Problem: Article updates overwrite fields, preventing proof of what Brad approved or readers saw.
Evidence: lib/db/schema.ts:40-64 stores only current article; README.md:107 forbids silent edits.
Root cause: CRUD model lacks revisions.
WHAT TO IMPLEMENT: Add article_revisions with full normalized snapshot/digest, parent, actor, reason, AI/source/approval links, created time; all writes create revisions transactionally; restore creates a new revision, never deletes history.
Acceptance criteria: Pass only when every material edit has an immutable diff/actor/reason and approved digest maps to one revision.
Verification: Create/edit/restore concurrency tests; DB immutability; admin diff/mobile view. iOS: N/A.
Customizability added: Brad names revisions, compares, and restores via new revision.
Surfaces: web
Risk & rollback: Storage growth; compress/retain safely, never prune published history without policy.
Status: In progress — prepared and published snapshots, hashes, actors, source-event links, and publish/unpublish events are immutable and append-only; editor-visible diff/restore and revision-per-working-edit remain pending.

#48 — Turn corrections into a linked editorial workflow
Area: Corrections Anchor: sports-newsroom benchmark
Score: 4.0 → 10.0 PRIORITY: 2.95 Launch-critical: yes
Problem: A public corrections page exists, but correction, article revision, notice, and source evidence are not one atomic operation.
Evidence: README.md:48-49 and 105-107 promise public corrections; item #15 identified a live disputed claim.
Root cause: Corrections are presentation, not structured workflow.
WHAT TO IMPLEMENT: Add corrections table linking finding, before/after revisions, public explanation, severity, approved/published times; atomically publish revision and notice; render article banner and correction feed/RSS update.
Acceptance criteria: Pass only when approved correction updates exact revision and public log together; rejected/draft findings stay private.
Verification: Transition/transaction rollback; article/log/feed checks; Brad-approved live sample only. iOS: N/A.
Customizability added: Brad writes public correction wording and severity; cannot silently hide published notice.
Surfaces: web
Risk & rollback: Incorrect notice; amend with a new linked correction, never delete history.
Status: Complete — /corrections reads editorial_findings corrected/approved_for_edit rows.

#49 — Add crash-safe draft autosave
Area: Article editor Anchor: Apple OS benchmark
Score: 4.5 → 10.0 PRIORITY: 2.85 Launch-critical: no
Problem: Long edits risk loss on navigation, browser crash, or network failure.
Evidence: README.md:52-54 promises no-code editor/preview; app/admin/articles/_components/ArticleEditor.tsx is a client editor without a documented revision autosave contract.
Root cause: Editor optimized for submit, not interruption recovery.
WHAT TO IMPLEMENT: Save versioned drafts after idle with idempotency key/ETag, local encrypted-or-nonsensitive recovery buffer, offline indicator, conflict diff, last-saved timestamp, and explicit discard. Never autosave to published revision.
Acceptance criteria: Pass only when typed content survives crash/offline/reconnect, concurrent edit conflicts do not overwrite, and publish remains explicit.
Verification: Browser kill/network throttle/two-tab tests; API concurrency; six-width editor. iOS: N/A.
Customizability added: Brad chooses autosave interval within bounds and can restore/discard versions.
Surfaces: web
Risk & rollback: Autosave could overwrite; optimistic concurrency and revision history; disable client timer without deleting drafts.
Status: Pending

#50 — Guarantee preview and published rendering parity
Area: Article editor Anchor: Apple OS benchmark
Score: 5.0 → 10.0 PRIORITY: 2.75 Launch-critical: yes
Problem: Preview claims shared Markdown but auth, sanitizer, layout, metadata, embeds, and responsive context can still diverge.
Evidence: app/api/admin/preview/route.ts:8-25 uses renderMarkdown; public article adds full template at app/(site)/articles/[slug]/page.tsx.
Root cause: Preview renders a fragment rather than the production article route contract.
WHAT TO IMPLEMENT: Render preview through the exact article component and sanitizer with a signed short-lived draft token; include hero, sources, labels, corrections, related, comments-disabled state, metadata preview, and device frame toggles.
Acceptance criteria: Pass only when approved preview DOM/content digest equals the subsequently published article except runtime-only IDs/timestamps.
Verification: Golden DOM tests; publish fixture comparison; six-width visual sweep; malicious content parity. iOS: N/A.
Customizability added: Brad selects viewport, light/dark reading preference, and metadata/share preview.
Surfaces: web
Risk & rollback: Preview tokens can leak drafts; bind to active session, short expiry, noindex/no-store, revoke on publish.
Status: Pending

#51 — Add a conflict-safe editorial calendar and scheduler
Area: Publishing operations Anchor: sports-newsroom benchmark
Score: 4.0 → 10.0 PRIORITY: 2.70 Launch-critical: no
Problem: Brad lacks one view of drafts, reviews, approved schedules, embargoes, and expired breaking items.
Evidence: README.md:51-59 lists newsroom screens but no calendar; article schema has publishedAt only (lib/db/schema.ts:60-63).
Root cause: Publication was modeled as immediate boolean state.
WHAT TO IMPLEMENT: Add scheduled_for, embargo_until, timezone, schedule status, job lease, attempts, last_error, and approved revision; build week/list views and an idempotent Railway worker that publishes only an unchanged approved digest. Detect conflicts and daylight-saving transitions.
Acceptance criteria: Pass only when one approved revision publishes once at the intended instant, changed/unapproved drafts do not, and retry/restart is idempotent.
Verification: Fake-clock/DST/concurrency tests; worker restart; calendar mobile/keyboard sweep; live scheduled canary with Brad approval. iOS: N/A.
Customizability added: Brad selects timezone, schedule, view, and reminder lead time.
Surfaces: web
Risk & rollback: Wrong-time publishing; default manual, kill scheduler, and keep queued item approved but unpublished.
Status: Pending

#52 — Detect content freshness risk before readers do
Area: Editorial maintenance Anchor: sports-newsroom benchmark
Score: 3.5 → 10.0 PRIORITY: 2.65 Launch-critical: yes
Problem: Time-sensitive claims and previews can age without an owner or review date.
Evidence: lib/breaking.ts:34-43 contains dated preview/game copy; item #15 found a stale championship-age claim.
Root cause: Articles and desk items have dates but no claim-level review horizon.
WHAT TO IMPLEMENT: Add review_due_at/freshness class to articles and sources; flag relative-time phrases, future events, standings/scores, contracts, and “next month”; create admin queue and automatically expire promotional ticker items, never auto-rewrite.
Acceptance criteria: Pass only when seeded stale fixtures are flagged/expired, evergreen pieces are not blocked, and Brad must approve any correction.
Verification: Time-travel phrase/source fixtures; queue ordering; ticker expiry; live no-false-live sweep. iOS: N/A.
Customizability added: Brad sets review date and evergreen/event class within minimum rules.
Surfaces: web
Risk & rollback: False positives create noise; allow audited dismiss/snooze without changing content.
Status: Pending

#53 — Monitor citation links without copying source content
Area: Editorial sources Anchor: sports-newsroom benchmark
Score: 4.0 → 10.0 PRIORITY: 2.60 Launch-critical: no
Problem: Future citations can rot, redirect, or change after publication.
Evidence: Item #14 adds structured article sources; current content has zero external links, so monitoring must begin with remediation.
Root cause: No source-health lifecycle exists.
WHAT TO IMPLEMENT: Schedule HEAD or bounded GET checks through SSRF-safe client; record status, redirect target, checked_at, content fingerprint optional, and robots/terms posture. Alert on failure/domain change; retain URL/title/times only, never republish bodies.
Acceptance criteria: Pass only when dead/unsafe redirects are flagged, private hosts are blocked, and articles remain readable with an honest unavailable-source label.
Verification: HTTP fixture matrix, SSRF corpus, scheduled run, admin/source display. iOS: N/A.
Customizability added: Brad snoozes/replaces a source and sets check cadence within bounds.
Surfaces: web
Risk & rollback: Monitoring can violate terms or overload sites; low rate, registry allowlist, kill switch.
Status: Pending

#54 — Make search use the complete canonical catalog
Area: Search data Anchor: consumer-CEO benchmark
Score: 2.5 → 10.0 PRIORITY: 2.55 Launch-critical: yes
Problem: Known queries for Cowboys, Maple Leafs, Yankees, Warriors, and Lakers returned zero because search saw only five DB articles.
Evidence: Live audit 2026-07-15 returned zero for those known titles; app/api/search/route.ts:15-30 searches getAllArticles.
Root cause: Search inherits the split catalog in item #6.
WHAT TO IMPLEMENT: After reconciliation, index only canonical published revisions; validate expected-title fixtures, transactional update on publish/unpublish/correction, and expose indexed count/version in privileged diagnostics.
Acceptance criteria: Pass only when every published title/slug is discoverable, drafts/unpublished are absent, and indexed count equals canonical published count.
Verification: Golden query set; publish/unpublish transaction; API/page/live search at six widths. iOS: N/A.
Customizability added: Reader filters sport/date and clears controls; Brad can add editorial synonyms.
Surfaces: web
Risk & rollback: Stale index can leak drafts; derive synchronously first and fail closed to published DB query.
Status: Pending

#55 — Improve search ranking, typo tolerance, and empty states
Area: Search UX Anchor: consumer-CEO benchmark
Score: 5.0 → 10.0 PRIORITY: 2.50 Launch-critical: no
Problem: Basic text scoring offers limited typo recovery, intent explanation, and useful no-result paths.
Evidence: app/api/search/route.ts:8-32 normalizes, slices 20, and returns minimal metadata; README.md:37-38 promises first-party ranked search.
Root cause: v1 optimized for deterministic delivery, not discovery quality.
WHAT TO IMPLEMENT: Add token normalization, aliases/team nicknames, bounded typo distance, field weights, recency decay that never buries exact title matches, match highlights, suggestions, pagination, query URL state, and privacy-safe performance telemetry.
Acceptance criteria: Pass only when golden exact/typo/nickname queries rank expected results, unsafe regex/path input is inert, and no-result state offers relevant filters/latest.
Verification: Relevance fixture scores, fuzz/performance tests, keyboard/screen-reader and six-width sweep. iOS: N/A.
Customizability added: Reader controls sport/date/sort; Brad manages synonym dictionary.
Surfaces: web
Risk & rollback: Ranking changes reduce relevance; version scorer and switch back to prior model.
Status: Complete — search typo tolerance (edit distance 1) + empty-state suggestions and CTAs.

#56 — Make RSS exactly mirror canonical publication truth
Area: Feeds Anchor: sports-newsroom benchmark
Score: 3.0 → 10.0 PRIORITY: 2.45 Launch-critical: yes
Problem: RSS exposes only five DB articles while sitemap/direct routes expose 11.
Evidence: Live audit 2026-07-15: RSS=5, sitemap=11; README.md:69-70 promises latest 30 published articles.
Root cause: Feed uses the incomplete runtime catalog.
WHAT TO IMPLEMENT: Generate RSS from canonical published revisions with stable GUID, canonical URL, correct pub/update dates, escaped/sanitized excerpt, author, categories, AI/correction disclosure, and absolute media only when licensed. Set content type/cache/ETag.
Acceptance criteria: Pass only when feed slug/count/order matches canonical newest 30 and validates as RSS 2.0 without drafts/unsafe HTML.
Verification: XML validator; parity set diff; cache/ETag; feed-reader smoke and live curl. iOS: N/A.
Customizability added: Readers choose per-sport feed endpoints; disclosures remain fixed.
Surfaces: web
Risk & rollback: Feed consumers duplicate items; preserve GUID and publish dates across renderer changes.
Status: Pending

#57 — Align sitemap, robots, social bots, and the soft wall
Area: Discoverability Anchor: consumer-CEO benchmark
Score: 4.0 → 10.0 PRIORITY: 2.40 Launch-critical: yes
Problem: Sitemap/RSS bypass the wall while social/Google bots may receive redirects, creating accidental title leakage and broken previews.
Evidence: middleware.ts:23-40 bypasses robots/sitemap/RSS; live audit 2026-07-15 observed bots redirected on reader pages.
Root cause: Soft-launch access and indexing policy were not modeled separately.
WHAT TO IMPLEMENT: Define private-preview versus public-launch bot policy; in private mode noindex and minimal sitemap/feed or deliberate metadata disclosure; in launch mode serve crawlable canonical pages and OG. Test known bot UAs without authentication bypass to private body content.
Acceptance criteria: Pass only when chosen mode has consistent robots/sitemap/feed/page status and no unintended draft/private content leaks.
Verification: Bot/user-agent/route matrix; Search Console-style fetch; social card inspection; live headers. iOS: N/A.
Customizability added: Operator selects documented launch mode; individual published articles may be noindex with reason.
Surfaces: web
Risk & rollback: Search deindexing can persist; default private before launch and change atomically with sitemap.
Status: Complete — crawl-policy: soft launch robots disallow all, empty sitemap, RSS channel without items; public launch allows crawl + sitemap + full RSS (admin/api still disallowed).

#58 — Publish complete, safe sports-article structured data
Area: SEO semantics Anchor: consumer-CEO benchmark
Score: 5.0 → 10.0 PRIORITY: 2.35 Launch-critical: no
Problem: JSON-LD exists but must follow canonical revisions, source/AI/correction truth, and safe serialization.
Evidence: app/(site)/articles/[slug]/page.tsx:95 injects Article JSON-LD; ranking pages inject additional schemas.
Root cause: Structured data was added before the canonical editorial model.
WHAT TO IMPLEMENT: Build typed schema generators for Article/NewsArticle, Person, Organization, Breadcrumb, and correction dates; canonical absolute URLs/images, author identity, datePublished/dateModified, isAccessibleForFree, and safe JSON escaping. Do not claim live coverage or unsupported entities.
Acceptance criteria: Pass only when every published page validates with no critical errors and values equal canonical article/provider truth.
Verification: Generator tests including injection strings; Schema.org/Rich Results validation; live sample set. iOS: N/A.
Customizability added: Brad chooses article section/tags from controlled taxonomy.
Surfaces: web
Risk & rollback: Wrong markup can harm search trust; remove invalid type while preserving page content.
Status: Complete — NewsArticle JSON-LD with free access, publisher, sport about, AI creativeWorkStatus when labeled; WebSite+Org on layout.

#59 — Generate accurate, licensed social cards per article
Area: Sharing Anchor: consumer-CEO benchmark
Score: 4.5 → 10.0 PRIORITY: 2.30 Launch-critical: no
Problem: A generic OG asset cannot communicate each take, while arbitrary hero rights may be unclear.
Evidence: README.md:14 and public/og assets expose a site-wide card; article schema has hero/credit fields (lib/db/schema.ts:48-50).
Root cause: Social metadata predates the media-rights and article revision model.
WHAT TO IMPLEMENT: Generate deterministic 1200x630 cards from title, sport, Brad byline, brand-safe background, and approved media only; cache by revision digest; include alt text, canonical Twitter/OpenGraph tags, and text fit safeguards.
Acceptance criteria: Pass only when long/Unicode titles fit, cards use licensed assets, metadata points canonical, and validators render the current revision.
Verification: Snapshot corpus; dimension/contrast/text checks; social debugger/live metadata. iOS: N/A.
Customizability added: Brad chooses approved template/accent/focal crop per article.
Surfaces: web
Risk & rollback: Bad card persists in caches; version URLs by digest and fall back to branded text-only card.
Status: Pending

#60 — Guarantee homepage chronology and empty-state truth
Area: Homepage Anchor: consumer-CEO benchmark
Score: 4.0 → 10.0 PRIORITY: 2.25 Launch-critical: yes
Problem: The homepage's “most recent” promise is false while catalog split exists and its multiple rails can repeat or overstate freshness.
Evidence: lib/homepage.ts:37-61 sorts getAllArticles; app/(site)/page.tsx:39-51 consumes it; live audit showed only five catalog rows.
Root cause: Presentation assumes complete data and mixes static rankings/media with editorial recency.
WHAT TO IMPLEMENT: Feed from canonical published revisions, dedupe lead/top/latest, show explicit last-updated context only where truthful, provide loading/empty/error states, and cap secondary rails to preserve one clear first action.
Acceptance criteria: Pass only when newest canonical article is lead, no duplicate cards exist, DB failure is honest, and primary latest action is within one tap.
Verification: Feed fixtures; fault injection; six-width visual/keyboard/performance sweep; live title parity. iOS: N/A.
Customizability added: Reader may prioritize favorite sports after default chronological feed; “all latest” remains one tap.
Surfaces: web
Risk & rollback: Personalization can create filter bubbles; default remains chronological and reset visible.
Status: Pending

#61 — Complete every article loading, empty, error, and unavailable state
Area: Article UX Anchor: Apple OS benchmark
Score: 5.0 → 10.0 PRIORITY: 2.20 Launch-critical: yes
Problem: Direct fallback can mask DB outages and comments/media/related failures can create misleading partial pages.
Evidence: lib/articles.ts:155-180 catches DB errors and falls back silently; app/error.tsx and app/not-found.tsx are global only.
Root cause: Resilience was implemented as invisible source switching.
WHAT TO IMPLEMENT: Remove production fallback after item #6; classify not-found, unpublished, temporarily unavailable, partial comments/media, and stale cache; preserve article reading when ancillary services fail and expose retry/request ID without internals.
Acceptance criteria: Pass only when each injected failure yields the correct status/message, no draft leaks, and article body remains when only ancillary systems fail.
Verification: Fault/status matrix; accessibility; slow/offline/reconnect browser sweep; live 404/known article. iOS: N/A.
Customizability added: Reader retries/collapses unavailable ancillary sections; truth labels fixed.
Surfaces: web
Risk & rollback: Strict DB failure can reduce availability; use last-known approved revision cache with explicit timestamp.
Status: Pending

#62 — Make related-story recommendations explainable and diverse
Area: Article discovery Anchor: consumer-CEO benchmark
Score: 5.5 → 10.0 PRIORITY: 2.15 Launch-critical: no
Problem: Related stories are same-sport then recent fallback, which can repeat weak or stale matches.
Evidence: lib/articles.ts:183-214 implements only sport/recent logic.
Root cause: Small launch catalog favored deterministic simplicity.
WHAT TO IMPLEMENT: Score sport/team/tag/entity, source-independent editorial similarity, recency, and diversity; exclude current/unpublished/duplicate; show “More on X” reason; retain deterministic fallback and cap.
Acceptance criteria: Pass only when fixture recommendations are relevant, diverse, published, unique, and explainable.
Verification: Golden ranking tests; small-catalog/one-item cases; article visual sweep. iOS: N/A.
Customizability added: Reader hides a topic and prioritizes favorite sports; reset available.
Surfaces: web
Risk & rollback: Personalization can narrow views; default deterministic model and versioned scorer.
Status: Pending

#63 — Preserve archive filters in shareable URLs
Area: Archive Anchor: Apple OS benchmark
Score: 5.5 → 10.0 PRIORITY: 2.10 Launch-critical: no
Problem: Sport/search/sort navigation must survive refresh, back, and shared links without confusing state.
Evidence: README.md:37 promises archive search/filter; SiteHeader links sport filters through query strings.
Root cause: Filter controls and navigation history lack an explicit contract.
WHAT TO IMPLEMENT: Validate URL parameters, canonicalize defaults, update history appropriately, restore focus/scroll, show active removable chips and result count, and render no-results suggestions server-side.
Acceptance criteria: Pass only when copy/refresh/back reproduces state, invalid params safely reset, and keyboard/mobile users can clear all.
Verification: URL property tests; browser history/deep-link matrix; six widths and screen reader. iOS: N/A.
Customizability added: Reader selects sport, date, AI disclosure, and sort; saved locally with reset.
Surfaces: web
Risk & rollback: Canonicalization can break old links; support documented aliases and 308 only when equivalent.
Status: Complete — parseArchiveFilters + buildArchiveHref + sort/chips/result count; invalid sport/sort fail safe; defaults omitted from URLs; form GET preserves shareable state.

#64 — Validate every rankings movement directive before publication
Area: Rankings engine Anchor: sports-newsroom benchmark
Score: 4.5 → 10.0 PRIORITY: 2.05 Launch-critical: yes
Problem: HTML comment directives can move teams from article text without a structured approval/validation boundary.
Evidence: README.md:86-99 documents bb:trash directives; lib/rankings.ts parses and applies movement.
Root cause: A convenient editorial syntax became executable ranking state.
WHAT TO IMPLEMENT: Parse into typed preview; validate league/team/drop bounds/reason, require approved article revision and Brad confirmation, store ranking_events with before/after and directive digest, reject duplicates/conflicts, and never execute from unsanitized arbitrary HTML.
Acceptance criteria: Pass only when invalid/unapproved directives move nothing and approved event produces one reversible audited movement.
Verification: Parser fuzz/bounds/duplicate tests; preview/publish transaction; live approved fixture. iOS: N/A.
Customizability added: Brad edits drop/reason in structured control and previews full order.
Surfaces: web
Risk & rollback: Wrong movement damages editorial trust; event-sourced recomputation and revert event.
Status: Pending

#65 — Show rankings provenance and freshness instead of “live”
Area: Rankings UX Anchor: sports-newsroom benchmark
Score: 5.0 → 10.0 PRIORITY: 2.00 Launch-critical: yes
Problem: Rankings UI uses “live” language although movements are Brad's editorial events, not real-time league data.
Evidence: app/(site)/page.tsx:223-227 labels “Franchise rankings · live”; README.md:88-99 describes opinion/demotion logic.
Root cause: Broadcast shorthand obscures the product's true source.
WHAT TO IMPLEMENT: Label “Brad's rankings,” show last editorial update, movement reason/article, baseline version, and methodology; remove live unless freshness contract is met. Add change history and accessible movement text beyond color/arrows.
Acceptance criteria: Pass only when every rank/movement is attributable and no unsupported live claim remains.
Verification: Copy/build search; history fixtures; six-width/screen-reader ranking sweep; live check. iOS: N/A.
Customizability added: Reader selects league and baseline/current comparison; Brad controls published rationale.
Surfaces: web
Risk & rollback: Extra context can clutter; progressive disclosure with concise default.
Status: Complete — homepage + rankings page state editorial methodology; no live-scores claim on ranking rails.

#66 — Separate analytics identity salt from authentication secrets
Area: Analytics security Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 1.95 Launch-critical: yes
Problem: Analytics falls back to JWT_SECRET or a public constant for hashing identifiers.
Evidence: lib/analytics.ts:62 uses ANALYTICS_HASH_SALT || JWT_SECRET || bb-sports-analytics-v1.
Root cause: Optional analytics configuration reused an unrelated critical secret.
WHAT TO IMPLEMENT: Require independent high-entropy ANALYTICS_HASH_SALT when analytics is enabled, version/rotate pseudonyms with bounded overlap, disable hashing/event write when absent, and never expose salt/post-hash linkage.
Acceptance criteria: Pass only when analytics cannot use JWT/default salt, rotation works, and missing config fails closed without breaking pages.
Verification: Env matrix; deterministic/version tests; canary secret scan; live disabled/enabled posture. iOS: N/A.
Customizability added: Operator enables privacy-safe analytics; readers can opt out.
Surfaces: web
Risk & rollback: Rotation breaks longitudinal counts; aggregate before rotation and document discontinuity.
Status: Complete — ANALYTICS_HASH_SALT required (≥16, never JWT/default); write fails closed when missing/reused; no public constant salt.

#67 — Honor consent, Global Privacy Control, and Do Not Track
Area: Analytics privacy Anchor: consumer-CEO benchmark
Score: 3.5 → 10.0 PRIORITY: 1.90 Launch-critical: yes
Problem: First-party tracking lacks a visible preference and documented treatment of browser privacy signals.
Evidence: lib/db/schema.ts:190-202 stores analytics events; middleware bypasses /api/analytics.
Root cause: “First-party” was treated as automatically consent-neutral.
WHAT TO IMPLEMENT: Define essential versus optional events; honor GPC/DNT and explicit opt-out before client ID/event emission; provide privacy settings and deletion window; avoid cookie banner if no nonessential storage is used, but document the decision.
Acceptance criteria: Pass only when opted-out/GPC users generate no optional events or IDs and essential security events remain separately justified.
Verification: Header/browser preference matrix; network/DB assertions; policy copy review. iOS: N/A.
Customizability added: Reader toggles optional analytics and resets anonymous ID.
Surfaces: web
Risk & rollback: Metrics fall; privacy wins, rollback dashboard expectations not consent.
Status: Complete — Sec-GPC/DNT/bb_analytics=0 suppress server writes; client tracker honors GPC/DNT/local opt-out; cookies policy documents matrix.

#68 — Turn analytics into an actionable, privacy-safe newsroom dashboard
Area: Audience insights Anchor: consumer-CEO benchmark
Score: 5.0 → 10.0 PRIORITY: 1.85 Launch-critical: no
Problem: Event/path counts exist but do not answer retention, article completion, subscription, or source quality with confidence.
Evidence: lib/db/schema.ts:190-202 stores generic events; app/admin/audience/page.tsx renders top events/paths.
Root cause: Collection preceded a governed event schema and decision model.
WHAT TO IMPLEMENT: Version allowlisted events/properties; add article read depth buckets, search success, subscription/support funnels, referrer category, data-quality/consent coverage, bot filtering, aggregation and retention. No raw URL queries or fingerprinting.
Acceptance criteria: Pass only when invalid properties reject, dashboard totals reconcile to fixtures, PII scans pass, and every chart names decision/coverage.
Verification: Event schema/property tests; reconciliation; load/privacy review; mobile dashboard. iOS: N/A.
Customizability added: Brad selects date/sport/article/source filters and saved views.
Surfaces: web
Risk & rollback: Bad analytics drives bad choices; show sample/coverage and version events.
Status: Pending

#69 — Fulfill data access and deletion requests safely
Area: Privacy operations Anchor: consumer-CEO benchmark
Score: 3.5 → 10.0 PRIORITY: 1.80 Launch-critical: yes
Problem: Personal data spans many tables with no verified export/delete workflow.
Evidence: lib/db/schema.ts:74-202 contains sessions, subscribers, contacts, donations, comments, analytics.
Root cause: Legal rights surface and technical fulfillment were not connected.
WHAT TO IMPLEMENT: Add authenticated email-token request intake, identity verification, scoped export, deletion/anonymization map with legal/payment holds, deadlines, audit, and secure expiring download; exclude other users and secrets.
Acceptance criteria: Pass only when fixture person export is complete, deletion obeys table policy/FKs, another identity is excluded, and audit stores no exported body.
Verification: Multi-identity integration; token expiry; retention/hold cases; encrypted export inspection. iOS: N/A.
Customizability added: Requester selects access, correction, deletion, or suppression.
Surfaces: web
Risk & rollback: Wrong-person disclosure/deletion; dual verification and dry-run manifest; irreversible delete only after confirmation.
Status: Pending

#70 — Publish a truthful public status surface
Area: Reliability communication Anchor: consumer-CEO benchmark
Score: 3.0 → 10.0 PRIORITY: 1.75 Launch-critical: no
Problem: /status returns 404 and readers/operators have no simple incident truth.
Evidence: Live audit 2026-07-15: /status=404; /api/health is machine-oriented.
Root cause: Health probe was mistaken for incident communication.
WHAT TO IMPLEMENT: Add /status with current web/database/editorial-delivery posture from bounded cached readiness, last checked time, incidents/maintenance, and no secrets/provider credentials. Admin can post signed incident updates with audit.
Acceptance criteria: Pass only when status distinguishes operational/degraded/outage/stale monitor and never claims green on stale data.
Verification: Fault/time-travel fixtures; accessibility/mobile; live health/status correlation. iOS: N/A.
Customizability added: Brad/operator writes incident copy and maintenance windows; system state source fixed.
Surfaces: web
Risk & rollback: Same-app outage hides status; document external status provider as later optional, not falsely claim independence.
Status: Complete — public /status with overall + web/db/editorial/scores posture, release SHA, machine probe links; gate-bypassed.

#71 — Define SLOs and alert on reader-impacting failures
Area: Observability Anchor: publishing-reliability benchmark
Score: 3.5 → 10.0 PRIORITY: 1.70 Launch-critical: yes
Problem: No measured availability/latency/error/freshness objectives or escalation evidence exists.
Evidence: app/api/health/route.ts measures DB latency only; Railway hosts one web service per README.md:121-123.
Root cause: Monitoring is probe-based rather than user-journey based.
WHAT TO IMPLEMENT: Define SLOs for page availability, p95 latency, DB readiness, publish-to-live, breaking signal-to-alert, newsletter queue, comments, and payment webhooks; instrument redacted metrics, burn-rate alerts, runbooks, owner, and maintenance rules.
Acceptance criteria: Pass only when synthetic faults trigger the right alert within budget, recovery resolves it, and dashboards show SLI/SLO windows.
Verification: Fault injection; alert delivery/ack; runbook drill; live canary journeys. iOS: N/A.
Customizability added: Operator sets alert channels/quiet routing, not weaker SLO truth.
Surfaces: web
Risk & rollback: Alert fatigue; tune burn rates and dedupe while retaining coverage.
Status: Pending

#72 — Correlate errors without leaking reader or newsroom data
Area: Logging Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 1.65 Launch-critical: yes
Problem: Cross-route incidents are hard to trace, while raw errors may include emails, tokens, bodies, or provider payloads.
Evidence: API routes often return err.message; schemas contain sensitive fields across audience/auth/media.
Root cause: No shared request ID, error taxonomy, or redaction boundary.
WHAT TO IMPLEMENT: Generate request IDs, structured severity/code/route/release logs, recursive secret/PII redaction, sampled stacks server-side, client error boundary correlation, retention, and admin incident search. Never log request bodies/auth headers/tokens.
Acceptance criteria: Pass only when one injected journey is traceable end-to-end and canary secrets/emails are absent from logs/errors.
Verification: Canary/fuzz redaction; correlated fault; retention cleanup; live safe 4xx/5xx. iOS: N/A.
Customizability added: Operator filters severity/release/request ID and tunes sampling within privacy floors.
Surfaces: web
Risk & rollback: Over-redaction obscures diagnosis; preserve reason codes/digests, not sensitive values.
Status: Pending

#73 — Make rollback a tested release operation
Area: Release operations Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 1.60 Launch-critical: yes
Problem: Git/Railway rollback does not by itself undo migrations, config rotation, queued jobs, or cached artifacts.
Evidence: README.md:121-123 documents auto-deploy only; no rollback drill/runbook found.
Root cause: Deploy path exists without a whole-system recovery contract.
WHAT TO IMPLEMENT: Document code/config/migration/content/provider rollback classes; require expand/contract compatibility, release manifest, Railway deployment ID, backup, kill switches, cache purge, smoke, and forward-fix criteria. Run quarterly drill.
Acceptance criteria: Pass only when an intentionally bad reversible release returns to verified live state within target without data loss.
Verification: Staging drill; exact commit/deployment/cache checks; migration compatibility; evidence log. iOS: N/A.
Customizability added: Operator chooses rollback or forward-fix based on written thresholds.
Surfaces: web
Risk & rollback: Drill itself can disrupt; staging first and production maintenance approval.
Status: Pending

#74 — Enforce one reproducible quality gate from a fresh clone
Area: Engineering quality Anchor: Apple OS benchmark
Score: 5.0 → 10.0 PRIORITY: 1.55 Launch-critical: yes
Problem: Existing check covers lint/types/tests/build but not audit, migration drift, route guards, content integrity, or a fresh install.
Evidence: package.json:6-15 defines npm run check; repo scan found 18 test files and no CI workflow.
Root cause: Quality command reflects earlier v1 scope.
WHAT TO IMPLEMENT: Extend check with clean install/lock audit, security, migration checksum, schema drift, route-guard inventory, content/source/license validation, accessibility smoke, and standalone start. Run in a neutral runner before merge and store artifact digests.
Acceptance criteria: Pass only when one documented command from fresh clone verifies all gates and a seeded defect in each class fails.
Verification: Fresh detached clone; defect mutation tests; runtime/budget report; Docker parity. iOS: N/A.
Customizability added: Developer may run scoped fast commands; merge gate is fixed.
Surfaces: web
Risk & rollback: Slow/flaky gate delays release; remove nondeterminism and cache dependencies, never skip critical classes.
Status: Pending

#75 — Expand production smoke into a full browser journey matrix
Area: Live verification Anchor: Apple OS benchmark
Score: 5.0 → 10.0 PRIORITY: 1.50 Launch-critical: yes
Problem: HTTP smoke cannot prove wall/login/admin/editorial interactions, layout, accessibility, or console cleanliness.
Evidence: scripts/smoke-production.mjs exists; Perfection Engine device matrix is docs/BB-SPORTS-PERFECTION-ENGINE-v1.0.md:207-242.
Root cause: Release verification optimized for fast endpoint checks.
WHAT TO IMPLEMENT: Keep deterministic HTTP smoke, then Playwright wall exact-password/admin separation, anonymous protections, home/archive/search/article/comments, newsletter mode, support, status, console/network, keyboard, overflow, and screenshot journeys at six primary widths. Use synthetic tagged data and guaranteed cleanup.
Acceptance criteria: Pass only when expected commit is live, every journey passes, zero unexpected console errors/overflow, and cleanup leaves real rows untouched.
Verification: Run against local production build then exact-SHA Railway/apex after cache clear; archive traces/screenshots. iOS: N/A—browser matrix is authoritative.
Customizability added: Operator selects non-destructive optional provider journeys; core matrix fixed.
Surfaces: web
Risk & rollback: Live tests may create noise; isolate/tag/cleanup and keep read-only defaults.
Status: Pending

#76 — Establish automated WCAG 2.2 AA gates
Area: Accessibility Anchor: Apple OS benchmark
Score: 5.0 → 10.0 PRIORITY: 1.48 Launch-critical: yes
Problem: Responsive checks exist, but no complete automated accessibility contract protects every public/admin template.
Evidence: docs/BB-SPORTS-PERFECTION-ENGINE-v1.0.md:222-242 requires contrast, targets, state completeness, and device proof; no axe dependency/test is present in package.json.
Root cause: Accessibility is represented by styling conventions and manual review.
WHAT TO IMPLEMENT: Add axe-based tests for wall, login, home, archive, search, article, rankings, forms, legal, status, and every admin template; enforce landmarks, names, heading order, contrast, form errors, table semantics, and no serious/critical violations. Document manual exceptions with owner/expiry.
Acceptance criteria: Pass only when automated scans have zero serious/critical issues and manual screen-reader/zoom checks pass primary journeys.
Verification: CI/local scan at six widths, 200%/400% zoom, VoiceOver Safari/Chrome keyboard spot checks. iOS: N/A; mobile Safari responsive web applies.
Customizability added: Accessibility preferences can enhance presentation but never disable semantics.
Surfaces: web
Risk & rollback: False positives can block release; fix test setup or time-bound documented exception, not blanket-disable rules.
Status: Pending

#77 — Make focus and keyboard behavior deterministic
Area: Interaction accessibility Anchor: Apple OS benchmark
Score: 5.0 → 10.0 PRIORITY: 1.46 Launch-critical: yes
Problem: Dynamic forms, horizontal navigation, editor previews, moderation actions, and redirects need explicit focus restoration and visible order.
Evidence: components/SiteHeader.tsx:72-98 uses horizontal overflow navigation; admin layout has many dense links/actions.
Root cause: Visual layout was implemented before a cross-surface keyboard contract.
WHAT TO IMPLEMENT: Add skip link, visible focus tokens, logical DOM order, focus-on-error/heading after navigation, dialog trapping/return, roving behavior only where appropriate, and no keyboard traps. Preserve form input on validation.
Acceptance criteria: Pass only when every primary journey completes keyboard-only, focus is always visible/logical, and scrollable nav controls are reachable.
Verification: Tab-order snapshots and manual keyboard at six widths; screen-reader announcements; reduced-motion interaction. iOS: N/A.
Customizability added: Reader may enable always-visible focus/high contrast; core behavior fixed.
Surfaces: web
Risk & rollback: Programmatic focus can disorient; limit to user-triggered state changes and test history/back.
Status: Pending

#78 — Respect reduced motion and stop attention-stealing animation
Area: Motion accessibility Anchor: Apple OS benchmark
Score: 5.5 → 10.0 PRIORITY: 1.44 Launch-critical: no
Problem: Ticker/pulse and hover motion can distract or imply urgency; reduced-motion CSS covers only named animations.
Evidence: components/BreakingNewsBar.tsx:35-64 animates pulse/marquee with a local media rule.
Root cause: Motion rules are component-specific rather than system-wide.
WHAT TO IMPLEMENT: Create motion tokens, default no auto-moving content for desk items, global prefers-reduced-motion handling, pause controls for any essential movement, no parallax/autoplay, and stable layout during transitions.
Acceptance criteria: Pass only when reduced-motion yields zero nonessential animation and all information remains available without motion.
Verification: Browser media emulation, animation inventory, visual snapshots and keyboard pause. iOS: N/A.
Customizability added: Reader selects system/default/minimal motion; urgent truth is conveyed by text, not animation alone.
Surfaces: web
Risk & rollback: Removing motion reduces visual energy; preserve branded static states.
Status: Pending

#79 — Give readers first-class reading controls
Area: Article readability Anchor: consumer-CEO benchmark
Score: 5.5 → 10.0 PRIORITY: 1.42 Launch-critical: no
Problem: One fixed typography/density cannot serve every reader or long article.
Evidence: README.md:74-80 defines one broadcast/editorial type system; device checklist requires body at least 16px and line length at most 75ch.
Root cause: Brand typography was optimized globally rather than as reader preferences.
WHAT TO IMPLEMENT: Add local-first controls for text size, line height, content width, serif/sans body, light/dark/system, and distraction-reduced article mode; clamp to WCAG-safe values and prevent layout shift. No account required.
Acceptance criteria: Pass only when every setting persists, reset works, 200% zoom/375px has no overflow, and controls never hide disclosures/sources/corrections.
Verification: Preference matrix, storage-disabled fallback, visual/contrast/print snapshots. iOS: N/A.
Customizability added: Exact type, spacing, width, theme, and focus mode controls.
Surfaces: web
Risk & rollback: Theme combinations can fail contrast; expose only validated token sets and reset.
Status: Pending

#80 — Certify every surface across the real device matrix
Area: Responsive UX Anchor: Apple OS benchmark
Score: 5.0 → 10.0 PRIORITY: 1.40 Launch-critical: yes
Problem: Broad responsive styling does not prove zero overflow, usable targets, safe-area behavior, or dense admin tables on target widths.
Evidence: Perfection Engine matrix is docs/BB-SPORTS-PERFECTION-ENGINE-v1.0.md:207-220; current header/admin use horizontal/dense layouts.
Root cause: Device verification is episodic rather than release evidence.
WHAT TO IMPLEMENT: Create route-state screenshot manifest at 375x667, 393x852, 440x956, 820x1180, 1440x1000, and 1920x1080; assert scrollWidth, 44px targets, text clipping, sticky/safe-area, orientation, keyboard viewport, and adjacent empty/error states.
Acceptance criteria: Pass only when all manifest states have no unintended overflow/truncation and essential actions remain visible/reachable.
Verification: Automated metrics/screenshots plus manual iPhone Safari/iPad spot check; archive baselines per release. iOS: N/A—this is web on iOS browsers.
Customizability added: Responsive personalization controls from items #79/#84-#88 must also pass.
Surfaces: web
Risk & rollback: Brittle screenshots; assert semantics/geometry and review intentional pixel changes.
Status: Pending

#81 — Enforce Core Web Vitals and bundle budgets
Area: Performance Anchor: Apple OS benchmark
Score: 4.5 → 10.0 PRIORITY: 1.38 Launch-critical: yes
Problem: Imagery, fonts, admin JS, feeds, and future breaking streams can regress phone performance without a budget.
Evidence: app/(site)/page.tsx:54-133 has image-heavy hero/rail; package.json check has no Lighthouse/bundle budget.
Root cause: Build success is not user-perceived performance proof.
WHAT TO IMPLEMENT: Set mobile p75 targets LCP≤2.5s, INP≤200ms, CLS≤0.1 and route JS/image/font/request budgets; measure local Lighthouse and privacy-safe field data; optimize RSC/client boundaries, fonts, caching, streaming, and third-party isolation.
Acceptance criteria: Pass only when representative routes meet budgets under mobile throttling and a seeded oversized asset/bundle fails.
Verification: Lighthouse runs, bundle analyzer artifact, Web Vitals canary, slow-3G journey. iOS: N/A.
Customizability added: Data-saver mode disables nonessential media/stream updates.
Surfaces: web
Risk & rollback: Aggressive caching can stale editorial truth; key caches by revision/freshness and purge on publish.
Status: Pending

#82 — Optimize every image without compromising rights or meaning
Area: Images Anchor: consumer-CEO benchmark
Score: 5.0 → 10.0 PRIORITY: 1.36 Launch-critical: no
Problem: Hero/player/media assets need consistent dimensions, alt, focal crop, responsive formats, and licensing.
Evidence: app/(site)/page.tsx:26-37 and 60-68 uses original SVG rails/hero; article schema allows hero/alt/credit.
Root cause: Asset handling is spread across static files and free-text URLs.
WHAT TO IMPLEMENT: Centralize approved asset metadata; require width/height/aspect/alt/credit/digest, generate AVIF/WebP fallbacks and responsive sizes, lazy-load below fold, preserve priority only for true LCP, and flag decorative alt. Apply media rights item #43.
Acceptance criteria: Pass only when no missing dimensions/required alt/credit, no oversized delivery beyond budget, and LCP/CLS pass.
Verification: Asset inventory validator, visual regression, network byte audit, screen-reader sample. iOS: N/A.
Customizability added: Brad chooses approved crop/focal point; reader data-saver gets lighter rendition.
Surfaces: web
Risk & rollback: Compression/crop can alter editorial meaning; retain original and preview exact renditions.
Status: Pending

#83 — Degrade gracefully on slow, offline, and reconnecting networks
Area: Resilience UX Anchor: Apple OS benchmark
Score: 4.5 → 10.0 PRIORITY: 1.34 Launch-critical: no
Problem: Reader/admin actions can fail ambiguously during poor connectivity and retries can duplicate mutations.
Evidence: Network requirements are docs/BB-SPORTS-PERFECTION-ENGINE-v1.0.md:247-251; APIs include comments/newsletter/donations/editor saves.
Root cause: Happy-path HTTP behavior lacks a shared offline/idempotency model.
WHAT TO IMPLEMENT: Add bounded timeouts, retry only safe/idempotent calls with jitter, client offline/reconnecting banners, cached last-approved article shells where safe, preserved form drafts, idempotency keys for mutations, and never cache admin/PII pages.
Acceptance criteria: Pass only when offline reading is honest, writes do not duplicate, input survives, reconnect recovers, and stale content shows timestamp.
Verification: Playwright offline/slow-3G/reconnect; duplicate-key tests; cache/privacy inspection. iOS: N/A.
Customizability added: Reader enables data saver/offline saved articles; admin controls remain online-required.
Surfaces: web
Risk & rollback: Cache can expose/stale data; cache only public approved revisions, versioned and purgeable.
Status: Pending

#84 — Let readers favorite sports and teams without an account
Area: Personalization Anchor: consumer-CEO benchmark
Score: 3.5 → 10.0 PRIORITY: 1.32 Launch-critical: no
Problem: Multi-sport readers cannot prioritize their interests while retaining the simple chronological product.
Evidence: lib/articles.ts:43-61 defines sports; rankings contain teams; homepage remains chronological by design (lib/homepage.ts:37-60).
Root cause: v1 offers global filters only.
WHAT TO IMPLEMENT: Add local-first validated favorite sports/team IDs, onboarding-free star controls, optional favorite rail after the universal latest feed, and reset/export. No hidden tracking or account required; unknown/renamed IDs migrate safely.
Acceptance criteria: Pass only when favorites persist locally, never remove access to all-latest, work with storage disabled, and do not create server PII.
Verification: Preference/version tests; homepage/archive/rankings at six widths; clear/reset. iOS: N/A.
Customizability added: Exact favorite sports and teams, ordering, and show/hide favorite rail.
Surfaces: web
Risk & rollback: Personalization can narrow worldview; universal chronological feed remains default and one tap away.
Status: Pending

#85 — Add a configurable breaking-news watchlist
Area: Breaking alerts Anchor: sports-newsroom benchmark
Score: 3.0 → 10.0 PRIORITY: 1.30 Launch-critical: no
Problem: The real-time desk item #5 needs precise editorial monitoring rather than a noisy all-sports firehose.
Evidence: Coverage priorities are documented in docs/BB-SPORTS-PERFECTION-ENGINE-v1.0.md:81-87; no watchlist schema exists.
Root cause: Static ticker had no ingestion routing preferences.
WHAT TO IMPLEMENT: Add admin watchlist rules for sport, league, team, player, reporter/source, keywords/exclusions, urgency, quiet hours, and expiry; validate against authorized source registry and cap rule count. Show match explanation and false-positive feedback without auto-publish.
Acceptance criteria: Pass only when fixtures match expected rules once, exclusions/quiet hours work, unauthorized sources remain disabled, and Brad approval remains mandatory.
Verification: Rule property/dedupe/timezone tests; mobile rule editor; live manual signal. iOS: N/A.
Customizability added: Full Brad-controlled newsroom watchlist, alert priority, and quiet hours.
Surfaces: web
Risk & rollback: Bad rules miss news or spam; version rules, test preview, global pause.
Status: Pending

#86 — Let readers reorder primary navigation safely
Area: Navigation Anchor: Apple OS benchmark
Score: 5.0 → 10.0 PRIORITY: 1.28 Launch-critical: no
Problem: Eight fixed links in a horizontally scrolling mobile strip may not match each reader's priorities.
Evidence: components/SiteHeader.tsx:8-17 defines fixed NAV and lines 72-98 render horizontal scroll.
Root cause: Discoverability avoided a hamburger but did not add controlled personalization.
WHAT TO IMPLEMENT: Offer local drag/keyboard reorder and pin/hide for noncritical links; keep Home, Search, legal/accessibility, and reset always reachable; announce order changes, support touch/keyboard, version migrations.
Acceptance criteria: Pass only when reordered nav persists, remains accessible/overflow-safe, critical destinations cannot vanish, and reset restores default.
Verification: Pointer/keyboard/storage tests; six widths and screen reader; no-hamburger requirement. iOS: N/A.
Customizability added: Reorder, pin, and hide optional nav destinations.
Surfaces: web
Risk & rollback: Users can lose routes; protected minimum set and prominent reset.
Status: Pending

#87 — Add user-defined quick-access buttons
Area: Navigation Anchor: consumer-CEO benchmark
Score: 4.5 → 10.0 PRIORITY: 1.26 Launch-critical: no
Problem: Repeated actions such as latest Bears take, rankings, search, newsletter, or support take multiple navigation steps.
Evidence: lib/homepage.ts:10-17 defines one global action set; no personal shortcuts exist.
Root cause: Homepage actions are hard-coded for the average reader.
WHAT TO IMPLEMENT: Let readers create up to six local shortcuts from safe internal destinations and validated saved filters/team pages; render a compact optional rail, keyboard reorder, icon/text labels, and reset. Never accept arbitrary javascript/external URLs.
Acceptance criteria: Pass only when safe shortcuts work in one tap, unsafe URLs reject, labels remain accessible, and default UI is uncluttered.
Verification: URL-validation fuzz; create/reorder/delete; six widths and storage-disabled fallback. iOS: N/A.
Customizability added: Exact one-tap buttons, order, label, and visibility.
Surfaces: web
Risk & rollback: Shortcut clutter/phishing; internal route allowlist and strict cap.
Status: Pending

#88 — Add a local reading list with portable export
Area: Reader utility Anchor: consumer-CEO benchmark
Score: 4.5 → 10.0 PRIORITY: 1.24 Launch-critical: no
Problem: Readers cannot save articles for later without relying on browser bookmarks.
Evidence: Article cards/pages have share/comments/related surfaces but no saved state in README.md:33-71 inventory.
Root cause: v1 avoided reader accounts and omitted local utility.
WHAT TO IMPLEMENT: Add local-only saved canonical article IDs/revision metadata, save/remove controls, /reading-list, missing/unpublished handling, JSON/HTML export/import, and optional offline cache under item #83. No server identifier by default.
Acceptance criteria: Pass only when save/list/remove/export/import survives reload, unpublished items are honest, and no tracking request occurs.
Verification: Storage/import fuzz/version migration; article/archive/mobile/keyboard tests. iOS: N/A.
Customizability added: Reader groups/orders saved articles and chooses offline availability.
Surfaces: web
Risk & rollback: Local storage loss; portable export and graceful reset.
Status: Pending

#89 — Make share actions fast, private, and accurate
Area: Sharing Anchor: Apple OS benchmark
Score: 5.5 → 10.0 PRIORITY: 1.22 Launch-critical: no
Problem: Sharing must preserve canonical URL/current title without loading third-party trackers or implying automatic social posting.
Evidence: README.md:39 mentions share; README.md:168 lists future share-to-X auto-post, which is not currently approved.
Root cause: Reader sharing and brand-account publishing are easy to conflate.
WHAT TO IMPLEMENT: Use Web Share API when available, accessible copy-link fallback, canonical URL/revision metadata, success/error announcements, and privacy-safe outbound links; never post to Brad's accounts without separate explicit approval.
Acceptance criteria: Pass only when shared URL is canonical, copy works on unsupported browsers, no third-party script loads, and social auto-post remains off.
Verification: Browser capability matrix; clipboard denial; metadata/share-card validation; mobile. iOS: N/A.
Customizability added: Reader chooses native share/copy; Brad separately approves any brand-account post.
Surfaces: web
Risk & rollback: Stale social caches; digest-versioned cards and canonical stable URL.
Status: Pending

#90 — Offer opt-in reader alerts only after delivery consent
Area: Notifications Anchor: consumer-CEO benchmark
Score: 3.0 → 10.0 PRIORITY: 1.20 Launch-critical: no
Problem: A breaking desk creates pressure to notify readers before consent, channel ownership, or provider readiness exists.
Evidence: Item #5 is newsroom-only by default; no push provider or notification subscription table exists.
Root cause: Internal speed and public alerting are separate products.
WHAT TO IMPLEMENT: Keep internal alerts first; later add explicit email/browser notification consent by sport/team/urgency, quiet hours, frequency cap, unsubscribe, provider approval, delivery/audit, and no prompt on first page load. Require verified breaking publication and Brad approval.
Acceptance criteria: Pass only when no reader receives an alert without explicit scoped consent and every alert maps to approved published provenance.
Verification: Consent/delivery/suppression/timezone/rate tests; denied-permission UX; provider sandbox. iOS: N/A.
Customizability added: Reader chooses channel, sports/teams, urgency, cadence, and quiet hours.
Surfaces: web
Risk & rollback: Spam/reputation damage; default off, caps, kill switch, immediate unsubscribe.
Status: Pending

#91 — Make podcast status honest and launch-ready
Area: Podcast Anchor: sports-newsroom benchmark
Score: 4.0 → 10.0 PRIORITY: 1.18 Launch-critical: no
Problem: Podcast is a coming-soon page, but navigation presents it as a first-class destination without feed/episode/provider truth.
Evidence: README.md:42 and 167-169 mark podcast coming-soon/future; SiteHeader includes Podcast.
Root cause: Roadmap navigation shipped before media operations.
WHAT TO IMPLEMENT: In prelaunch, show concise status and optional consented interest capture; before launch require licensed audio storage, RSS validation, episode metadata/transcript, explicit publish approval, accessibility, analytics privacy, and failure states. Do not fabricate episodes.
Acceptance criteria: Pass only when current page says coming soon without fake players, or a launched feed validates and plays an approved real episode.
Verification: Route/copy scan; future feed validator/audio matrix/transcript check; six widths. iOS: N/A.
Customizability added: Brad controls real release date/category/artwork after evidence; readers choose interest only.
Surfaces: web
Risk & rollback: Empty nav frustrates readers; hide optional nav via #86 or retain honest preview.
Status: Pending

#92 — Make video status honest and rights-safe
Area: Video Anchor: sports-newsroom benchmark
Score: 4.0 → 10.0 PRIORITY: 1.16 Launch-critical: no
Problem: Videos is a coming-soon surface with future ingestion plans but no proven rights/storage/transcript workflow.
Evidence: README.md:43 and 168-169 marks videos coming-soon/future; media schema supports video fields.
Root cause: Navigation and media model precede production assets.
WHAT TO IMPLEMENT: Keep truthful placeholder until approved clips exist; launch requires rights/provenance, captions/transcript, poster/alt, responsive player, reduced motion/no autoplay audio, R2/provider gate, approval, and takedown.
Acceptance criteria: Pass only when no placeholder claims live clips and every launched video is approved, captioned, licensed, performant, and removable.
Verification: Copy/DOM scan; future media contract/caption/player tests at six widths and slow network. iOS: N/A.
Customizability added: Brad orders approved playlists; readers control captions/quality/autoplay off.
Surfaces: web
Risk & rollback: Rights/performance harm; quarantine asset and show honest unavailable state.
Status: Pending

#93 — Close the loop on contact and tip submissions
Area: Reader contact Anchor: consumer-CEO benchmark
Score: 4.5 → 10.0 PRIORITY: 1.14 Launch-critical: no
Problem: Submission storage exists, but readers need reliable confirmation and Brad needs status/assignment without exposing confidential content.
Evidence: lib/db/schema.ts:107-120 models contact_messages/status; README.md:46 and 67 promises contact/tips.
Root cause: Intake and admin display shipped before lifecycle.
WHAT TO IMPLEMENT: Add idempotent receipt ID, on-screen confirmation, optional approved email receipt, statuses new/reviewing/responded/closed/spam, internal notes separate from message, safe export, retention, and confidential handling item #27.
Acceptance criteria: Pass only when duplicate submit creates one message, reader gets non-sensitive receipt, status changes audit, and confidential content stays protected.
Verification: Concurrency/retry; admin lifecycle; email disabled/enabled; mobile/error preservation. iOS: N/A.
Customizability added: Sender chooses category/confidential/contact permission; Brad filters/statuses.
Surfaces: web
Risk & rollback: Receipt email could expose tip context; send generic copy only and disable transport independently.
Status: Pending

#94 — Simplify support into one truthful decision path
Area: Support page Anchor: consumer-CEO benchmark
Score: 5.0 → 10.0 PRIORITY: 1.12 Launch-critical: no
Problem: Interest capture, disabled Stripe, terms, and future payment can confuse whether money was actually accepted.
Evidence: README.md:44-45 describes interest plus Stripe handoff when verified; live audit found waiting intents and no paid rows.
Root cause: Prelaunch and payment-ready states share one conceptual surface.
WHAT TO IMPLEMENT: Render explicit modes: support-interest only, payments unavailable, or Stripe live; one primary action, clear amount/receipt/refund/independence copy, no false success before webhook, accessible errors, and status persistence.
Acceptance criteria: Pass only when each mode has one unambiguous outcome and test users can state whether they paid.
Verification: State fixtures/user comprehension checklist; Stripe item #37 integration; six widths. iOS: N/A.
Customizability added: Reader chooses allowed amount/message; Brad selects launch mode through validated provider posture.
Surfaces: web
Risk & rollback: Copy mismatch can create charge disputes; fail to unavailable mode when provider posture is uncertain.
Status: Pending

#95 — Make global navigation state and labels unambiguous
Area: Information architecture Anchor: Apple OS benchmark
Score: 5.5 → 10.0 PRIORITY: 1.10 Launch-critical: no
Problem: Header links mix launched, coming-soon, wall, login/profile, and support destinations without active/status cues.
Evidence: components/SiteHeader.tsx:8-17 and 39-61 includes Podcast, Videos, Newsletter→coming-soon, and admin icon labeled login/profile.
Root cause: Growth and future destinations accumulated in one nav.
WHAT TO IMPLEMENT: Audit labels/routes; show active state, distinguish Sign in from Profile based on active session without leaking admin, mark or de-emphasize coming-soon destinations, point Newsletter to coherent item #36 mode, preserve no-hamburger discoverability and two-tap limit.
Acceptance criteria: Pass only when every label predicts destination/state, active route is announced, no dead/ambiguous link exists, and mobile remains uncluttered.
Verification: Link/state matrix anonymous/gated/admin; usability checklist; six widths/keyboard. iOS: N/A.
Customizability added: Reader reorders optional destinations via #86; core labels/status remain truthful.
Surfaces: web
Risk & rollback: Nav changes affect habits; retain redirects and reset preferences.
Status: Pending

#96 — Maintain one commercial-use provider registry
Area: Third-party governance Anchor: publishing-reliability benchmark
Score: 3.0 → 10.0 PRIORITY: 1.08 Launch-critical: yes
Problem: Provider facts are split across docs/env/code and several services are queued or absent; commercial rights can drift.
Evidence: docs/legal/PROVIDER-POSTURE.md tracks some gates; .env.example lists Stripe, Resend, xAI, R2, live scores; next.config permits remote media domains.
Root cause: Feature flags are not an auditable inventory with terms/version/owner/expiry.
WHAT TO IMPLEMENT: Create provider registry for Railway/Postgres, Stripe, Resend, xAI/X, live scores, R2/CDN, fonts/icons/images and any new service: purpose, data sent/received, terms/privacy/DPA links and digests, commercial right, attribution, geography, cost/quota, key owner, approved/tested/renewal dates, kill switch, retention/deletion. Runtime adapters require green posture.
Acceptance criteria: Pass only when every external network/domain/package maps to a reviewed record and unapproved/expired adapters fail closed.
Verification: Static network/domain/dependency scan versus registry; expiry time travel; admin posture and disabled adapter tests. iOS: N/A.
Customizability added: Operator enables only approved adapters and alert thresholds; cannot override RED without recorded review.
Surfaces: web
Risk & rollback: Registry drift can false-block; owner/renewal alerts and manual first-party fallback.
Status: Pending

#97 — Generate an SBOM and enforce dependency license policy
Area: Supply chain Anchor: publishing-reliability benchmark
Score: 4.5 → 10.0 PRIORITY: 1.06 Launch-critical: no
Problem: Vulnerability audit does not prove package/font/icon license compatibility or artifact contents.
Evidence: package.json lists runtime/dev dependencies; README.md:25 and 78-79 names fonts/icons but no generated SBOM/license report.
Root cause: Security and commercial-use reviews are separate manual tasks.
WHAT TO IMPLEMENT: Generate CycloneDX/SPDX SBOM from lockfile/container, collect licenses/notices, deny disallowed/unknown runtime licenses unless reviewed, track bundled fonts/icons/assets, sign/store artifact digest with release.
Acceptance criteria: Pass only when every shipped component has version/license/source and a seeded forbidden/unknown dependency fails.
Verification: Fresh build SBOM; container/file comparison; license policy tests; release digest. iOS: N/A.
Customizability added: None; operator may approve documented exceptions with owner/expiry.
Surfaces: web
Risk & rollback: Metadata errors block release; correct package evidence or replace dependency, not waive silently.
Status: Pending

#98 — Practice secret rotation and least-privilege recovery
Area: Secrets operations Anchor: publishing-reliability benchmark
Score: 4.0 → 10.0 PRIORITY: 1.04 Launch-critical: yes
Problem: Gate/JWT/analytics/provider/database secrets have different blast radii but no tested rotation sequence.
Evidence: .env.example lists feature secrets; lib/auth.ts and lib/gate-cookie.ts use separate signing keys; item #1 requires gate rotation.
Root cause: Secrets were added feature-by-feature.
WHAT TO IMPLEMENT: Inventory owner/scope/min length/creation/last rotation/dependents; remove unused aliases; define dual-key grace only where safe, immediate revocation for compromise, Railway update order, deploy verification, rollback, and no-value posture checks. Run a non-production drill, then approved production rotations.
Acceptance criteria: Pass only when each active secret can rotate without data loss, old credentials fail after window, service recovers within target, and values never enter evidence.
Verification: Staging rotation matrix; captured-token/key replay; live non-secret fingerprints/health after approved rotation. iOS: N/A.
Customizability added: Operator schedules reminders and grace within safe policy.
Surfaces: web
Risk & rollback: Rotation outage; one secret at a time, break-glass ownership, issue new key instead of restoring compromised one.
Status: Pending

#99 — Keep this Top-100 ledger executable and self-auditing
Area: Program governance Anchor: consumer-CEO benchmark
Score: 4.0 → 10.0 PRIORITY: 1.02 Launch-critical: no
Problem: A static backlog can drift from code/live truth and encourage false completion.
Evidence: This ledger begins Pending; the attached Top-100 directive requires each item terminal only after merge, deploy, and live proof.
Root cause: Long programs need durable status, dependencies, release evidence, and re-ranking.
WHAT TO IMPLEMENT: Add per-item owner/dependencies/commit/PR/deployment/live evidence/device evidence/affidavit/blocker fields when work starts; permit only Pending, In progress, Implemented, Absorbed, Blocked; validate exactly 100 unique ranks and required schema; re-score after each interval without renumbering history.
Acceptance criteria: Pass only when status validator rejects missing evidence/invalid transitions and Implemented requires exact live proof.
Verification: Structural parser tests; seeded invalid ledger; link/evidence audit after every deployment. iOS: N/A remains justified per item.
Customizability added: Operator filters lanes/status and annotates sequencing; completion rules fixed.
Surfaces: web
Risk & rollback: Administrative overhead; automate extraction from releases but preserve human verification.
Status: Pending

#100 — Maintain a one-person newsroom operating handbook
Area: Operations Anchor: consumer-CEO benchmark
Score: 5.0 → 10.0 PRIORITY: 1.00 Launch-critical: no
Problem: Brad is the sole editor and cannot be expected to infer technical recovery, editorial, provider, privacy, or launch procedures from code.
Evidence: docs/BB-SPORTS-PERFECTION-ENGINE-v1.0.md:32-40 states one-person operation and live-device verification; README.md spreads operations across many feature docs.
Root cause: Capabilities accumulated faster than one concise role-based playbook.
WHAT TO IMPLEMENT: Publish a versioned handbook with daily desk flow, breaking verification, source/correction/AI approval, publish rollback, comments/tips, newsletter, donations, provider RED/GREEN, incident/security contacts, backup/restore, launch mode, and “what Brad sees” screenshots. Each runbook names owner, prerequisites, exact safe actions, verification, escalation, and last drill.
Acceptance criteria: Pass only when Brad can complete core editorial journeys and identify stop/escalate conditions from the handbook without code access.
Verification: Tabletop with Brad/operator, timed task checklist, link freshness, quarterly drills, and update-on-change test in PR checklist. iOS: N/A—handbook covers responsive web/device verification.
Customizability added: Brad chooses dashboard shortcuts, alerts, and preferred checklist presentation; safety/editorial gates remain fixed.
Surfaces: web
Risk & rollback: Stale instructions are dangerous; version, owner, expiry, and fail the change gate when referenced flows drift.
Status: Pending
