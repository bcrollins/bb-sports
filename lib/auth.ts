/**
 * BB Sports — auth helpers (JWT + httpOnly cookie + bcrypt verify).
 *
 * Server-side only. Do NOT import from client components.
 *
 * The session cookie is `bb_session`. The token is signed with HS256 using
 * `process.env.JWT_SECRET`. Lifetime: 7 days. Absolute expiry, no refresh.
 */
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { and, eq, gt, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from './db/client';
import { users, sessions, type User } from './db/schema';
import { ensureBootstrapped } from './db/bootstrap';
import {
  ADMIN_SESSION_AUDIENCE,
  ADMIN_SESSION_ISSUER,
  ADMIN_SESSION_PURPOSE,
  isAdminRole,
} from './admin-session-contract';

const COOKIE = 'bb_session';
const SESSION_DAYS = 7;

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET is not set or too short');
  }
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  sub: string; // user id
  email: string;
  name: string;
  role: string;
  jti: string; // session id
}

/** Sign a new session JWT. */
export async function signSession(payload: Omit<SessionPayload, 'jti'>): Promise<{ token: string; jti: string; exp: Date }> {
  const jti = randomUUID();
  const exp = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ ...payload, jti, purpose: ADMIN_SESSION_PURPOSE })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ADMIN_SESSION_ISSUER)
    .setAudience(ADMIN_SESSION_AUDIENCE)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(secret());
  return { token, jti, exp };
}

/** Verify a JWT and return the payload, or null. */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ['HS256'],
      issuer: ADMIN_SESSION_ISSUER,
      audience: ADMIN_SESSION_AUDIENCE,
    });
    if (!payload.sub || !payload.jti || payload.purpose !== ADMIN_SESSION_PURPOSE) return null;
    return {
      sub: String(payload.sub),
      jti: String(payload.jti),
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: String(payload.role ?? 'admin'),
    };
  } catch {
    return null;
  }
}

/** Read & verify the current session from the request cookie. Returns null if missing/invalid. */
export async function getSession(): Promise<SessionPayload | null> {
  const c = (await cookies()).get(COOKIE);
  if (!c?.value) return null;
  return verifySession(c.value);
}

/** Higher-level: load the User row for the current request. */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const session = await getSession();
    if (!session || !db) return null;
    await ensureBootstrapped();
    const rows = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.jwtId, session.jti),
          eq(sessions.userId, session.sub),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const user = rows[0]?.user ?? null;
    // Accepted newsroom roles are super_admin, admin, and editor. The current
    // database role is authoritative; the token's copied role is not.
    return user && isAdminRole(user.role) ? user : null;
  } catch {
    // Never turn a transient DB/bootstrap blip into a stack-trace error page for
    // Brad. Fail closed as signed-out so login stays reachable.
    return null;
  }
}

/** Verify a password against a bcrypt hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Hash a password for storage. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * Returns a real bcrypt hash to compare against on the user-not-found path
 * during login. Computed once on first call, cached for the process lifetime.
 *
 * The login route MUST call `verifyPassword(submitted, getTimingMitigationHash())`
 * when no user row exists, so the not-found case takes the same bcrypt cost as
 * the wrong-password case. Without this, an attacker can enumerate valid emails
 * by measuring response time.
 */
let cachedTimingHash: string | null = null;
export function getTimingMitigationHash(): string {
  if (!cachedTimingHash) {
    cachedTimingHash = bcrypt.hashSync(
      'bb-sports-timing-mitigation-no-user-will-ever-have-this-password',
      10,
    );
  }
  return cachedTimingHash;
}

/** Cookie attributes for the newsroom session. Shared by login/logout. */
export function sessionCookieOptions(exp: Date) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: exp,
  };
}

/**
 * Set the session cookie via the Next.js cookies() helper.
 * Prefer `attachSessionCookie(response, token, exp)` in route handlers so the
 * Set-Cookie header is guaranteed on the returned NextResponse.
 */
export async function setSessionCookie(token: string, exp: Date) {
  (await cookies()).set(COOKIE, token, sessionCookieOptions(exp));
}

/** Attach the session cookie directly onto a route-handler response. */
export function attachSessionCookie(
  res: { cookies: { set: (name: string, value: string, options: ReturnType<typeof sessionCookieOptions>) => void } },
  token: string,
  exp: Date,
) {
  res.cookies.set(COOKIE, token, sessionCookieOptions(exp));
}

/** Clear the session cookie. */
export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

/** Delete the session cookie on a route-handler response. */
export function clearSessionCookieOnResponse(res: {
  cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void };
}) {
  res.cookies.set(COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });
}

/** Convenience name. */
export const COOKIE_NAME = COOKIE;

/** Record a new session row (audit log). */
export async function recordSession(opts: {
  userId: string;
  jti: string;
  ip?: string | null;
  ua?: string | null;
  exp: Date;
}) {
  if (!db) throw new Error('Database unavailable while recording session.');
  await db.insert(sessions).values({
    userId: opts.userId,
    jwtId: opts.jti,
    ipAddress: opts.ip ?? null,
    userAgent: opts.ua ?? null,
    expiresAt: opts.exp,
  });
}

/** Mark a session as revoked. */
export async function revokeSession(jti: string) {
  if (!db) throw new Error('Database unavailable while revoking session.');
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.jwtId, jti));
}
