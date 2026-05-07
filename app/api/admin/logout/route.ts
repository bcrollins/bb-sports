/**
 * POST /api/admin/logout — clears the session cookie and revokes the audit row.
 */
import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession, revokeSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const s = await getSession();
  if (s?.jti) {
    try {
      await revokeSession(s.jti);
    } catch {
      // ignore — audit only
    }
  }
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
