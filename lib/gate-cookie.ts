import { SignJWT, jwtVerify } from 'jose';

export const GATE_COOKIE_NAME = 'bb_gate';
export const GATE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const GATE_COOKIE_ISSUER = 'bb-sports';
const GATE_COOKIE_AUDIENCE = 'site-access-wall';
const MIN_SECRET_LENGTH = 32;

function gateCookieSecret(value = process.env.GATE_COOKIE_SECRET): Uint8Array {
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(`GATE_COOKIE_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return new TextEncoder().encode(value);
}

export function gateCookieIsConfigured(value = process.env.GATE_COOKIE_SECRET): boolean {
  return Boolean(value && value.length >= MIN_SECRET_LENGTH);
}

export async function createGateCookieToken(secret = process.env.GATE_COOKIE_SECRET): Promise<string> {
  return new SignJWT({ purpose: GATE_COOKIE_AUDIENCE })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(GATE_COOKIE_ISSUER)
    .setAudience(GATE_COOKIE_AUDIENCE)
    .setSubject('site-access')
    .setIssuedAt()
    .setExpirationTime(`${GATE_COOKIE_MAX_AGE_SECONDS}s`)
    .sign(gateCookieSecret(secret));
}

export async function verifyGateCookieToken(
  token: string | undefined,
  secret = process.env.GATE_COOKIE_SECRET,
): Promise<boolean> {
  if (!token || !gateCookieIsConfigured(secret)) return false;

  try {
    const { payload } = await jwtVerify(token, gateCookieSecret(secret), {
      algorithms: ['HS256'],
      issuer: GATE_COOKIE_ISSUER,
      audience: GATE_COOKIE_AUDIENCE,
      subject: 'site-access',
    });
    return payload.purpose === GATE_COOKIE_AUDIENCE;
  } catch {
    return false;
  }
}
