# Session handoff — 2026-07-15 (updated)

## Production truth (verify with live health)

| Item | Value |
| --- | --- |
| Repo | `/Users/brandonrollins/Code/bb-sports-production` |
| GitHub | `https://github.com/bcrollins/bb-sports.git` |
| Production | https://bbsports.fans |
| Railway | project `bb-sports`, service `web` |
| Gate password | `calebwilliamsmvp` |
| Soft-launch gate | required |

### Live commits shipped this continuation (newest last)

| SHA | PR | What |
| --- | --- | --- |
| `f39edf3…` | #81 | Encyclopedia people **51 → 130**; bootstrap people upsert; smoke ≥100 people |
| `510e2a9…` | #82 | **CSP + HSTS** enforce-mode on every response |
| `b8466a1…` | #83 | Public ticker **Desk** not false **Breaking** |
| `c13fd72…` | #84 | Newsletter unsubscribe **GET read-only**; POST/RFC 8058 owns mutation |

Confirm current live SHA:

```bash
curl -sS https://bbsports.fans/api/health
```

### Encyclopedia live counts (after #81)

- 4 leagues, **124 teams** (NFL 32 / MLB 30 / NHL 32 / NBA 30)
- **130 people** (first-party identity/role notes, club-page citations)
- Bias-core depth: Bears, Florida Panthers, Cubs, Bulls (4+ each)
- Surfaces: `/teams`, `/teams/[league]?conference=…`, `/people`, `/people/[personKey]`, `/api/teams`, `/api/teams?q=`

### Security headers (after #82)

- `Content-Security-Policy` enforce (default-src self, object-src none, frame-ancestors self, form-action self, upgrade-insecure-requests)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- Markdown sanitizer remains primary XSS barrier (`lib/markdown.ts`)

### Editorial integrity (after #83)

- Curated ticker labeled **Desk** / aria **BB Sports desk**
- Live pulse + **Breaking** only when every item has `isBreaking: true`
- Static defaults never claim breaking

### Newsroom / publication (still true)

- External connectors **dark** (Manual only; no live worker transport)
- Worker bundle present: `ops/newsroom-worker.mjs` (default-off)
- Brad publication gate + immutable revisions intact
- `/api/donations` 503 while donations disabled is intentional

## Non-negotiable editorial / data rules

1. External signals never publish; Brad phrase required for publication.
2. Encyclopedia = **public franchise identity + cited people notes** only.
3. **No proprietary box-score scrapes** (Sports Reference dumps, etc.).
4. Null/FLAGGED > wrong invent.
5. Ship small PRs: check → commit → PR → merge → Railway SHA → smoke.

## Recommended next work (priority order)

1. **Access-wall / admin durable rate limits** (Top-100 #8–#9).
2. **Published catalog reconciliation** — file-only articles vs DB (Top-100 #6; Brad approval for publish state).
3. **Optional** `person_team_stints` only if multi-year employment history is a product goal.
4. **Do NOT** activate provider worker/transports without commercial approval + credentials + tests.
5. Licensed stats feed is the only honest path to full player career stats.

## Verify commands

```bash
cd /Users/brandonrollins/Code/bb-sports-production
git fetch origin --prune && git status --short --branch && git rev-parse HEAD origin/main
curl -sS https://bbsports.fans/api/health
BB_PRODUCTION_GATE_PASSWORD='calebwilliamsmvp' npm run smoke:production -- \
  --base-url https://bbsports.fans --expected-commit "$(git rev-parse HEAD)"
# Headers
curl -sSI https://bbsports.fans/api/health | grep -iE 'content-security|strict-transport'
```

## Key paths

- Encyclopedia: `lib/sports-encyclopedia/*`, `app/(site)/teams/**`, `app/(site)/people/**`
- Desk rail: `lib/breaking.ts`, `components/BreakingNewsBar.tsx`
- Security headers: `next.config.mjs`, `tests/security-headers.test.ts`
- Newsroom: `docs/REALTIME-NEWSROOM.md`, `lib/newsroom-*`, `lib/db/bootstrap.ts`
- Audit: `docs/operations/DATABASE-POPULATION-AUDIT.md`
- Citations: `db/seeds/_source_citations.md`
- Top-100 ledger: `docs/operations/top100/TOP100-2026-07-15-bb-sports-value-engine.md`
