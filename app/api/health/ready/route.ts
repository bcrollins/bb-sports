import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, dbAvailable } from '@/lib/db/client';
import { productionEnvPublicDto } from '@/lib/production-env';
import { getPublicReleaseManifest } from '@/lib/release-manifest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dependency readiness. In production (Railway / NODE_ENV=production),
 * Postgres must be configured and reachable. Local dev without DATABASE_URL
 * remains ready so filesystem-backed work is not blocked.
 */
export async function GET() {
  const envPosture = productionEnvPublicDto();
  const productionLike = envPosture.productionLike;
  const release = getPublicReleaseManifest();

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

  if (productionLike && !envPosture.ok) {
    for (const key of envPosture.missing) {
      reasons.push(`env_missing:${key}`);
    }
  }

  const ready = reasons.length === 0;
  return NextResponse.json(
    {
      status: ready ? 'ready' : 'not_ready',
      check: 'ready',
      service: release.service,
      version: release.version,
      commit: release.commit,
      commitShort: release.commitShort,
      release,
      ts: new Date().toISOString(),
      productionLike,
      db: {
        configured: dbAvailable,
        reachable: Boolean(dbAvailable && dbLatencyMs !== null && !reasons.includes('database_unreachable')),
        latencyMs: dbLatencyMs,
      },
      env: envPosture,
      reasons,
    },
    {
      status: ready ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
