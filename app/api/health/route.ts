import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, dbAvailable } from '@/lib/db/client';
import { getPublicReleaseManifest } from '@/lib/release-manifest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Combined public health (smoke + dashboards).
 * Prefer /api/health/live for process probes and /api/health/ready for
 * dependency readiness. This route remains stable for existing smoke contracts.
 */
async function checkDb(): Promise<{ configured: boolean; reachable: boolean; latencyMs: number | null }> {
  if (!dbAvailable || !db) return { configured: false, reachable: false, latencyMs: null };
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { configured: true, reachable: true, latencyMs: Date.now() - start };
  } catch {
    return { configured: true, reachable: false, latencyMs: null };
  }
}

export async function GET() {
  const dbStatus = await checkDb();
  const release = getPublicReleaseManifest();
  // Healthy when DATABASE_URL is unset (filesystem fallback is by design)
  // OR when DATABASE_URL is set AND the DB responded. Only mark degraded
  // when DB is configured but unreachable.
  const healthy = !dbStatus.configured || dbStatus.reachable;
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      check: 'combined',
      service: release.service,
      version: release.version,
      commit: release.commit,
      commitShort: release.commitShort,
      release,
      ts: new Date().toISOString(),
      db: dbStatus,
      endpoints: {
        live: '/api/health/live',
        ready: '/api/health/ready',
        status: '/status',
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
