import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, getSession, clearSessionCookie } from '@/lib/auth';
import {
  revokeOtherSessionsForUser,
  revokeSessionByIdForUser,
} from '@/lib/admin-sessions';
import { recordAdminAuditEvent } from '@/lib/admin-audit';
import { rejectIfMutationBlocked } from '@/lib/mutation-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('one'),
    sessionId: z.string().uuid(),
  }),
  z.object({
    scope: z.literal('others'),
  }),
]);

export async function POST(req: NextRequest) {
  const blocked = rejectIfMutationBlocked(req);
  if (blocked) return blocked;

  const user = await getCurrentUser();
  const session = await getSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid revoke request.' }, { status: 400 });
  }

  if (parsed.data.scope === 'one') {
    const result = await revokeSessionByIdForUser({
      userId: user.id,
      sessionId: parsed.data.sessionId,
      currentJti: session.jti,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    await recordAdminAuditEvent({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'session.revoke_one',
      summary: result.revokedCurrent
        ? 'Revoked current newsroom session'
        : 'Revoked another newsroom session',
    });
    if (result.revokedCurrent) {
      await clearSessionCookie();
      return NextResponse.json({
        ok: true,
        revokedCurrent: true,
        redirectTo: '/admin/login',
      });
    }
    return NextResponse.json({ ok: true, revokedCurrent: false });
  }

  const others = await revokeOtherSessionsForUser({
    userId: user.id,
    currentJti: session.jti,
  });
  if (!others.ok) {
    return NextResponse.json({ error: others.error }, { status: 503 });
  }
  await recordAdminAuditEvent({
    actorUserId: user.id,
    actorEmail: user.email,
    action: 'session.revoke_others',
    summary: `Revoked ${others.count} other active session(s)`,
  });
  return NextResponse.json({ ok: true, count: others.count });
}
