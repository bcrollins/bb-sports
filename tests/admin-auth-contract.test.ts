import assert from 'node:assert/strict';
import test from 'node:test';
import { SignJWT } from 'jose';
import {
  ADMIN_SESSION_AUDIENCE,
  ADMIN_SESSION_ISSUER,
  ADMIN_SESSION_PURPOSE,
  isAdminRole,
} from '../lib/admin-session-contract';
import { signSession, verifySession } from '../lib/auth';
import { editableSiteConfigUpdateSchema } from '../lib/editable-site-config';

const TEST_SECRET = 'test-only-admin-jwt-secret-at-least-32-bytes';
const secret = new TextEncoder().encode(TEST_SECRET);
const originalSecret = process.env.JWT_SECRET;

test.after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

test('admin JWTs require the newsroom issuer, audience, purpose, subject, and jti', async () => {
  process.env.JWT_SECRET = TEST_SECRET;
  const { token, jti } = await signSession({
    sub: '2ca74ff8-4b0b-4ee7-b2b7-f083703a6d48',
    email: 'editor@example.com',
    name: 'Editor',
    role: 'super_admin',
  });

  const valid = await verifySession(token);
  assert.equal(valid?.jti, jti);
  assert.equal(valid?.sub, '2ca74ff8-4b0b-4ee7-b2b7-f083703a6d48');

  const legacyToken = await new SignJWT({
    role: 'super_admin',
    email: 'editor@example.com',
    name: 'Editor',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('2ca74ff8-4b0b-4ee7-b2b7-f083703a6d48')
    .setJti('legacy-jti')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
  assert.equal(await verifySession(legacyToken), null, 'legacy claim-less tokens must be rejected');

  const wrongAudience = await new SignJWT({
    role: 'super_admin',
    purpose: ADMIN_SESSION_PURPOSE,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ADMIN_SESSION_ISSUER)
    .setAudience('some-other-app')
    .setSubject('2ca74ff8-4b0b-4ee7-b2b7-f083703a6d48')
    .setJti('wrong-audience-jti')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
  assert.equal(await verifySession(wrongAudience), null);
  assert.notEqual(ADMIN_SESSION_AUDIENCE, 'some-other-app');
});

test('newsroom roles are explicit and fail closed', () => {
  assert.equal(isAdminRole('super_admin'), true);
  assert.equal(isAdminRole('admin'), true);
  assert.equal(isAdminRole('editor'), true);
  assert.equal(isAdminRole('viewer'), false);
  assert.equal(isAdminRole(undefined), false);
});

test('site-config mutations accept only validated editable keys and internal links', () => {
  assert.equal(
    editableSiteConfigUpdateSchema.safeParse({
      key: 'hero',
      value: {
        version: 2,
        headline: 'Sports from the fan view.',
        cta_primary: { label: 'Read', href: '/articles' },
      },
    }).success,
    true,
  );
  assert.equal(
    editableSiteConfigUpdateSchema.safeParse({
      key: 'hero',
      value: { cta_primary: { label: 'Leave', href: 'https://evil.example' } },
    }).success,
    false,
  );
  assert.equal(
    editableSiteConfigUpdateSchema.safeParse({
      key: 'access_wall',
      value: { passwordHash: 'must-never-pass' },
    }).success,
    false,
  );
  assert.equal(
    editableSiteConfigUpdateSchema.safeParse({
      key: 'footer_tagline',
      value: 'Fan-first sports reporting.',
      unexpected: true,
    }).success,
    false,
  );
});
