const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

export type ResendWelcomeResult =
  | { status: 'disabled'; reason: string; missing: string[] }
  | { status: 'sent'; providerId: string }
  | { status: 'failed'; reason: string };

export function getResendEmailConfig(env: EnvLike = process.env): {
  enabled: boolean;
  approved: boolean;
  apiKey: string;
  from: string;
  missing: string[];
} {
  const apiKey = clean(env.RESEND_API_KEY);
  const from = clean(env.RESEND_FROM);
  const approved = clean(env.BBSPORTS_APPROVED_RESEND).toLowerCase() === 'true';
  const missing = [];
  if (!approved) missing.push('BBSPORTS_APPROVED_RESEND');
  if (!apiKey) missing.push('RESEND_API_KEY');
  if (!from) missing.push('RESEND_FROM');
  return {
    enabled: missing.length === 0,
    approved,
    apiKey,
    from,
    missing,
  };
}

/** Human confirmation page (GET is read-only; form POST mutates). */
export function newsletterUnsubscribeUrl(origin: string, token: string): string {
  const url = new URL('/newsletter/unsubscribe', origin);
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * RFC 8058 one-click endpoint. Must accept form body
 * `List-Unsubscribe=One-Click` without a confirmation step.
 * Token lives only in the URL query (never logged).
 */
export function newsletterOneClickUnsubscribeUrl(origin: string, token: string): string {
  const url = new URL('/api/newsletter/unsubscribe', origin);
  url.searchParams.set('token', token);
  return url.toString();
}

export function buildNewsletterWelcomeEmail(input: {
  to: string;
  from: string;
  unsubscribeUrl: string;
  /** RFC 8058 machine one-click URL (API). Defaults to human page only if omitted. */
  oneClickUnsubscribeUrl?: string;
}): {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
} {
  const oneClickUrl = input.oneClickUnsubscribeUrl ?? input.unsubscribeUrl;
  return {
    from: input.from,
    to: [input.to],
    subject: 'Welcome to BB Sports',
    text: [
      'You are on the BB Sports list.',
      '',
      'Brad Benson writes sports from the fan view. No spin, no script, no paywall.',
      '',
      'You will get launch notes and new-take alerts when BB Sports publishes.',
      '',
      `Unsubscribe: ${input.unsubscribeUrl}`,
    ].join('\n'),
    html: [
      '<p>You are on the BB Sports list.</p>',
      '<p>Brad Benson writes sports from the fan view. No spin, no script, no paywall.</p>',
      '<p>You will get launch notes and new-take alerts when BB Sports publishes.</p>',
      `<p><a href="${escapeHtml(input.unsubscribeUrl)}">Manage email preferences / unsubscribe</a></p>`,
    ].join(''),
    headers: {
      // Machine clients POST One-Click to the API URL; humans use the page link above.
      'List-Unsubscribe': `<${oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

export async function sendNewsletterWelcomeEmail(input: {
  to: string;
  unsubscribeToken: string | null;
  origin: string;
  alreadySentAt?: Date | string | null;
}, env: EnvLike = process.env, fetcher: FetchLike = fetch): Promise<ResendWelcomeResult> {
  if (input.alreadySentAt) {
    return { status: 'disabled', reason: 'welcome-already-sent', missing: [] };
  }
  if (!input.unsubscribeToken) {
    return { status: 'disabled', reason: 'missing-unsubscribe-token', missing: ['unsubscribe_token'] };
  }

  const config = getResendEmailConfig(env);
  if (!config.enabled) {
    return { status: 'disabled', reason: 'resend-not-configured', missing: config.missing };
  }

  const unsubscribeUrl = newsletterUnsubscribeUrl(input.origin, input.unsubscribeToken);
  const oneClickUnsubscribeUrl = newsletterOneClickUnsubscribeUrl(
    input.origin,
    input.unsubscribeToken,
  );
  const payload = buildNewsletterWelcomeEmail({
    to: input.to,
    from: config.from,
    unsubscribeUrl,
    oneClickUnsubscribeUrl,
  });

  let response: Response;
  try {
    response = await fetcher(RESEND_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { status: 'failed', reason: err instanceof Error ? err.message : 'Resend request failed' };
  }

  const body = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: string };
  if (!response.ok || !body.id) {
    return {
      status: 'failed',
      reason: body.message || body.error || `Resend returned ${response.status}`,
    };
  }
  return { status: 'sent', providerId: body.id };
}

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
