import { NextRequest, NextResponse } from 'next/server';
import { contactSubmissionSchema, validationErrorMessage } from '@/lib/intake-validation';
import { createContactMessage } from '@/lib/queries';
import { requestMeta } from '@/lib/request-meta';

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

export async function POST(req: NextRequest) {
  const { ip, userAgent } = requestMeta(req);

  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many submissions. Try again in a minute.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = contactSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }
  const { mode, email, name, message, secure } = parsed.data;

  try {
    await createContactMessage({
      mode,
      email,
      name,
      message,
      confidential: secure,
      ip,
      userAgent,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Contact ledger unavailable.';
    return NextResponse.json({ error }, { status: 503 });
  }

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
