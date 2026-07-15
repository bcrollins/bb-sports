/**
 * POST /api/gate — soft-launch site gate.
 *
 * Body: { password: string }
 *
 * If the password matches the Railway-managed operator credential or the
 * admin-managed DB hash, set a signed bb_gate cookie and respond 200.
 * Otherwise 401. Signed cookies are invalidated when GATE_COOKIE_SECRET rotates.
 *
 * Also accepts GET to clear the gate (for testing) — admins can hit /api/gate?reset=1.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessWallPassword } from '@/lib/access-wall';
import {
  createGateCookieToken,
  GATE_COOKIE_MAX_AGE_SECONDS,
  GATE_COOKIE_NAME,
  gateCookieIsConfigured,
} from '@/lib/gate-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const submitted = String(body.password ?? '');
  if (!submitted || !(await verifyAccessWallPassword(submitted))) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  if (!gateCookieIsConfigured()) {
    return NextResponse.json({ error: 'Access wall is unavailable.' }, { status: 503 });
  }

  const token = await createGateCookieToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GATE_COOKIE_MAX_AGE_SECONDS,
    priority: 'high',
  });
  return res;
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('reset') === '1') {
    const res = NextResponse.json({ ok: true, reset: true });
    res.cookies.delete(GATE_COOKIE_NAME);
    return res;
  }
  return NextResponse.json({ gated: true, signedCookies: gateCookieIsConfigured() });
}
