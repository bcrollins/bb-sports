# Admin login fix — 2026-07-15

## What was wrong (plain English)

1. Going to the newsroom often hit the **white soft-launch wall** first. Brad needs his **newsroom email + password**, not the reader wall password.
2. The admin password in the database was **write-once**. Changing `ADMIN_PASSWORD_HASH` in Railway did **not** unlock Brad if an old hash already existed.
3. After a successful sign-in, the session cookie was not always attached to the response, so the next page acted like he was still logged out (or threw a glitchy error screen).
4. If the database hiccuped during session checks, the site could show a **developer-looking error page** instead of “please sign in again.”

## What we changed (local, ready to ship)

| Area | Change |
| --- | --- |
| Middleware | `/admin/login` + login/logout APIs bypass the soft-launch wall. Bare `/admin/*` without a session goes to **newsroom login**, not the white wall. |
| Login API | Sets `bb_session` on the **response** object; clearer 503s if JWT/DB session write fails. |
| Login form | Hard navigation after success so the cookie is used immediately. |
| Bootstrap | Upserts Brad’s user from Railway `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` every boot (recovery source of truth). |
| Readiness | Production requires `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`. |
| Errors | Newsroom-friendly error UI; no stack-trace headline. |

Patch file: `admin-login-fix.patch` (repo root).

## Deploy (Brandon)

GitHub MCP on this machine is **read-only** (`403 Resource not accessible by integration`). Someone with write access must push:

```bash
cd /path/to/bb-sports   # or apply admin-login-fix.patch on a fresh clone
# preferred: copy the 15 changed files from the Grok session workspace
# /Users/bradbenson/bb-sports-production/

git checkout -b fix/admin-login-reachability
# apply files, then:
git add middleware.ts lib/auth.ts lib/db/bootstrap.ts lib/production-env.ts \
  app/api/admin/login/route.ts app/api/admin/logout/route.ts \
  app/admin/login app/admin/error.tsx app/error.tsx \
  components/SiteHeader.tsx .env.example \
  tests/admin-login-reachability.test.ts tests/article-source-env-findings.test.ts \
  docs/ADMIN-DASHBOARD-OPERATING-SYSTEM.md docs/operations/ADMIN-LOGIN-FIX-2026-07-15.md
git commit -m "fix(admin): restore reliable newsroom login for Brad"
git push -u origin HEAD
# merge to main → Railway auto-deploy
```

Or: `git apply admin-login-fix.patch` then commit.

### Railway env (required)

Confirm these are set (values never go in git):

- `ADMIN_EMAIL` — Brad’s newsroom email  
- `ADMIN_PASSWORD_HASH` — bcrypt hash of his password  

Generate a new hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('CHOOSE-A-STRONG-PASSWORD', 10))"
```

Paste the hash into Railway → redeploy. After this fix, bootstrap **updates** the DB hash on boot.

Also keep: `JWT_SECRET`, `DATABASE_URL`, `GATE_PASSWORD`, `GATE_COOKIE_SECRET`.

## How Brad signs in (after deploy)

1. Open **https://bbsports.fans/admin/login** (bookmark this).  
2. Enter **newsroom** email + password (not the white wall password).  
3. Land on Command center. From the left nav: Articles, Write, Rankings, Site, Comments, Audience, Access wall, etc.

### Soft-launch wall (readers)

Still at **https://bbsports.fans/coming-soon**. Operator recovery password remains Railway `GATE_PASSWORD` (documented in ops handoff as the lowercase soft-launch credential). That wall does **not** grant publish rights.

## Verify live (after deploy)

```bash
# 1) Health pin
curl -sS https://bbsports.fans/api/health | jq .commitShort

# 2) Admin login is NOT wall-gated
curl -sI https://bbsports.fans/admin/login | head -5
# expect 200, not 307 to /coming-soon

# 3) Bare /admin without cookies → login (not white wall)
curl -sI https://bbsports.fans/admin | head -10
# expect location: /admin/login

# 4) Smoke
BB_PRODUCTION_GATE_PASSWORD='…' EXPECTED_COMMIT=$(curl -sS https://bbsports.fans/api/health | jq -r .commit) \
  npm run smoke:production -- --base-url https://bbsports.fans
```

Then Brad: phone 390px + laptop — sign in, open Articles, open Rankings, edit a draft, confirm no developer error page.

## Rollback

`git revert` the merge commit on main, or Railway → redeploy previous successful deployment. See `docs/operations/ROLLBACK.md`. Does not wipe articles.

## Status this session

- **Code:** complete and unit-tested locally (auth/login reachability + env posture).  
- **Live deploy:** blocked on GitHub write permission for the automation token.  
- **Needs human:** Brandon push/merge + confirm Railway `ADMIN_*` env; Brad try sign-in after health commit advances.
