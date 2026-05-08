import { NextRequest, NextResponse } from 'next/server';
import { newsletterUnsubscribeSchema, validationErrorMessage } from '@/lib/intake-validation';
import { unsubscribeNewsletterSubscriber } from '@/lib/queries';
import { recordAnalyticsEventSafe } from '@/lib/analytics';
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

  const parsed = newsletterUnsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }

  try {
    const subscriber = await unsubscribeNewsletterSubscriber(parsed.data.token);
    if (!subscriber) return NextResponse.json({ error: 'Unsubscribe link not found.' }, { status: 404 });
    await recordAnalyticsEventSafe({
      eventName: 'newsletter_unsubscribe',
      path: '/newsletter/unsubscribe',
      source: 'unsubscribe-post',
      properties: { method: 'post' },
    }, { ip, userAgent });
    return NextResponse.json({ ok: true, message: 'You are unsubscribed from BB Sports email.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Newsletter ledger unavailable.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  const { ip, userAgent } = requestMeta(req);
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const parsed = newsletterUnsubscribeSchema.safeParse({ token });
  if (!parsed.success) {
    return NextResponse.json({ error: validationErrorMessage(parsed.error) }, { status: 400 });
  }
  try {
    const subscriber = await unsubscribeNewsletterSubscriber(parsed.data.token);
    if (!subscriber) return NextResponse.json({ error: 'Unsubscribe link not found.' }, { status: 404 });
    await recordAnalyticsEventSafe({
      eventName: 'newsletter_unsubscribe',
      path: '/newsletter/unsubscribe',
      source: 'unsubscribe-link',
      properties: { method: 'get' },
    }, { ip, userAgent });
    return NextResponse.json({ ok: true, message: 'You are unsubscribed from BB Sports email.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Newsletter ledger unavailable.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
