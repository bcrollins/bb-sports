/**
 * BB Sports — Edge middleware. Two layers:
 *
 *   (1) Site-wide gate:    every public visit requires the bb_gate cookie. Without it,
 *                          requests are redirected to /coming-soon where the gate
 *                          password is entered. The password is validated server-side
 *                          and the cookie is signed so credential rotation revokes it.
 *
 *   (2) Admin gate:        /admin/* and /api/admin/* require a valid bb_session JWT
 *                          (Bradley's super-admin login). Verified here in Edge with
 *                          jose; route handlers re-verify against the users table.
 *
 * Always allowed (no gate, no auth):
 *   /coming-soon, /api/gate, /api/health, /api/analytics, Stripe webhook, newsletter unsubscribe, approved media streams,
 *   static brand/image assets, _next assets, robots/sitemap/icons/og.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { GATE_COOKIE_NAME, verifyGateCookieToken } from '@/lib/gate-cookie';
import {
  ADMIN_SESSION_AUDIENCE,
  ADMIN_SESSION_ISSUER,
  ADMIN_SESSION_PURPOSE,
  isAdminRole,
} from '@/lib/admin-session-contract';

const SESSION_COOKIE = 'bb_session';

/** Paths the site gate never blocks (newsletter etc. work pre-gate so users can sign up). */
const GATE_BYPASS_EXACT = new Set<string>([
  '/coming-soon',
  '/api/gate',
  '/api/health',
  '/api/analytics',
  '/api/newsletter',
  '/api/rankings',
  '/api/stripe/webhook',
  '/api/newsletter/unsubscribe',
  '/newsletter/unsubscribe',
  '/robots.txt',
  '/sitemap.xml',
  '/rss.xml',
  '/favicon.ico',
  '/og.png',
  '/icon.svg',
]);
const GATE_BYPASS_PREFIX = ['/_next/', '/api/media/assets/', '/brand/', '/images/']; // Static assets always pass the gate.
const ADMIN_PUBLIC = new Set<string>(['/admin/login', '/api/admin/login', '/api/admin/logout']);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 0. Always allow Next assets.
  if (GATE_BYPASS_PREFIX.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // 1. Site wall — every non-bypass route requires either bb_gate or a valid
  // admin session. This includes /admin/login so the white wall is truly global.
  if (GATE_BYPASS_EXACT.has(pathname)) return NextResponse.next();

  const hasGate = await verifyGateCookieToken(req.cookies.get(GATE_COOKIE_NAME)?.value);
  const hasSession = await hasValidSession(req);
  if (!hasGate && !hasSession) {
    // For API requests, return 401 instead of redirecting (caller is JS, not a browser).
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Site gated' }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = '/coming-soon';
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // 2. Admin routes — after the white wall is cleared, require a valid
  // newsroom JWT. /admin/login and login/logout APIs stay public behind the wall.
  const adminCheck = await adminAuthIfNeeded(req, pathname);
  if (adminCheck) return adminCheck;

  return NextResponse.next();
}

async function adminAuthIfNeeded(req: NextRequest, pathname: string): Promise<NextResponse | null> {
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  if (!isAdminRoute) return null;
  if (ADMIN_PUBLIC.has(pathname)) return NextResponse.next();

  if (await hasValidSession(req)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      issuer: ADMIN_SESSION_ISSUER,
      audience: ADMIN_SESSION_AUDIENCE,
    });
    return Boolean(
      payload.sub &&
        payload.jti &&
        payload.purpose === ADMIN_SESSION_PURPOSE &&
        isAdminRole(payload.role),
    );
  } catch {
    return false;
  }
}

export const config = {
  // Run on every path except Next internals & static files.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
