/**
 * Brad's session control — list and revoke without exposing raw IP/tokens.
 */
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { sessions } from '@/lib/db/schema';
import { ensureBootstrapped } from '@/lib/db/bootstrap';

export type SafeSessionRow = {
  id: string;
  /** Short fingerprint of jti for UI only — never the full token. */
  sessionLabel: string;
  isCurrent: boolean;
  deviceSummary: string;
  networkSummary: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
};

export function summarizeUserAgent(ua: string | null | undefined): string {
  const raw = (ua ?? '').trim();
  if (!raw) return 'Unknown device';
  const lower = raw.toLowerCase();
  let browser = 'Browser';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/') && !lower.includes('edg/')) browser = 'Chrome';
  else if (lower.includes('safari/') && !lower.includes('chrome/')) browser = 'Safari';
  else if (lower.includes('firefox/')) browser = 'Firefox';

  let os = 'device';
  if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('mac os') || lower.includes('macintosh')) os = 'macOS';
  else if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

/** Never expose full IP — coarse last-octet mask only for operator recognition. */
export function summarizeNetwork(ip: string | null | undefined): string {
  const raw = (ip ?? '').trim();
  if (!raw || raw === 'unknown') return 'Network unknown';
  if (raw.includes(':')) {
    // IPv6 — show first two hextets only
    const parts = raw.split(':').filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}:…` : 'IPv6 network';
  }
  const octets = raw.split('.');
  if (octets.length === 4) {
    return `${octets[0]}.${octets[1]}.x.x`;
  }
  return 'Network masked';
}

export function sessionLabelFromJti(jti: string): string {
  return `sess_${jti.slice(0, 8)}`;
}

export async function listSafeSessionsForUser(opts: {
  userId: string;
  currentJti: string | null;
  limit?: number;
}): Promise<SafeSessionRow[]> {
  if (!db) return [];
  await ensureBootstrapped();
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, opts.userId))
    .orderBy(desc(sessions.createdAt))
    .limit(limit);

  const now = Date.now();
  return rows.map((row) => {
    const revoked = Boolean(row.revokedAt);
    const expired = row.expiresAt.getTime() <= now;
    return {
      id: row.id,
      sessionLabel: sessionLabelFromJti(row.jwtId),
      isCurrent: Boolean(opts.currentJti && row.jwtId === opts.currentJti),
      deviceSummary: summarizeUserAgent(row.userAgent),
      networkSummary: summarizeNetwork(row.ipAddress),
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
      active: !revoked && !expired,
    };
  });
}

export async function revokeSessionByIdForUser(opts: {
  userId: string;
  sessionId: string;
  currentJti: string | null;
}): Promise<{ ok: true; revokedCurrent: boolean } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: 'Database unavailable.' };
  await ensureBootstrapped();
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, opts.sessionId), eq(sessions.userId, opts.userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, error: 'Session not found.' };
  if (row.revokedAt) return { ok: true, revokedCurrent: false };

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, row.id));

  return {
    ok: true,
    revokedCurrent: Boolean(opts.currentJti && row.jwtId === opts.currentJti),
  };
}

export async function revokeOtherSessionsForUser(opts: {
  userId: string;
  currentJti: string;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: 'Database unavailable.' };
  await ensureBootstrapped();
  const now = new Date();
  const active = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, opts.userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        ne(sessions.jwtId, opts.currentJti),
      ),
    );
  if (active.length === 0) return { ok: true, count: 0 };
  for (const row of active) {
    await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, row.id));
  }
  return { ok: true, count: active.length };
}
