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
 *   - Durable rate limit on IP + email hash (no password stored).
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
import {
  assertAuthAttemptAllowed,
  recordAuthFailure,
  recordAuthSuccess,
} from '@/lib/auth-rate-limit';
import { requestMeta } from '@/lib/request-meta';
import { rejectIfMutationBlocked } from '@/lib/mutation-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: 'Too many attempts. Try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, retryAfterSec)) },
    },
  );
}

export async function POST(req: NextRequest) {
  const blocked = rejectIfMutationBlocked(req);
  if (blocked) return blocked;

  if (!dbAvailable || !db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  await ensureBootstrapped();

  const { ip } = requestMeta(req);

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

  const precheck = await assertAuthAttemptAllowed({
    purpose: 'admin_login',
    ip,
    account: email,
  });
  if (!precheck.allowed) return tooMany(precheck.retryAfterSec);

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) {
    // Constant-time miss: bcrypt against a real hash so this code path takes the
    // same time as the wrong-password path. Stops email enumeration via timing.
    await verifyPassword(password, getTimingMitigationHash());
    const after = await recordAuthFailure({ purpose: 'admin_login', ip, account: email });
    if (!after.allowed) return tooMany(after.retryAfterSec);
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const after = await recordAuthFailure({ purpose: 'admin_login', ip, account: email });
    if (!after.allowed) return tooMany(after.retryAfterSec);
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  await recordAuthSuccess({ purpose: 'admin_login', ip, account: email });

  const { token, jti, exp } = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
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
