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
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from './db/client';
import { users, sessions, type User } from './db/schema';

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
  const token = await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(secret());
  return { token, jti, exp };
}

/** Verify a JWT and return the payload, or null. */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (!payload.sub || !payload.jti) return null;
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
  const c = cookies().get(COOKIE);
  if (!c?.value) return null;
  return verifySession(c.value);
}

/** Higher-level: load the User row for the current request. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session || !db) return null;
  const rows = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
  return rows[0] ?? null;
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

/** Set the session cookie on the response. Call only inside a route handler / server action. */
export function setSessionCookie(token: string, exp: Date) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: exp,
  });
}

/** Clear the session cookie. */
export function clearSessionCookie() {
  cookies().delete(COOKIE);
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
  if (!db) return;
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
  if (!db) return;
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.jwtId, jti));
}
