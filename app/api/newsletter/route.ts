import { NextRequest, NextResponse } from 'next/server';
import { requestMeta } from '@/lib/request-meta';
import { upsertNewsletterSubscriber } from '@/lib/queries';
import { newsletterSignupSchema, validationErrorMessage } from '@/lib/intake-validation';

// v1 newsletter endpoint:
// - validates email
// - rate-limits per IP in-memory (replace with Redis when DB lands)
// - writes the first-party newsletter ledger in Postgres
// - Resend welcome email stays disabled until the sending domain is verified

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

export async function POST(req: NextRequest) {
  const { ip, userAgent } = requestMeta(req);

  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = newsletterSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }

  try {
    await upsertNewsletterSubscriber({
      email: parsed.data.email,
      source: parsed.data.source,
      ip,
      userAgent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Newsletter ledger unavailable.';
    return NextResponse.json({ error: message }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    message: 'You’re on the list. Brad will hit your inbox the moment a take ships.'
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/newsletter', method: 'POST' });
}
