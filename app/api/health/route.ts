import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'bb-sports',
    version: process.env.npm_package_version ?? '0.1.0',
    commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local',
    ts: new Date().toISOString()
  });
}
