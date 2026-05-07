import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import pkg from '@/package.json';
import { db, dbAvailable } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  // Healthy when DATABASE_URL is unset (filesystem fallback is by design)
  // OR when DATABASE_URL is set AND the DB responded. Only mark degraded
  // when DB is configured but unreachable.
  const healthy = !dbStatus.configured || dbStatus.reachable;
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'bb-sports',
      version: pkg.version,
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local',
      ts: new Date().toISOString(),
      db: dbStatus,
    },
    { status: healthy ? 200 : 503 },
  );
}
