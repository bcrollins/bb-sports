/**
 * POST /api/gate — soft-launch site gate.
 *
 * Body: { password: string }
 *
 * If the password matches the configured gate password (env GATE_PASSWORD,
 * default "freerashee"), set the bb_gate cookie and respond 200. Otherwise 401.
 *
 * Also accepts GET to clear the gate (for testing) — admins can hit /api/gate?reset=1.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE = 'bb_gate';
const ONE_YEAR = 365 * 24 * 60 * 60;

function getExpected(): string {
  return (process.env.GATE_PASSWORD ?? 'freerashee').trim();
}

export async function POST(req: NextRequest) {
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const submitted = String(body.password ?? '').trim();
  const expected = getExpected();
  if (!submitted || submitted.toLowerCase() !== expected.toLowerCase()) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  });
  return res;
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('reset') === '1') {
    const res = NextResponse.json({ ok: true, reset: true });
    res.cookies.delete(COOKIE);
    return res;
  }
  return NextResponse.json({ gated: true });
}
