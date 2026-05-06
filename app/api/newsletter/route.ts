import { NextRequest, NextResponse } from 'next/server';

// v1 newsletter endpoint:
// - validates email
// - rate-limits per IP in-memory (replace with Redis when DB lands)
// - logs to stdout (Railway captures) for now
// - in v1.1 this writes to Postgres + sends a welcome email via Resend

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const ipHits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.reset < now) {
    ipHits.set(ip, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'That email doesn’t look right.' }, { status: 400 });
  }

  // v1: log only. v1.1: write to Postgres, queue welcome via Resend.
  console.log(JSON.stringify({ event: 'newsletter.signup', email, ip, ts: new Date().toISOString() }));

  return NextResponse.json({
    ok: true,
    message: 'You’re on the list. Brad will hit your inbox the moment a take ships.'
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/newsletter', method: 'POST' });
}
