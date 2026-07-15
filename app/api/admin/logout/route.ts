/**
 * POST /api/admin/logout — clears the session cookie and revokes the audit row.
 */
import { NextResponse } from 'next/server';
import { clearSessionCookieOnResponse, getSession, revokeSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const s = await getSession();
  if (s?.jti) {
    try {
      await revokeSession(s.jti);
    } catch {
      // Keep the cookie so the operator can retry. Clearing it after a failed
      // revocation would make a copied token difficult to invalidate safely.
      return NextResponse.json({ error: 'Logout could not be completed safely.' }, { status: 503 });
    }
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res);
  return res;
}
