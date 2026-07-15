# Changelog

All notable changes to BB Sports. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Expanded encyclopedia people registry to 130 first-party cited figures (was 51), with deep Brad-bias coverage for Bears / Panthers / Cubs / Bulls plus broader NFL–NHL–MLB–NBA faces. Club-page citations only; no proprietary career-stat tables. Bootstrap now upserts people identity/role so trade-window corrections land on deploy.
- Shipped a first-party sports encyclopedia foundation: complete NFL/MLB/NHL/NBA franchise registries (124 teams) with source citations, a small cited people set, `/teams` UI, and `/api/teams` — public identity facts only, not a proprietary stats scrape.
- Expanded the encyclopedia people registry (40+ cited figures), added `/people` pages, encyclopedia search on `/api/teams?q=`, and production smoke coverage for teams/people surfaces.
- Added conference/division filters on league team pages, homepage/footer entry points to the encyclopedia, and major-league player-face rail links into `/teams/{league}`.
- Defined the zero-credential real-time newsroom foundation, deterministic owner-independent verification threshold, Brad-only publish boundary, protected SSE/fallback contract, Railway worker topology, provider kill switches, incident/correction runbooks, and source-by-source commercial activation posture.
- Added provider governance persistence without activating any connector: `news_providers`, lease/fencing, checkpoint, ingest-attempt, and dead-letter tables; pure activation evaluation that never allows transport from configuration alone; credential presence without secret exposure; and filtered handling of known-harmless Postgres bootstrap notices.
- Added the authoritative provider ingest transaction: bounded normalization, fail-closed commercial/config/source gates, exact dedupe, atomic signal/event/activity writes, ingest-attempt ledger, X/Bluesky lead mappers, and dark `provider-intake:*` sources — still no live transport.
- Added the always-on newsroom worker skeleton (bundled `ops/newsroom-worker.mjs`): lease heartbeats, bounded queue/backpressure, backoff helpers, health/readiness HTTP, SIGTERM drain — default-off, never claims active ingest, no provider transport in the Next.js request process.
- Surfaced honest external provider status on the news desk snapshot/UI (inactive/degraded/live labels, commercial/config/credential/lease posture, dead-letter count) while keeping `transportAllowed: false` and Manual-only default copy.
- Added SSRF-safe RSS URL policy helpers and default-off RSS static preflight (HTTPS-only, blocked private IPs, redirect/size/XML hardening contract) without enabling live feed fetch.

### Security

- Enforced Content-Security-Policy (default-src self, object-src none, frame-ancestors self, form-action self, upgrade-insecure-requests) and HSTS (2-year + includeSubDomains + preload) on every response; Markdown sanitization remains the primary XSS barrier.
- Upgraded Next.js and its lint peer to 15.5.20, pinned patched PostCSS/esbuild resolutions, and made a zero-moderate-or-higher `npm audit` part of `npm run check`.
- Made Postgres session rows authoritative for newsroom access: missing, expired, revoked, user-mismatched, or disallowed-role sessions now fail closed even when a JWT signature is valid.
- Added issuer, audience, purpose, subject, JTI, and current-role validation to the admin session boundary; login records the session before issuing its cookie and logout no longer hides failed revocation.
- Added page-level guards to every protected newsroom page and handler-level guards to every protected admin API method.
- Replaced unrestricted `site_config` reads/writes with four typed, validated, non-secret settings and prevented unapproved media access with signature-only/revoked sessions.
- Added an idempotent cleanup for the malformed historical access-wall JSONB row so its retired alternate credential cannot survive deployment.
- Removed the committed access-wall fallback credential. The operator recovery password now lives only in Railway.
- Replaced the forgeable `bb_gate=1` access cookie with an HS256-signed, expiring cookie whose secret can be rotated to revoke every existing wall session.
- Kept the public access wall and newsroom authentication as separate security boundaries.

### Fixed

- Isolated `/coming-soon` from the public site layout so the hidden header, ticker, footer, analytics, and links no longer remain in the DOM or keyboard focus order behind the white wall.
- Taught the production smoke gate to obtain and use a fresh signed access cookie instead of relying on a hard-coded boolean cookie.

## [0.3.0] — 2026-05-18 · "V1 launch reset"

Brad's nine-directive launch reset. Stripped the homepage of sport
categorisation, shipped a franchise rankings engine that moves teams
based on Brad's columns, added player imagery to the face of the site,
swapped "bullshit" for "BS" across every public surface, and built the
admin / SEO / API surface area around the new rankings feature.

### Added

- **Franchise rankings** — `/rankings` ranks Brad's top-25 in NFL, MLB,
  NHL, and NBA. Hand-curated baseline with sport-tinted league sections
  and a sticky league nav.
- **Demotion engine** — `<!-- bb:trash league=X team=Y drop=N reason="…" -->`
  directives in article bodies move the team and surface the column as
  the reason on `/rankings`. Spec at
  [`docs/RANKINGS-DEMOTION-DIRECTIVE.md`](docs/RANKINGS-DEMOTION-DIRECTIVE.md).
- **Per-team pages** — 100 deep-linkable team pages at
  `/rankings/[league]/[team]` with demotion history, sibling teams, and
  related sport coverage. `SportsTeam` + `BreadcrumbList` JSON-LD on
  every page; all 100 in the sitemap.
- **Rankings discoverability** — homepage "Teams Brad just moved" rail,
  `/articles` archive cards show a "▼ Moved [LEAGUE] ranking" pill on
  columns that touched the rankings, `/search` surfaces franchise hits
  above article hits, `/admin/rankings` control room for Brad, launch
  readiness check for the rankings engine.
- **`/api/rankings`** — public JSON endpoint (5-minute cache, gate-
  bypassed). `?league=mlb` filters to one league.
- **`/rss.xml`** — RSS 2.0 feed (latest 30 articles, gate-bypassed, auto-
  discoverable via `<link rel="alternate">`).
- **MLB end-to-end** — `'mlb'` first-class `SportSlug`, sport-meta,
  archive filter, admin sport options, search filter.
- **Player imagery** — six original silhouette SVGs (NFL / MLB / NBA /
  NHL / CFB / Soccer) on the homepage faces rail, plus a composite
  marquee SVG behind the Players' Tribune-style hero.
- **Sport-agnostic homepage feed** — chronological single stream
  (lead story + latest grid). Removed league desks, game board, ESPN-
  style coverage rails.
- **Two short biased columns**: "The Yankees window just slammed" and
  "The Lakers are not a real team. They're a tribute act."
- **Four more biased columns**: Cowboys, Maple Leafs, Warriors,
  Florida football.

### Changed

- Tagline: `No bullshit.` → `No BS.` across header, footer, meta,
  admin defaults, OG card, breaking ticker.
- Site nav stripped of sport-specific tabs (`Articles · Rankings ·
  Search · Podcast · Videos · Support · Tips · About`).
- About page coverage list includes MLB and cross-links the rankings.
- OG image (`public/og.png`) regenerated from the corrected SVG via
  `scripts/render-og.mjs`.
- Breaking ticker defaults gain MLB + RANKINGS items.

### Engineering

- Test suite grew from 44 → 70 (rankings engine + franchise search +
  recent movements + RSS / `/api/rankings` route handlers + team page
  generator contract + middleware gate-bypass coverage).
- `pickRecentMovements` promoted from a homepage helper to
  `lib/rankings.ts → getRecentMovements()` so the homepage rail,
  `/rankings` "Recent movement" rail, and future newsletter generator
  share one source of truth.
- The "Recent movement" rail on `/rankings` now sorts by article date
  (was sorting by drop size).

### Documentation

- README — Franchise rankings section, updated route table, new house
  rules entry.
- `docs/RANKINGS-DEMOTION-DIRECTIVE.md` — formal spec for the
  `bb:trash` directive (rules, examples, testing).

### PRs in this release

#24 launch reset · #25 article cross-link · #26 four more columns ·
#27 admin rankings + docs · #28 OG fix · #29 sport-tinted league
sections · #30 homepage rankings rail · #31 sort + scope tests ·
#32 search franchise hits · #33 archive impact pill · #34 launch check ·
#35 `/api/rankings` · #36 RSS · #37 rankings newsletter + API discovery ·
#38 `getRecentMovements` lib + ticker copy · #39 rankings rail dedup ·
#40 RSS + API tests · #41 per-team pages · #42 team-page wiring ·
#43 team JSON-LD · #44 team-page generator tests · #45 changelog +
v0.3.0 bump · #46 Brad's-team disclosure badge · #47 sitemap
freshness + JSON alternate · #48 sitemap tests · #49 shared
RankingsImpactPill on homepage Latest · #50 per-league pages
(`/rankings/[league]`) · #51 footer + CHANGELOG sync · #52 league-page
generator tests · #53 homepage league-leader tease · #54 bradTeam API
test · #55 demotion directive spec refresh · #56 metadata.keywords
expansion · #57 require-shim cleanup · #58 final CHANGELOG sync.

## [0.2.0] — pre-launch

Initial production-ready Next.js 14 site with admin, comments, donations,
newsletter, AI media pipeline scaffolding.
