import { NextRequest, NextResponse } from 'next/server';
import { analyticsPayloadSchema, recordAnalyticsEvent } from '@/lib/analytics';
import { requestMeta } from '@/lib/request-meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { ip, userAgent } = requestMeta(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = analyticsPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid analytics event.' }, { status: 400 });
  }

  try {
    await recordAnalyticsEvent(parsed.data, { ip, userAgent });
  } catch {
    return NextResponse.json({ error: 'Analytics ledger unavailable.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/analytics', method: 'POST' });
}
