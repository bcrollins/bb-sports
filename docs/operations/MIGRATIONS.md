# Versioned database migrations

Owner: Brandon (ops)  
Last updated: 2026-07-15

## Modes

| `BBSPORTS_SCHEMA_MODE` | Behavior |
|------------------------|----------|
| `bootstrap` (default) | Legacy idempotent DDL in `lib/db/bootstrap.ts`, then advances `drizzle/migrations` ledger |
| `migrations` | **No bootstrap DDL** — only `runVersionedMigrations` + data seeds |

## Commands

```bash
DATABASE_URL=... npm run db:migrate
```

- Advisory lock key: `87201420` (`SCHEMA_MIGRATION_LOCK_KEY`)
- Ledger table: `schema_migrations (id, checksum, applied_at)`
- Drift of an applied file’s checksum fails hard

## Files

- `drizzle/migrations/0001_*.sql` — ordered, checksummed
- `lib/db/migrate.ts` — loader, drift detection, lock, apply
- `scripts/db-migrate.ts` — deploy-job entrypoint

## Production cutover (safe)

1. Clone production → run `db:migrate` (baseline no-op after bootstrap).
2. Cut expand/contract SQL as `0002_…` from reviewed dumps — never edit applied files.
3. Flip `BBSPORTS_SCHEMA_MODE=migrations` on web only after migrate job succeeds.
4. Smoke with `EXPECTED_COMMIT`.

## Rollback

Do not delete from `schema_migrations`. Ship a forward `000N_fix.sql`. Restore from backup per `BACKUP-RESTORE.md` if catastrophic.
