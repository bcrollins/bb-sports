import { NextRequest, NextResponse } from 'next/server';
import { requestMeta } from '@/lib/request-meta';
import {
  markNewsletterWelcomeDelivered,
  markNewsletterWelcomeFailed,
  upsertNewsletterSubscriber,
} from '@/lib/queries';
import { newsletterSignupSchema, validationErrorMessage } from '@/lib/intake-validation';
import { recordAnalyticsEventSafe } from '@/lib/analytics';
import { getResendEmailConfig, sendNewsletterWelcomeEmail } from '@/lib/resend';
import { rejectIfMutationBlocked } from '@/lib/mutation-guard';

// v1 newsletter endpoint:
// - validates email
// - rate-limits per IP in-memory (replace with Redis when DB lands)
// - writes the first-party newsletter ledger in Postgres
// - Resend welcome email is gated behind BBSPORTS_APPROVED_RESEND and never
//   becomes the source of truth for subscription/suppression state.

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
  const blocked = rejectIfMutationBlocked(req);
  if (blocked) return blocked;

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
    const subscriber = await upsertNewsletterSubscriber({
      email: parsed.data.email,
      source: parsed.data.source,
      frequency: parsed.data.frequency,
      topics: parsed.data.topics,
      ip,
      userAgent,
    });
    const welcome = await sendNewsletterWelcomeEmail({
      to: subscriber.email,
      unsubscribeToken: subscriber.unsubscribeToken,
      origin: req.nextUrl.origin,
      alreadySentAt: subscriber.welcomeSentAt,
    });
    if (welcome.status === 'sent') {
      await markNewsletterWelcomeDelivered({
        id: subscriber.id,
        providerId: welcome.providerId,
      });
    } else if (welcome.status === 'failed') {
      await markNewsletterWelcomeFailed({
        id: subscriber.id,
        error: welcome.reason,
      });
    }
    await recordAnalyticsEventSafe({
      eventName: 'newsletter_signup',
      path: '/api/newsletter',
      source: parsed.data.source ?? 'site',
      properties: {
        source: parsed.data.source ?? 'site',
        welcome_status: welcome.status,
      },
    }, { ip, userAgent });
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
  const welcome = getResendEmailConfig();
  return NextResponse.json({
    ok: true,
    route: '/api/newsletter',
    method: 'POST',
    welcomeReady: welcome.enabled,
    welcomeMissing: welcome.missing,
  });
}
