/**
 * Drizzle Postgres client. Singleton — Next.js dev hot-reload safe.
 *
 * Reads DATABASE_URL from env (Railway sets this on the web service via the postgres plugin).
 *
 * In production, postgres.js maintains a small connection pool. In dev, the client is
 * cached on `globalThis` so HMR doesn't spawn a new pool every save.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  var __bbsportsPg: ReturnType<typeof postgres> | undefined;
}

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (process.env.NODE_ENV === 'production') {
    return postgres(url, { max: 10, idle_timeout: 30, ssl: 'prefer' });
  }
  if (!globalThis.__bbsportsPg) {
    globalThis.__bbsportsPg = postgres(url, { max: 5, idle_timeout: 30, ssl: 'prefer' });
  }
  return globalThis.__bbsportsPg!;
}

const client = getClient();

/** Drizzle DB instance. May be null at build time (no DATABASE_URL); guard your callers. */
export const db = client ? drizzle(client, { schema }) : null;

/** True when the database is reachable in this environment. */
export const dbAvailable = Boolean(db);

/**
 * Close this process's database pool for short-lived operational commands.
 * The web server never calls this; disposable verification children use it so
 * their parent can immediately drop the temporary database without waiting for
 * idle pool connections to expire.
 */
export async function closeDatabaseClient(): Promise<void> {
  if (!client) return;
  await client.end({ timeout: 5 });
  if (globalThis.__bbsportsPg === client) globalThis.__bbsportsPg = undefined;
}

export { schema };
