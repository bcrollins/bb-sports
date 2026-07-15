import { NextRequest, NextResponse } from 'next/server';
import {
  analyticsPayloadSchema,
  evaluateAnalyticsHashPosture,
  parseAnalyticsPrivacySignals,
  analyticsCollectionAllowed,
  recordAnalyticsEvent,
} from '@/lib/analytics';
import { requestMeta } from '@/lib/request-meta';
import { rejectIfMutationBlocked } from '@/lib/mutation-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const blocked = rejectIfMutationBlocked(req);
  if (blocked) return blocked;

  const privacy = parseAnalyticsPrivacySignals({
    headers: req.headers,
    cookieHeader: req.headers.get('cookie'),
  });
  if (!analyticsCollectionAllowed(privacy)) {
    // Honor GPC / DNT / explicit opt-out without error noise.
    return NextResponse.json({ ok: true, recorded: false, reason: 'privacy_signal' });
  }

  const hashPosture = evaluateAnalyticsHashPosture();
  if (!hashPosture.allowed) {
    return NextResponse.json({ ok: true, recorded: false, reason: hashPosture.reason });
  }

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
    const row = await recordAnalyticsEvent(parsed.data, { ip, userAgent }, { privacy });
    return NextResponse.json({ ok: true, recorded: Boolean(row) });
  } catch {
    return NextResponse.json({ error: 'Analytics ledger unavailable.' }, { status: 503 });
  }
}

export async function GET() {
  const hashPosture = evaluateAnalyticsHashPosture();
  return NextResponse.json({
    ok: true,
    route: '/api/analytics',
    method: 'POST',
    hashing: hashPosture.allowed ? 'ready' : hashPosture.reason,
    honors: ['Sec-GPC', 'DNT', 'bb_analytics=0'],
  });
}
