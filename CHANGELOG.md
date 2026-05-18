# Changelog

All notable changes to BB Sports. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
(`/rankings/[league]`) · #51 footer + CHANGELOG sync.

## [0.2.0] — pre-launch

Initial production-ready Next.js 14 site with admin, comments, donations,
newsletter, AI media pipeline scaffolding.
