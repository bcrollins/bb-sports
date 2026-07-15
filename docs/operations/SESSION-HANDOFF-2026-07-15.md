# Session handoff — 2026-07-15

## Production truth (verified)

| Item | Value |
| --- | --- |
| Repo | `/Users/brandonrollins/Code/bb-sports-production` |
| GitHub | `https://github.com/bcrollins/bb-sports.git` |
| Branch | `main` clean, = `origin/main` |
| HEAD / live commit | `6fbe974b7726db17b6bcdc6a5bcce837cbab8b96` |
| Deploy | SUCCESS `6e43d1e8-8e06-4862-aab5-50f67d29129d` |
| Production | https://bbsports.fans |
| Railway | project `bb-sports`, service `web` |
| Smoke | **21/21** |
| Gate password | `calebwilliamsmvp` |
| Working-copy control | enabled (audit SHA still `cd27df9…` — enable is no-op when already on) |

### Encyclopedia live counts

- 4 leagues, **124 teams** (NFL 32 / MLB 30 / NHL 32 / NBA 30)
- **51 people** (first-party identity/role notes, not scraped stats)
- Surfaces: `/teams`, `/teams/[league]?conference=…`, `/people`, `/api/teams`, `/api/teams?q=`

### Newsroom / publication (still true)

- External connectors **dark** (Manual only; parsers only; no live worker transport)
- Worker bundle present: `ops/newsroom-worker.mjs` (default-off)
- Brad publication gate + immutable revisions intact
- Soft-launch gate + admin auth contracts intact
- `/api/donations` 503 while donations disabled is intentional

## What shipped this session (PR stack, newest last)

| PR | Summary |
| --- | --- |
| #69–#75 | Provider governance, ingest txn, worker skeleton, desk status, RSS SSRF, notice filter, ops flat bundle |
| #76 | DB population audit (no fake player encyclopedia) |
| #77 | Sports encyclopedia foundation (schema + 124 teams + UI) |
| #78 | People expansion (51), `/people`, search, smoke 21 checks |
| #79 | Conference/division filters + homepage/footer encyclopedia entry |

## Non-negotiable editorial / data rules

1. External signals never publish; Brad phrase required for publication.
2. Encyclopedia = **public franchise identity + cited people notes** only.
3. **No proprietary box-score scrapes** (Sports Reference dumps, etc.).
4. Null/FLAGGED > wrong invent.
5. Ship small PRs: check → commit → PR → merge → Railway SHA → smoke.

## Recommended next work (priority order)

1. **People growth** — more first-party person rows with club-page citations (still no stat tables).
2. **Optional schema** — `person_team_stints` / seasons only if multi-year employment history is product goal.
3. **Worker service** — separate Railway service running `node ops/newsroom-worker.mjs` only after commercial approval; keep `BBSPORTS_NEWSROOM_WORKER_ENABLED` false until ready.
4. **Provider activation** — never set approval flags without credentials + legal posture + tests; transport still `connectionAllowed: false` for X/Bluesky/RSS preflight.
5. **Licensed stats feed** — only path to “full career stats for every player.”

## Verify commands

```bash
cd /Users/brandonrollins/Code/bb-sports-production
git fetch origin --prune && git status --short --branch && git rev-parse HEAD origin/main
curl -sS https://bbsports.fans/api/health
BB_PRODUCTION_GATE_PASSWORD='calebwilliamsmvp' npm run smoke:production -- \
  --base-url https://bbsports.fans --expected-commit "$(git rev-parse HEAD)"
railway ssh --service web --environment production -- "node ops/publication-working-copy-control.mjs status"
railway ssh --service web --environment production -- "node ops/verify-publication-postgres.mjs"
```

## Key paths

- Encyclopedia: `lib/sports-encyclopedia/*`, `app/(site)/teams/**`, `app/(site)/people/**`
- Newsroom: `docs/REALTIME-NEWSROOM.md`, `lib/newsroom-*`, `lib/db/bootstrap.ts`
- Audit: `docs/operations/DATABASE-POPULATION-AUDIT.md`
- Citations: `db/seeds/_source_citations.md`
