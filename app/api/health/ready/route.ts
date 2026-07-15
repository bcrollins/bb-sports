import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import pkg from '@/package.json';
import { db, dbAvailable } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dependency readiness. In production (Railway / NODE_ENV=production),
 * Postgres must be configured and reachable. Local dev without DATABASE_URL
 * remains ready so filesystem-backed work is not blocked.
 */
export async function GET() {
  const productionLike =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.RAILWAY_PROJECT_ID);

  const reasons: string[] = [];
  let dbLatencyMs: number | null = null;

  if (productionLike && !dbAvailable) {
    reasons.push('database_not_configured');
  } else if (dbAvailable && db) {
    const start = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      dbLatencyMs = Date.now() - start;
    } catch {
      reasons.push('database_unreachable');
    }
  }

  const ready = reasons.length === 0;
  return NextResponse.json(
    {
      status: ready ? 'ready' : 'not_ready',
      check: 'ready',
      service: 'bb-sports',
      version: pkg.version,
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local',
      ts: new Date().toISOString(),
      productionLike,
      db: {
        configured: dbAvailable,
        reachable: ready || (!productionLike && !dbAvailable),
        latencyMs: dbLatencyMs,
      },
      reasons,
    },
    {
      status: ready ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
