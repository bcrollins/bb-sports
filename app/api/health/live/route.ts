import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Process liveness only. Never depends on Postgres, providers, or catalog.
 * Safe for Railway/container restart probes.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      check: 'live',
      service: 'bb-sports',
      ts: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
