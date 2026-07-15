/**
 * Same-origin mutation guard for cookie-authenticated and public POST APIs.
 *
 * Blocks clear cross-site browser posts while remaining compatible with:
 * - same-origin fetch/XHR (Origin matches Host)
 * - server-side smoke / curl without Origin + without Sec-Fetch-Site
 * - RFC one-click unsubscribe (form POST, same site)
 *
 * Stripe webhooks and other signature-verified machine endpoints must NOT use this.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type MutationGuardResult =
  | { ok: true }
  | { ok: false; status: 403; error: string };

function hostFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function allowedMutationHosts(
  requestHost: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Set<string> {
  const hosts = new Set<string>();
  const add = (h: string | null | undefined) => {
    if (!h) return;
    const cleaned = h.toLowerCase().replace(/:\d+$/, '');
    if (cleaned) hosts.add(cleaned);
  };

  add(requestHost);
  add(requestHost.replace(/^www\./, ''));
  add(requestHost.startsWith('www.') ? requestHost : `www.${requestHost.replace(/^www\./, '')}`);

  const site = env.NEXT_PUBLIC_SITE_URL;
  if (site) add(hostFromUrl(site));
  if (env.CANONICAL_HOST) add(env.CANONICAL_HOST);
  // Local dev
  add('localhost:3000');
  add('127.0.0.1:3000');

  return hosts;
}

/**
 * Pure evaluation for unit tests.
 */
export function evaluateMutationGuard(input: {
  method: string;
  host: string;
  origin: string | null;
  secFetchSite: string | null;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): MutationGuardResult {
  const method = input.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return { ok: true };

  const allowed = allowedMutationHosts(input.host, input.env);
  const originHost = hostFromUrl(input.origin);

  if (originHost) {
    if (allowed.has(originHost)) return { ok: true };
    return { ok: false, status: 403, error: 'Cross-origin request blocked.' };
  }

  const site = (input.secFetchSite || '').toLowerCase();
  if (site === 'cross-site') {
    return { ok: false, status: 403, error: 'Cross-site request blocked.' };
  }
  // Missing Origin + missing/same-origin Sec-Fetch-Site: allow (curl, smoke, some mobile UAs).
  return { ok: true };
}

export function assertMutationAllowed(req: NextRequest): MutationGuardResult {
  return evaluateMutationGuard({
    method: req.method,
    host: req.headers.get('host') ?? '',
    origin: req.headers.get('origin'),
    secFetchSite: req.headers.get('sec-fetch-site'),
  });
}

export function mutationBlockedResponse(result: Extract<MutationGuardResult, { ok: false }>): NextResponse {
  return NextResponse.json({ error: result.error }, { status: result.status });
}

/** Helper for route handlers: returns a Response when blocked, else null. */
export function rejectIfMutationBlocked(req: NextRequest): NextResponse | null {
  const result = assertMutationAllowed(req);
  if (result.ok) return null;
  return mutationBlockedResponse(result);
}
