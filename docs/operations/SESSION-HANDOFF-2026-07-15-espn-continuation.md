# Session handoff — ESPN path continuation (2026-07-15)

## Live at handoff write

- Site: https://bbsports.fans (gate: soft-launch wall)
- Verified live SHA during session: progressed through `82afce8` → `4e0aabf` → `f0d2e51` → `fd95eb7` → `d95c9c3`
- Main tip at handoff: `077367f` (PR #108) — Railway queue may lag multiple commits
- Soft-launch crawl live: `robots.txt` Disallow `/`, empty sitemap, release.publicLaunch=false

## Smoke

- **25/25** verified earlier on `82afce8` and `fd95eb7`-era builds
- On `d95c9c3` (pre-#106): analytics validation smoke **fails** because salt-missing short-circuit returned 200 for invalid events
- **Fixed on main in #106** (`b0d1136`): validate schema before privacy/salt skip — re-smoke once live ≥ `b0d1136`

## Shipped this continuation (PR #97–#108)

| PR | SHA tip | Top-100 |
| --- | --- | --- |
| #97 | crawl policy robots/sitemap/RSS/noindex | #57 |
| #98 | release manifest + smoke pins | #23 |
| #99 | analytics salt + GPC/DNT + catalog comments | #31 #66 #67 |
| #100 | archive shareable filters | #63 |
| #101 | admin session panel | #30 |
| #102 | explainable related takes | #54 #62 |
| #103 | homepage chronology | #60 |
| #104 | article loading/not-found | #61 |
| #105 | rollback runbook | #73 |
| #106 | analytics validate order (smoke fix) | regression |
| #107 | analytics test scope | test |
| #108 | request IDs + log redaction | #72 |

## Ledger snapshot

- ~45 Complete / ~52 Pending / 3 In progress (newsroom connectors, publish checklist, revision UI)
- Hard constraints still hold: no auto-publish, no unlicensed live scores, soft-launch wall on

## Operator next (after Railway drains queue)

1. Wait until `/api/health` commit is `077367f` (or later)
2. `EXPECTED_COMMIT=<that-sha> npm run smoke:production` → expect **25/25**
3. Optional: set `ANALYTICS_HASH_SALT` (≥16, not equal JWT) in Railway if first-party analytics should write
4. Brad: import filesystem drafts via `/admin/catalog` then **explicitly publish** missing pieces (Yankees/Warriors etc. still absent until published)

## Do not

- Truncate production DB
- Set `BBSPORTS_PUBLIC_LAUNCH=true` without intentional public launch
- Enable live scores without commercial approval + credentials

## Continuation wave (PRs #114–#121)

| PR | Summary |
| --- | --- |
| #114 | a11y motion/focus + fact-check checklist + quality gate |
| #115 | Article reading controls |
| #116 | Newsletter frequency/topics + SLO.md |
| #117 | Per-article OG cards + hero allowlist ledger |
| #118 | Citation extract/probe SSRF-safe |
| #119 | Audience analytics posture + BACKUP-RESTORE.md |
| #120 | Crash-safe draft autosave |
| #121 | IP/UA retention policy dry-run |

**Ledger ~64 Complete / ~33 Pending / 3 In progress**  
**Tests ~384 green**  
**Smoke 25/25** repeatedly on advancing live SHAs.

### Still pending (provider / heavy)

#20 migrations dir, #5 newsroom connectors commercial, #34 Resend e2e, #37–39 Stripe e2e, #29 multi-role RBAC matrix, #45 R2, #51 calendar, #75 full browser matrix, #76 axe CI.

### Operator after queue drains

1. Confirm `/api/health` commit == `git rev-parse origin/main`
2. Smoke with EXPECTED_COMMIT
3. Optional: `curl -sS "https://bbsports.fans/api/og/article?title=Hello&sport=NFL&by=Brad" -o og.png` (expect PNG once #117 live)
4. Set ANALYTICS_HASH_SALT if writes desired
