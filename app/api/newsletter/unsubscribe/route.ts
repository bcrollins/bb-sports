import { NextRequest, NextResponse } from 'next/server';
import { newsletterUnsubscribeSchema, validationErrorMessage } from '@/lib/intake-validation';
import {
  getNewsletterSubscriberByToken,
  unsubscribeNewsletterSubscriber,
} from '@/lib/queries';
import { recordAnalyticsEventSafe } from '@/lib/analytics';
import { requestMeta } from '@/lib/request-meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseToken(value: unknown): string | null {
  const parsed = newsletterUnsubscribeSchema.safeParse({ token: value ?? '' });
  return parsed.success ? parsed.data.token : null;
}

/**
 * RFC 8058 + human form POST. Accepts:
 * - JSON `{ "token": "..." }`
 * - form `token=...`
 * - form `List-Unsubscribe=One-Click` with token in query string
 */
async function extractToken(req: NextRequest): Promise<{ token: string | null; parseError?: string }> {
  const queryToken = parseToken(req.nextUrl.searchParams.get('token'));
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return { token: null, parseError: 'Invalid JSON.' };
    }
    const fromBody = parseToken(
      body && typeof body === 'object' && body !== null && 'token' in body
        ? (body as { token?: unknown }).token
        : undefined,
    );
    if (fromBody) return { token: fromBody };
    if (queryToken) return { token: queryToken };
    return {
      token: null,
      parseError: validationErrorMessage(
        newsletterUnsubscribeSchema.safeParse({ token: '' }).error!,
      ),
    };
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    try {
      const form = await req.formData();
      const formToken = parseToken(form.get('token'));
      if (formToken) return { token: formToken };
      // RFC 8058 one-click: body is List-Unsubscribe=One-Click; token is in URL.
      const oneClick = String(form.get('List-Unsubscribe') ?? '');
      if (oneClick.toLowerCase() === 'one-click' && queryToken) {
        return { token: queryToken };
      }
      if (queryToken) return { token: queryToken };
    } catch {
      return { token: null, parseError: 'Invalid form body.' };
    }
  }

  if (queryToken) return { token: queryToken };
  return {
    token: null,
    parseError: validationErrorMessage(
      newsletterUnsubscribeSchema.safeParse({ token: '' }).error!,
    ),
  };
}

export async function POST(req: NextRequest) {
  const { ip, userAgent } = requestMeta(req);
  const contentType = req.headers.get('content-type') ?? '';
  const isBrowserForm =
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');
  const { token, parseError } = await extractToken(req);
  if (!token) {
    if (isBrowserForm) {
      return NextResponse.redirect(new URL('/newsletter/unsubscribe?error=1', req.url), 303);
    }
    return NextResponse.json({ error: parseError ?? 'Invalid token.' }, { status: 400 });
  }

  try {
    const subscriber = await unsubscribeNewsletterSubscriber(token);
    if (!subscriber) {
      if (isBrowserForm) {
        return NextResponse.redirect(new URL('/newsletter/unsubscribe?error=1', req.url), 303);
      }
      return NextResponse.json({ error: 'Unsubscribe link not found.' }, { status: 404 });
    }
    await recordAnalyticsEventSafe(
      {
        eventName: 'newsletter_unsubscribe',
        path: '/api/newsletter/unsubscribe',
        source: 'unsubscribe-post',
        properties: { method: 'post' },
      },
      { ip, userAgent },
    );
    if (isBrowserForm) {
      const done = new URL('/newsletter/unsubscribe', req.url);
      done.searchParams.set('token', token);
      done.searchParams.set('done', '1');
      return NextResponse.redirect(done, 303);
    }
    return NextResponse.json({
      ok: true,
      message: 'You are unsubscribed from BB Sports email.',
      status: subscriber.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Newsletter ledger unavailable.';
    if (isBrowserForm) {
      return NextResponse.redirect(new URL('/newsletter/unsubscribe?error=1', req.url), 303);
    }
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

/**
 * GET is read-only. Email security scanners must not be able to suppress
 * consent by prefetching the List-Unsubscribe URL.
 */
export async function GET(req: NextRequest) {
  const token = parseToken(req.nextUrl.searchParams.get('token'));
  if (!token) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 });
  }

  try {
    const subscriber = await getNewsletterSubscriberByToken(token);
    if (!subscriber) {
      return NextResponse.json({ error: 'Unsubscribe link not found.' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      mutates: false,
      status: subscriber.status,
      message:
        subscriber.status === 'unsubscribed'
          ? 'This address is already unsubscribed.'
          : 'Confirm unsubscribe with POST (RFC one-click or human form).',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Newsletter ledger unavailable.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
