/**
 * Operator / deploy-job entry for versioned migrations.
 * Usage: DATABASE_URL=... npm run db:migrate
 */
import { db, dbAvailable } from '../lib/db/client';
import { defaultMigrationsDir, runVersionedMigrations } from '../lib/db/migrate';

async function main() {
  if (!dbAvailable || !db) {
    console.error('DATABASE_URL is not configured; refusing to migrate.');
    process.exit(1);
  }
  const result = await runVersionedMigrations({
    database: db,
    migrationsDir: defaultMigrationsDir(),
  });
  console.log(
    `Migrations complete. Newly applied: ${result.applied.join(', ') || '(none)'}. Ledger entries already present: ${result.skipped}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
