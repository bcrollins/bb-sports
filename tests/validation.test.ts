import assert from 'node:assert/strict';
import test from 'node:test';
import { articlePayloadSchema, articlePatchSchema } from '../lib/article-validation';
import { BRADLEY_BRAND_ASSETS, PRIMARY_BRADLEY_ASSET } from '../lib/brandAssets';
import { accessWallUpdateSchema, contactSubmissionSchema, donationIntentSchema, newsletterSignupSchema } from '../lib/intake-validation';
import { mediaGenerationSchema } from '../lib/media-validation';
import { safeAdminPath, safeInternalPath } from '../lib/redirects';
import { composeSportsMediaPrompt } from '../lib/xai-media';

test('newsletter signup normalizes email and rejects invalid addresses', () => {
  assert.equal(newsletterSignupSchema.parse({ email: '  BRAD@BBSPORTS.MEDIA ' }).email, 'brad@bbsports.media');
  assert.equal(newsletterSignupSchema.safeParse({ email: 'not-an-email' }).success, false);
});

test('contact submission enforces mode, message length, and normalized email', () => {
  const parsed = contactSubmissionSchema.parse({
    mode: 'tip',
    email: 'SOURCE@EXAMPLE.COM',
    message: 'This is a real tip with enough detail.',
    secure: true,
  });
  assert.equal(parsed.email, 'source@example.com');
  assert.equal(parsed.secure, true);
  assert.equal(contactSubmissionSchema.safeParse({ mode: 'bad', email: 'a@b.com', message: 'enough words' }).success, false);
  assert.equal(contactSubmissionSchema.safeParse({ mode: 'tip', email: 'a@b.com', message: 'short' }).success, false);
});

test('donation intent accepts supporter waitlist data without Stripe checkout', () => {
  const parsed = donationIntentSchema.parse({
    email: 'fan@example.com',
    amountCents: '2500',
    message: 'Let me know when donations open.',
  });
  assert.equal(parsed.amountCents, 2500);
  assert.equal(parsed.source, 'site');
});

test('access wall update requires a durable password length', () => {
  assert.equal(accessWallUpdateSchema.safeParse({ password: 'short' }).success, false);
  assert.equal(accessWallUpdateSchema.safeParse({ password: 'calebwilliamsMVP' }).success, true);
});

test('article payload blocks publish when AI-assisted piece lacks Brad take', () => {
  const result = articlePayloadSchema.safeParse({
    slug: 'ai-piece',
    title: 'AI piece',
    aiAssisted: true,
    published: true,
  });
  assert.equal(result.success, false);
});

test('article patch does not inject defaults when publishing an existing draft', () => {
  const parsed = articlePatchSchema.parse({ published: true });
  assert.deepEqual(parsed, { published: true });
});

test('article payload requires image alt text and credit when hero is set', () => {
  const result = articlePayloadSchema.safeParse({
    slug: 'photo-piece',
    title: 'Photo piece',
    hero: 'https://images.unsplash.com/photo-test',
  });
  assert.equal(result.success, false);
});

test('redirect helpers reject external and non-admin targets', () => {
  assert.equal(safeInternalPath('/admin/articles'), '/admin/articles');
  assert.equal(safeInternalPath('//evil.example'), '/');
  assert.equal(safeInternalPath('https://evil.example'), '/');
  assert.equal(safeAdminPath('/admin/articles/new'), '/admin/articles/new');
  assert.equal(safeAdminPath('/'), '/admin');
  assert.equal(safeAdminPath('//evil.example'), '/admin');
});

test('Bradley brand assets are production-safe public paths', async () => {
  assert.equal(PRIMARY_BRADLEY_ASSET.kind, 'founder-photo');
  assert.ok(BRADLEY_BRAND_ASSETS.length >= 3);

  for (const asset of BRADLEY_BRAND_ASSETS) {
    assert.match(asset.src, /^\/brand\/bradley\/.+\.jpg$/);
    assert.ok(asset.alt.length > 30);
    assert.ok(asset.credit.includes('BB Sports'));
    assert.ok(asset.width > 0);
    assert.ok(asset.height > 0);

    const file = new URL(`../public${asset.src}`, import.meta.url);
    const { access } = await import('node:fs/promises');
    await assert.doesNotReject(() => access(file));
  }
});

test('Grok media generation schema and prompt enforce BB Sports safety', () => {
  const parsed = mediaGenerationSchema.parse({
    kind: 'image',
    placement: 'article-hero',
    sport: 'NFL',
    brief: 'A playoff-caliber Bears offensive line feature image with cold weather and broadcast desk energy.',
    aspectRatio: '16:9',
  });
  assert.equal(parsed.kind, 'image');
  assert.equal(parsed.n, 1);
  const prompt = composeSportsMediaPrompt(parsed);
  assert.match(prompt, /BB Sports/);
  assert.match(prompt, /do not copy official team logos/i);
  assert.match(prompt, /player likenesses/i);
});
