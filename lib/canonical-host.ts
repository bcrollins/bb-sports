/**
 * Canonical host policy for BB Sports public surfaces.
 * Default apex: bbsports.fans (overridable via CANONICAL_HOST / NEXT_PUBLIC_SITE_URL).
 */
export function getCanonicalHost(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  if (env.CANONICAL_HOST?.trim()) return env.CANONICAL_HOST.trim().toLowerCase();
  const site = env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    try {
      return new URL(site).host.toLowerCase();
    } catch {
      /* fall through */
    }
  }
  return 'bbsports.fans';
}

/**
 * Paths that must stay reachable on any host (probes, webhooks, assets).
 */
export function isCanonicalExemptPath(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/api/health')) return true;
  if (pathname === '/api/stripe/webhook') return true;
  if (pathname.startsWith('/api/media/assets/')) return true;
  if (pathname.startsWith('/brand/') || pathname.startsWith('/images/')) return true;
  return false;
}

/**
 * Whether this Host should 308 to the canonical apex for reader GET/HEAD.
 */
export function shouldRedirectToCanonical(input: {
  host: string;
  method: string;
  pathname: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): { redirect: false } | { redirect: true; locationHost: string } {
  const method = input.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return { redirect: false };
  if (isCanonicalExemptPath(input.pathname)) return { redirect: false };

  const host = input.host.toLowerCase().replace(/:\d+$/, '');
  const canonical = getCanonicalHost(input.env);

  // Local / preview hosts never force-canonical.
  if (
    host === 'localhost' ||
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1') ||
    host.endsWith('.local')
  ) {
    return { redirect: false };
  }

  if (host === canonical) return { redirect: false };

  // www → apex, and known Railway service hosts → apex.
  const isWww = host === `www.${canonical}` || host.startsWith('www.');
  const isRailway = host.endsWith('.up.railway.app') || host.endsWith('.railway.app');
  if (isWww || isRailway) {
    return { redirect: true, locationHost: canonical };
  }

  return { redirect: false };
}
