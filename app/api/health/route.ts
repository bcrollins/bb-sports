import { NextResponse } from 'next/server';
import pkg from '@/package.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'bb-sports',
    version: pkg.version,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local',
    ts: new Date().toISOString()
  });
}
