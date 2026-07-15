import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsPayloadSchema, hashAnalyticsValue, sanitizeAnalyticsProperties } from '../lib/analytics';
import { articlePayloadSchema, articlePatchSchema } from '../lib/article-validation';
import { BRADLEY_BRAND_ASSETS, PRIMARY_BRADLEY_ASSET } from '../lib/brandAssets';
import { moderateComment, PUBLIC_COMMENT_MODERATION_RULES } from '../lib/comment-moderation';
import { commentCreateSchema, commentModerationSchema } from '../lib/comment-validation';
import { accessWallUpdateSchema, contactSubmissionSchema, donationIntentSchema, newsletterSignupSchema, newsletterUnsubscribeSchema } from '../lib/intake-validation';
import { mediaGenerationSchema } from '../lib/media-validation';
import { createNewsletterUnsubscribeToken } from '../lib/queries';
import { safeAdminPath, safeInternalPath } from '../lib/redirects';
import { composeSportsMediaPrompt } from '../lib/xai-media';

test('newsletter signup normalizes email and rejects invalid addresses', () => {
  assert.equal(newsletterSignupSchema.parse({ email: '  BRAD@BBSPORTS.FANS ' }).email, 'brad@bbsports.fans');
  assert.equal(newsletterSignupSchema.safeParse({ email: 'not-an-email' }).success, false);
});

test('newsletter unsubscribe token is one-click safe and non-guessable', () => {
  const token = createNewsletterUnsubscribeToken();
  assert.match(token, /^[a-f0-9]{48}$/);
  assert.equal(newsletterUnsubscribeSchema.safeParse({ token }).success, true);
  assert.equal(newsletterUnsubscribeSchema.safeParse({ token: 'short' }).success, false);
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
    source: 'support-page',
  });
  assert.equal(parsed.amountCents, 2500);
  assert.equal(parsed.source, 'support-page');
});

test('analytics payloads are first-party and privacy-filtered', () => {
  const parsed = analyticsPayloadSchema.parse({
    eventName: 'search_performed',
    path: '/search?q=Bears',
    referrer: 'https://bbsports.fans/',
    anonId: 'reader-1',
    properties: {
      query_length: 5,
      result_count: 2,
      email: 'fan@example.com',
      message: 'private note',
      sport: 'nfl',
    },
  });
  assert.equal(parsed.eventName, 'search_performed');
  assert.equal(analyticsPayloadSchema.safeParse({ eventName: 'BadEvent' }).success, false);
  const clean = sanitizeAnalyticsProperties(parsed.properties);
  assert.deepEqual(clean, { query_length: 5, result_count: 2, sport: 'nfl' });
  // Without dedicated ANALYTICS_HASH_SALT, hashing fails closed (no JWT/default salt).
  assert.equal(hashAnalyticsValue('203.0.113.1', {}), null);
  assert.match(
    hashAnalyticsValue('203.0.113.1', { ANALYTICS_HASH_SALT: 'unit-test-salt-ok-16+' }) ?? '',
    /^[a-f0-9]{64}$/,
  );
});

test('access wall update requires a durable password length', () => {
  assert.equal(accessWallUpdateSchema.safeParse({ password: 'short' }).success, false);
  assert.equal(accessWallUpdateSchema.safeParse({ password: 'a-durable-wall-password' }).success, true);
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

test('article create and patch payloads reject heroes that next/image cannot render', () => {
  const valid = {
    slug: 'renderable-hero',
    title: 'Renderable hero',
    hero: '/images/hero-bears.svg',
    heroAlt: 'Chicago football players on the field',
    heroCredit: 'BB Sports illustration',
  };
  assert.equal(articlePayloadSchema.safeParse(valid).success, true);
  assert.equal(
    articlePayloadSchema.safeParse({ ...valid, hero: 'https://evil.example/hero.jpg' }).success,
    false,
  );
  assert.equal(
    articlePatchSchema.safeParse({ hero: '/images/../secrets.txt' }).success,
    false,
  );
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

test('comment schema supports threaded reader replies without fake engagement', () => {
  const parsed = commentCreateSchema.parse({
    parentId: '11111111-1111-4111-8111-111111111111',
    authorName: 'Bears Fan',
    authorEmail: ' FAN@EXAMPLE.COM ',
    body: 'This take is hot, but the offensive line point is fair.',
  });
  assert.equal(parsed.authorEmail, 'fan@example.com');
  assert.equal(parsed.parentId, '11111111-1111-4111-8111-111111111111');
  assert.equal(commentCreateSchema.safeParse({ authorName: 'B', body: 'ok' }).success, false);
});

test('comment moderation flags spam/gambling promos and allows clean comments', () => {
  assert.equal(moderateComment('Normal comment about a Bears depth chart.').status, 'approved');
  assert.equal(moderateComment('Guaranteed winner lock of the day, join my sportsbook.').status, 'spam');
  assert.equal(moderateComment('THIS TAKE IS ABSOLUTELY INSANE AND FAKE').status, 'flagged');
  assert.ok(PUBLIC_COMMENT_MODERATION_RULES.rateLimit.includes('5 comments'));
  assert.equal(commentModerationSchema.safeParse({ status: 'approved' }).success, true);
  assert.equal(commentModerationSchema.safeParse({ status: 'deleted' }).success, false);
});
