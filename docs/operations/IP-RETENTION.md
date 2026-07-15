# Network metadata retention (IP / user-agent)

**Policy code:** `lib/ip-retention.ts`  
**Never auto-apply** in app boot. Dry-run SQL is generated for operators.

## Rules

1. Analytics stores **hashes only** when `ANALYTICS_HASH_SALT` is set; never fall back to JWT.
2. Raw IP/UA on intake tables expire per table maximum (30–90 days).
3. Abuse rate limits use `auth_attempts` digests — do not keep raw IPs forever to “be safe.”
4. Always backup before APPLY (see BACKUP-RESTORE.md).

## Dry-run

```js
// node -e "import('./lib/ip-retention.ts').then(m => console.log(JSON.stringify(m.buildRetentionDryRunSql(), null, 2)))"
```

Or review the SQL strings returned by `buildRetentionDryRunSql()`.

## Apply (manual)

1. `countSql` on production read replica / console — record counts.
2. Maintenance window.
3. Run `applySql` one table at a time.
4. Record date/table/count in CHANGELOG Operations.

## Abort

If APPLY would null sessions still active for signed-in Brad without confirm — skip sessions rows with `revoked_at IS NULL AND expires_at > now()`.
