/**
 * POST /api/admin/login
 *
 * Body: { email, password }
 * Returns: 200 with set-cookie on success, 401 otherwise.
 *
 * Side effects:
 *   - Verifies bcrypt hash of submitted password against users.password_hash.
 *   - Issues a JWT (7-day exp) and writes it to bb_session httpOnly cookie.
 *   - Records the session in the sessions audit table.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, dbAvailable } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { ensureBootstrapped } from '@/lib/db/bootstrap';
import {
  getTimingMitigationHash,
  recordSession,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!dbAvailable || !db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  await ensureBootstrapped();

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) {
    // Constant-time miss: bcrypt against a real hash so this code path takes the
    // same time as the wrong-password path. Stops email enumeration via timing.
    await verifyPassword(password, getTimingMitigationHash());
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const { token, jti, exp } = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = req.headers.get('user-agent');
  // Persist the authoritative row before issuing a replayable browser token.
  // A database failure therefore fails closed and never leaves an orphan JWT.
  await recordSession({ userId: user.id, jti, ip, ua, exp });
  await setSessionCookie(token, exp);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
