/**
 * Admin site_config endpoint.
 *  GET  /api/admin/site         — read all keys
 *  PUT  /api/admin/site         — body: { key: string, value: any } — upserts one row
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, dbAvailable } from '@/lib/db/client';
import { ensureBootstrapped } from '@/lib/db/bootstrap';
import { getCurrentUser } from '@/lib/auth';
import { setConfig } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!dbAvailable || !db) return NextResponse.json({ config: {} });
  await ensureBootstrapped();
  const rows = (await db.execute(sql`SELECT key, value FROM site_config`)) as unknown as { key: string; value: unknown }[];
  const config: Record<string, unknown> = {};
  for (const r of rows) config[r.key] = r.value;
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { key?: string; value?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const key = String(body.key ?? '').trim();
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
  await setConfig(key, body.value, user.id);
  return NextResponse.json({ ok: true });
}
