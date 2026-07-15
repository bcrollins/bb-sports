# BB Sports production rollback

**Audience:** Brandon (operator)  
**Canonical site:** https://bbsports.fans  
**Service:** Railway project `bb-sports` / service `web`  
**Hard rules:** Never restore old gate passwords or JWT secrets. Never truncate Postgres to “fix” a deploy. Never auto-publish articles as part of rollback.

## What “rollback” means here

1. **Code rollback** — put a previously successful Git commit live on Railway.
2. **Verify** — `/api/health` reports that exact commit (or short prefix match).
3. **Smoke** — `npm run smoke:production` with `EXPECTED_COMMIT` set.
4. **Data** — leave catalog, subscribers, comments, tips, donations intact unless a *separate* audited data recovery is approved.

## Preconditions

- `gh` authenticated to `bcrollins/bb-sports`
- `railway` linked to production `web`
- Gate password available as `BB_PRODUCTION_GATE_PASSWORD` (not committed)
- Know the **good SHA** (from previous green smoke or `/api/health` history)

## Procedure A — Railway redeploy previous successful deployment (preferred)

```bash
# List recent deployments
railway deployment list

# Note the last SUCCESS deployment before the bad one.
# Redeploy that deployment ID (Railway UI: Deployments → ⋮ → Redeploy)
# Or via CLI if your railway version supports:
# railway deployment redeploy <deployment-id>
```

Wait until deployment status is `SUCCESS`, then:

```bash
curl -sS https://bbsports.fans/api/health | jq '{commit, commitShort, release}'
```

Confirm `commit` matches the intended good SHA.

## Procedure B — Git revert on main (when bad commits must stay recorded)

```bash
git fetch origin main
git checkout main
git pull origin main

# Revert the bad merge commit(s) — prefer revert over hard reset of main
git revert -m 1 <bad-merge-sha>   # for a merge PR
# or
git revert <bad-commit-sha>

git push origin main
```

Railway auto-deploys `main`. Wait for `SUCCESS`, then verify SHA + smoke.

## Procedure C — Pin EXPECTED_COMMIT smoke (mandatory after any rollback)

```bash
export PRODUCTION_BASE_URL=https://bbsports.fans
export BB_PRODUCTION_GATE_PASSWORD='…'   # operator secret
export EXPECTED_COMMIT='<full-or-short-good-sha>'
npm run smoke:production
```

Pass criteria: all checks green, including soft-launch robots/sitemap when not public launch.

## Soft-launch / crawl safety after rollback

| Flag / surface | Soft launch default | Public launch |
| --- | --- | --- |
| `BBSPORTS_PUBLIC_LAUNCH` | unset/false | `true` |
| `/robots.txt` | `Disallow: /` | Allow `/`, disallow `/admin` + `/api/` |
| `/sitemap.xml` | empty | full catalog |
| `/rss.xml` | channel, no items | latest published |
| HTML robots meta | noindex | index |

Rollback of **code** does not flip launch mode. Do not set `BBSPORTS_PUBLIC_LAUNCH=true` during incident recovery unless intentional.

## Health probes (always gate-bypassed)

| Probe | Purpose |
| --- | --- |
| `GET /api/health/live` | Process liveness only |
| `GET /api/health/ready` | DB + required env readiness |
| `GET /api/health` | Combined + public `release` manifest |
| `GET /status` | Human status page |

## Database and editorial

- **Schema:** prefer expand/contract; do not roll back a migration by dropping tables with reader data.
- **Published prose:** unpublish or correct via Brad’s newsroom tools; never rewrite live copy as a deploy side effect.
- **Gate secret rotation:** issue a **new** version; do not re-install a known-compromised secret from backup notes.

## Abort conditions

Stop and escalate if:

- Rollback would require production data truncation
- You cannot identify a previously smoke-green SHA
- Health shows `ready` not_ready after the “good” code is live (data/env issue, not fixed by code pin alone)

## Drill cadence

Quarterly: pick the previous good SHA, redeploy in a maintenance window (or staging when present), run smoke with `EXPECTED_COMMIT`, record date in changelog under Operations.

## Related

- Top-100 ledger item **#73**
- Release manifest: `lib/release-manifest.ts`
- Smoke: `scripts/smoke-production.mjs`
