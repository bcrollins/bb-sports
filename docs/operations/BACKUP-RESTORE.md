# BB Sports Postgres backup & restore

**Audience:** Brandon (operator)  
**Host:** Railway Postgres attached to `bb-sports` / `web`  
**Hard rule:** Never restore over production without a named maintenance window. Never truncate to “fix” a deploy.

## Ownership

| Item | Owner |
| --- | --- |
| Railway project backups | Brandon |
| Restore drill evidence | Brandon |
| Secrets (JWT, gate, salts) | Railway env only — never in dump artifacts shared widely |

## RPO / RTO targets (soft-launch)

| Metric | Target |
| --- | --- |
| RPO | ≤ 24 hours (Railway automatic backups when enabled; verify in dashboard) |
| RTO | ≤ 4 hours for full app recovery to prior good SHA + restored DB |

## Inventory (first-party tables)

Articles + revisions/publication events, newsletter_subscribers, contact_messages, donation_intents, comments, sessions, users, analytics_events, editorial_findings, admin_audit_events, auth_attempts, media_assets, sports encyclopedia tables, newsroom tables.

## Backup checklist

1. Confirm Railway Postgres **Backups** enabled for production.
2. Note latest backup age vs RPO.
3. Optionally: `pg_dump` to encrypted local store with redacted logs (no `JWT_SECRET` in files).

## Restore drill (isolated)

1. Create a **new** Railway Postgres (or local Docker) — never point a restore at the live connection string by accident.
2. Restore dump into the isolated DB.
3. Point a **staging** web service at the isolated URL.
4. Validate:
   - Row counts for articles (published), subscribers, comments
   - Admin login against restored users (use known hash or seed)
   - Public article render for 2–3 slugs
5. Record date, dump id, counts, and result in CHANGELOG Operations note.
6. Destroy isolated credentials after drill.

## Abort

If restore host equals production project ID / known prod hostname — **stop immediately**.
