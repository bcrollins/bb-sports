/**
 * Versioned schema migrations with advisory lock + checksum ledger.
 * Bootstrap data seeding remains separate; DDL should flow through here.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/** Stable app-wide lock key for schema migrations (arbitrary fixed int). */
export const SCHEMA_MIGRATION_LOCK_KEY = 872_014_20;

export type MigrationFile = {
  id: string;
  filename: string;
  sqlText: string;
  checksum: string;
};

export type AppliedMigration = {
  id: string;
  checksum: string;
  appliedAt: Date;
};

export function checksumSql(sqlText: string): string {
  return createHash('sha256').update(sqlText, 'utf8').digest('hex');
}

export function loadMigrationFiles(dir: string): MigrationFile[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/i.test(f))
    .sort();
  return files.map((filename) => {
    const sqlText = readFileSync(join(dir, filename), 'utf8');
    const id = filename.replace(/\.sql$/i, '');
    return { id, filename, sqlText, checksum: checksumSql(sqlText) };
  });
}

export function detectMigrationDrift(
  files: MigrationFile[],
  applied: AppliedMigration[],
): { ok: true } | { ok: false; reason: string } {
  const byId = new Map(files.map((f) => [f.id, f]));
  for (const row of applied) {
    const file = byId.get(row.id);
    if (!file) {
      return {
        ok: false,
        reason: `Applied migration ${row.id} is missing from the migrations directory`,
      };
    }
    if (file.checksum !== row.checksum) {
      return {
        ok: false,
        reason: `Checksum drift for ${row.id}: applied ${row.checksum.slice(0, 12)}… vs file ${file.checksum.slice(0, 12)}…`,
      };
    }
  }
  // Applied set must be a prefix of sorted files
  const sortedIds = files.map((f) => f.id);
  for (let i = 0; i < applied.length; i++) {
    if (applied[i]!.id !== sortedIds[i]) {
      return {
        ok: false,
        reason: `Applied migration order diverged at index ${i}: expected ${sortedIds[i]}, got ${applied[i]!.id}`,
      };
    }
  }
  return { ok: true };
}

export function pendingMigrations(
  files: MigrationFile[],
  applied: AppliedMigration[],
): MigrationFile[] {
  const appliedIds = new Set(applied.map((a) => a.id));
  return files.filter((f) => !appliedIds.has(f.id));
}

export async function ensureSchemaMigrationsTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: PostgresJsDatabase<any>,
): Promise<void> {
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id varchar(160) PRIMARY KEY,
      checksum varchar(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

/**
 * Apply pending migrations under a session advisory lock.
 * Does not run seed data.
 */
export async function runVersionedMigrations(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: PostgresJsDatabase<any>;
  migrationsDir: string;
}): Promise<{ applied: string[]; skipped: number }> {
  const files = loadMigrationFiles(input.migrationsDir);
  const database = input.database;

  // Session-level lock: concurrent migrators serialize.
  await database.execute(sql`SELECT pg_advisory_lock(${SCHEMA_MIGRATION_LOCK_KEY})`);
  try {
    await ensureSchemaMigrationsTable(database);
    const appliedRows = await database.execute(sql`
      SELECT id, checksum, applied_at FROM schema_migrations ORDER BY id ASC
    `);
    const applied: AppliedMigration[] = (
      (appliedRows as unknown as { rows?: Array<Record<string, unknown>> }).rows ??
      (Array.isArray(appliedRows) ? (appliedRows as Array<Record<string, unknown>>) : [])
    ).map((row) => ({
      id: String(row.id),
      checksum: String(row.checksum),
      appliedAt: row.applied_at instanceof Date ? row.applied_at : new Date(String(row.applied_at)),
    }));

    const drift = detectMigrationDrift(files, applied);
    if (!drift.ok) {
      throw new Error(drift.reason);
    }

    const pending = pendingMigrations(files, applied);
    const newly: string[] = [];
    for (const migration of pending) {
      // Run each migration in its own transaction when possible.
      await database.transaction(async (tx) => {
        // postgres-js / drizzle: execute raw multi-statement carefully — one statement batches OK for our files.
        await tx.execute(sql.raw(migration.sqlText));
        await tx.execute(sql`
          INSERT INTO schema_migrations (id, checksum)
          VALUES (${migration.id}, ${migration.checksum})
        `);
      });
      newly.push(migration.id);
    }
    return { applied: newly, skipped: applied.length };
  } finally {
    await database.execute(sql`SELECT pg_advisory_unlock(${SCHEMA_MIGRATION_LOCK_KEY})`);
  }
}

/** Default migrations directory relative to repo root. */
export function defaultMigrationsDir(cwd = process.cwd()): string {
  return join(cwd, 'drizzle', 'migrations');
}
