import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;
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
const ALLOWED_MODES = new Set(['general', 'tip', 'press', 'sponsorship']);

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many submissions. Try again in a minute.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const mode = String(body?.mode ?? 'general');
  const email = String(body?.email ?? '').trim().toLowerCase();
  const name = String(body?.name ?? '').trim().slice(0, 100);
  const message = String(body?.message ?? '').trim();
  const secure = !!body?.secure;

  if (!ALLOWED_MODES.has(mode)) {
    return NextResponse.json({ error: 'Invalid contact mode.' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'That email doesn’t look right.' }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: 'Message is too short.' }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json({ error: 'Message is too long. Try splitting it.' }, { status: 400 });
  }

  // v1: log to stdout (Railway captures). v1.1: write to Postgres + email Brad via Resend.
  console.log(
    JSON.stringify({
      event: 'contact.submit',
      mode,
      secure,
      email,
      name,
      length: message.length,
      ip,
      ts: new Date().toISOString()
    })
  );

  const reply =
    mode === 'tip'
      ? secure
        ? 'Tip received and flagged confidential. Brad will not name you without written consent. Expect a reply within a day.'
        : 'Tip received. Expect a reply within a day. If this is sensitive, resubmit with the “Treat as confidential” box checked.'
      : mode === 'press'
        ? 'Got it. Brad checks press mail every day; expect a reply within 48 hours.'
        : mode === 'sponsorship'
          ? 'Thanks for reaching out about a partnership. Brandon (operations) handles sponsorship intake — expect a reply within 2 business days.'
          : 'Got it. Brad will see this.';

  return NextResponse.json({ ok: true, message: reply });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/contact', method: 'POST' });
}
