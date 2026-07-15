import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARTICLE_PUBLICATION_CONFIRMATION_PHRASE,
  ARTICLE_PUBLICATION_FIELDS,
  ARTICLE_HERO_REMOTE_HOSTS,
  VERIFIED_DRAFT_SOURCE_LINK_LIMIT,
  ArticlePublicationInvariantError,
  articleHeroMediaAssetId,
  articlePublicationSnapshotSchema,
  articlePublishRequestSchema,
  canPublishArticle,
  createVerifiedNewsroomArticleDraft,
  hashArticlePublicationSnapshot,
  normalizeArticlePublicationSnapshot,
  slugifyArticleTitle,
  type ArticlePublicationSnapshotInput,
  type VerifiedNewsroomDraftInput,
} from '../lib/article-publication';

const BASE_SNAPSHOT: ArticlePublicationSnapshotInput = {
  slug: 'bears-complete-major-trade',
  title: 'Bears complete major trade',
  dek: 'The move reshapes the depth chart.',
  body: '## What happened\n\nThe Bears completed the move.',
  sport: 'NFL',
  hero: 'https://images.unsplash.com/trade.jpg',
  heroAlt: 'Players gathering on a football field',
  heroCredit: 'BB Sports file photo',
  authorName: 'Brad Benson',
  aiAssisted: false,
  bradsTake: '',
};

test('publication snapshot is normalized, immutable, and hashed as lowercase SHA-256', () => {
  const snapshot = normalizeArticlePublicationSnapshot({
    ...BASE_SNAPSHOT,
    title: '  Bears complete major trade\r\n ',
  });

  assert.equal(snapshot.title, 'Bears complete major trade');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.match(hashArticlePublicationSnapshot(snapshot), /^[a-f0-9]{64}$/);
});

test('every reader-visible article field changes the publication hash', () => {
  const baseline = hashArticlePublicationSnapshot(BASE_SNAPSHOT);
  const mutations: Record<
    (typeof ARTICLE_PUBLICATION_FIELDS)[number],
    ArticlePublicationSnapshotInput[(typeof ARTICLE_PUBLICATION_FIELDS)[number]]
  > = {
    slug: 'bears-complete-second-major-trade',
    title: 'Bears complete a different major trade',
    dek: 'A different move reshapes the depth chart.',
    body: '## What happened\n\nThe Bears completed a different move.',
    sport: 'NBA',
    hero: 'https://images.unsplash.com/different-trade.jpg',
    heroAlt: 'A different group of players on a football field',
    heroCredit: 'Different BB Sports file credit',
    authorName: 'Bradley Benson',
    aiAssisted: true,
    bradsTake: 'Brad personally reviewed and contextualized this assisted draft.',
  };

  for (const field of ARTICLE_PUBLICATION_FIELDS) {
    const changed = {
      ...BASE_SNAPSHOT,
      [field]: mutations[field],
      ...(field === 'aiAssisted'
        ? { bradsTake: 'Brad personally reviewed and contextualized this assisted draft.' }
        : {}),
    } as ArticlePublicationSnapshotInput;
    assert.notEqual(hashArticlePublicationSnapshot(changed), baseline, `${field} must affect hash`);
  }
});

test('hash is independent of object key order and clock time', () => {
  const reversed = Object.fromEntries(
    Object.entries(BASE_SNAPSHOT).reverse(),
  ) as unknown as ArticlePublicationSnapshotInput;
  const originalNow = Date.now;

  try {
    Date.now = () => 0;
    const first = hashArticlePublicationSnapshot(BASE_SNAPSHOT);
    Date.now = () => 4_102_444_800_000;
    const second = hashArticlePublicationSnapshot(reversed);
    assert.equal(second, first);
  } finally {
    Date.now = originalNow;
  }
});

test('canonical Unicode and newline equivalents produce the same hash', () => {
  const composed = {
    ...BASE_SNAPSHOT,
    title: 'Café trade reaction',
    body: 'Résumé\nline two',
  };
  const decomposed = {
    ...BASE_SNAPSHOT,
    title: 'Cafe\u0301 trade reaction',
    body: 'Re\u0301sume\u0301\r\nline two',
  };

  assert.equal(
    hashArticlePublicationSnapshot(composed),
    hashArticlePublicationSnapshot(decomposed),
  );
});

test('publication heroes are restricted to renderable local assets and approved HTTPS hosts', () => {
  for (const hero of [
    '',
    '/images/hero-bears.svg',
    '/brand/bradley/bradley-benson-illustrated-card.jpg',
    '/api/media/assets/11111111-1111-4111-8111-111111111111/file',
    ...ARTICLE_HERO_REMOTE_HOSTS.map((host) => `https://${host}/article/hero.jpg?width=1600`),
  ]) {
    assert.equal(
      normalizeArticlePublicationSnapshot({ ...BASE_SNAPSHOT, hero }).hero,
      hero,
    );
  }

  for (const hero of [
    'not-a-url',
    '//images.unsplash.com/hero.jpg',
    '/images/../private/hero.jpg',
    '/images/%2e%2e/private/hero.jpg',
    '/uploads/hero.jpg',
    '/api/media/assets/not-a-uuid/file',
    '/api/media/assets/11111111-1111-1111-8111-111111111111/file',
    '/api/media/assets/11111111-1111-4111-7111-111111111111/file',
    '/api/media/assets/11111111-1111-4111-8111-111111111111/file/extra',
    '/images/hero.jpg?variant=unsafe',
    'http://images.unsplash.com/hero.jpg',
    'javascript:alert(1)',
    'data:image/svg+xml,<svg/>',
    'https://user:pass@images.unsplash.com/hero.jpg',
    'https://images.unsplash.com:8443/hero.jpg',
    'https://evil.example/hero.jpg',
    'https://images.unsplash.com/hero.jpg#different-resource',
  ]) {
    assert.equal(
      articlePublicationSnapshotSchema.safeParse({ ...BASE_SNAPSHOT, hero }).success,
      false,
      `${hero} must be rejected`,
    );
  }

  assert.equal(
    articleHeroMediaAssetId(
      '/api/media/assets/11111111-1111-4111-8111-111111111111/file',
    ),
    '11111111-1111-4111-8111-111111111111',
  );
  assert.equal(articleHeroMediaAssetId('/api/media/assets/not-a-uuid/file'), null);
});

test('publisher role check fails closed and allows only the exact super-admin role', () => {
  assert.equal(canPublishArticle('super_admin'), true);
  for (const role of [
    'admin',
    'editor',
    'SUPER_ADMIN',
    ' super_admin ',
    '',
    null,
    undefined,
    1,
    { role: 'super_admin' },
  ]) {
    assert.equal(canPublishArticle(role), false);
  }
});

test('publish request binds an exact revision and lowercase hash to Brad confirmation', () => {
  const valid = {
    articleId: '11111111-1111-4111-8111-111111111111',
    expectedRevisionId: '22222222-2222-4222-8222-222222222222',
    expectedContentHash: 'a'.repeat(64),
    confirmation: ARTICLE_PUBLICATION_CONFIRMATION_PHRASE,
    rationale: 'Brad verified every claim and approves this exact revision.',
    checklistAttestation: [
      'source_url',
      'names_spelling',
      'numbers_fresh',
      'quotes_attributed',
      'bias_disclosed',
      'ai_labeled',
    ],
  };

  assert.deepEqual(articlePublishRequestSchema.parse(valid), valid);
  assert.equal(
    articlePublishRequestSchema.safeParse({ ...valid, expectedContentHash: 'A'.repeat(64) }).success,
    false,
  );
  assert.equal(
    articlePublishRequestSchema.safeParse({ ...valid, confirmation: 'publish it' }).success,
    false,
  );
  assert.equal(
    articlePublishRequestSchema.safeParse({ ...valid, rationale: 'Looks good.' }).success,
    false,
  );
  assert.equal(
    articlePublishRequestSchema.safeParse({ ...valid, bypassReview: true }).success,
    false,
  );
});

function verifiedInput(): VerifiedNewsroomDraftInput {
  return {
    event: {
      state: 'verified',
      headline: 'Café Bears & Vikings: Trade agreed!',
      summary: 'The teams confirmed the transaction after league processing.',
      sport: 'NFL',
    },
    activeEvidence: [
      {
        stance: 'supporting',
        label: 'Vikings official transaction notice',
        url: 'https://www.vikings.example/transactions#confirmed',
        evidenceClass: 'official',
        sourceTier: 'official',
        ownerKey: 'vikings',
        credible: true,
      },
      {
        stance: 'supporting',
        label: 'Bears official roster update',
        url: 'https://www.bears.example/roster-update',
        evidenceClass: 'official',
        sourceTier: 'official',
        ownerKey: 'bears',
        credible: true,
      },
    ],
  };
}

test('verified newsroom metadata produces a deterministic non-AI cited draft', () => {
  const input = verifiedInput();
  const draft = createVerifiedNewsroomArticleDraft(input);
  const reverseEvidence = createVerifiedNewsroomArticleDraft({
    ...input,
    activeEvidence: [...input.activeEvidence].reverse(),
  });

  assert.equal(draft.slug, 'cafe-bears-and-vikings-trade-agreed');
  assert.equal(draft.aiAssisted, false);
  assert.equal(draft.bradsTake, '');
  assert.equal(draft.authorName, 'Brad Benson');
  assert.match(
    draft.body,
    /\[Bears official roster update\]\(<https:\/\/www\.bears\.example\/roster-update>\)/,
  );
  assert.match(
    draft.body,
    /\[Vikings official transaction notice\]\(<https:\/\/www\.vikings\.example\/transactions>\)/,
  );
  assert.deepEqual(reverseEvidence, draft);
});

test('verified draft source trail is deterministic and bounded while retaining the ledger count', () => {
  const input = verifiedInput();
  const activeEvidence = Array.from({ length: 500 }, (_, index) => ({
    stance: 'supporting' as const,
    label: `${'*'.repeat(490)} ${String(index).padStart(3, '0')}`,
    url: `https://source-${String(index).padStart(3, '0')}.example/${'a'.repeat(1_900)}`,
    evidenceClass: 'official' as const,
    sourceTier: 'official' as const,
    ownerKey: `source-${index}`,
    credible: true,
  }));

  const draft = createVerifiedNewsroomArticleDraft({ ...input, activeEvidence });
  const reversed = createVerifiedNewsroomArticleDraft({
    ...input,
    activeEvidence: [...activeEvidence].reverse(),
  });
  const linkCount = draft.body.match(/^\- \[/gm)?.length ?? 0;

  assert.equal(linkCount, VERIFIED_DRAFT_SOURCE_LINK_LIMIT);
  assert.match(
    draft.body,
    new RegExp(`shows ${VERIFIED_DRAFT_SOURCE_LINK_LIMIT} of 500 qualifying sources`),
  );
  assert.ok(draft.body.length <= 100_000);
  assert.deepEqual(reversed, draft);
});

test('verified draft source trail deduplicates a normalized URL globally across tiers', () => {
  const input = verifiedInput();
  const duplicateUrl = 'https://z.example/item';
  const draft = createVerifiedNewsroomArticleDraft({
    ...input,
    activeEvidence: [
      {
        stance: 'supporting',
        label: 'Best primary copy',
        url: duplicateUrl,
        evidenceClass: 'primary',
        sourceTier: 'primary',
        ownerKey: 'primary-owner',
        credible: true,
      },
      {
        stance: 'supporting',
        label: 'Independent official source',
        url: 'https://a.example/item',
        evidenceClass: 'official',
        sourceTier: 'official',
        ownerKey: 'official-owner',
        credible: true,
      },
      {
        stance: 'supporting',
        label: 'Lower-tier duplicate copy',
        url: duplicateUrl,
        evidenceClass: 'official',
        sourceTier: 'official',
        ownerKey: 'duplicate-owner',
        credible: true,
      },
    ],
  });

  assert.equal(draft.body.match(/^\- \[/gm)?.length, 2);
  assert.equal(draft.body.match(/https:\/\/z\.example\/item/g)?.length, 1);
  assert.match(draft.body, /Best primary copy/);
  assert.doesNotMatch(draft.body, /Lower-tier duplicate copy/);
});

test('verified draft source trail bounds percent-expanded Unicode URLs after serialization', () => {
  const input = verifiedInput();
  const expandedUrl = `https://unicode.example/${'😀'.repeat(1_000)}`;
  assert.ok(expandedUrl.length <= 2_048, 'fixture must pass the input code-unit cap');

  const draft = createVerifiedNewsroomArticleDraft({
    ...input,
    activeEvidence: [
      ...Array.from({ length: 25 }, (_, index) => ({
        stance: 'supporting' as const,
        label: `Expanded Unicode URL ${index}`,
        url: `${expandedUrl}?copy=${index}`,
        evidenceClass: 'official' as const,
        sourceTier: 'official' as const,
        ownerKey: `expanded-${index}`,
        credible: true,
      })),
      {
        stance: 'supporting',
        label: 'Bounded canonical source',
        url: 'https://official.example/short-source',
        evidenceClass: 'official',
        sourceTier: 'official',
        ownerKey: 'bounded-official',
        credible: true,
      },
    ],
  });

  assert.equal(draft.body.match(/^\- \[/gm)?.length, 1);
  assert.match(draft.body, /Bounded canonical source/);
  assert.doesNotMatch(draft.body, /Expanded Unicode URL/);
  assert.ok(draft.body.length <= 100_000);
});

test('newsroom template refuses unverified events and unresolved contradictions', () => {
  const input = verifiedInput();

  assert.throws(
    () => createVerifiedNewsroomArticleDraft({ ...input, event: { ...input.event, state: 'investigating' } }),
    (error) =>
      error instanceof ArticlePublicationInvariantError && error.code === 'EVENT_NOT_VERIFIED',
  );
  assert.throws(
    () =>
      createVerifiedNewsroomArticleDraft({
        ...input,
        activeEvidence: [
          ...input.activeEvidence,
          { stance: 'contradicting', label: 'Conflicting official statement', url: null },
        ],
      }),
    (error) =>
      error instanceof ArticlePublicationInvariantError &&
      error.code === 'UNRESOLVED_CONTRADICTION',
  );
});

test('newsroom template never copies evidence excerpts, notes, or provider bodies', () => {
  const forbiddenExcerpt = 'FORBIDDEN PROVIDER EXCERPT SHOULD NEVER APPEAR';
  const forbiddenBody = 'FORBIDDEN FULL ARTICLE BODY SHOULD NEVER APPEAR';
  const input = verifiedInput();
  const evidenceWithProviderText = input.activeEvidence.map((item) => ({
    ...item,
    excerpt: forbiddenExcerpt,
    notes: 'FORBIDDEN PRIVATE NEWSROOM NOTES SHOULD NEVER APPEAR',
    body: forbiddenBody,
    rawPayload: { article: forbiddenBody },
  }));
  const draft = createVerifiedNewsroomArticleDraft({
    ...input,
    activeEvidence: evidenceWithProviderText,
  });

  assert.doesNotMatch(draft.body, /FORBIDDEN/);
  assert.doesNotMatch(JSON.stringify(draft), /PROVIDER EXCERPT|FULL ARTICLE BODY|PRIVATE NEWSROOM/);
});

test('template requires citable HTTPS support and slug fallback never exposes unsafe input', () => {
  const input = verifiedInput();
  assert.throws(
    () =>
      createVerifiedNewsroomArticleDraft({
        ...input,
        activeEvidence: [{ stance: 'supporting', label: 'Unsafe source', url: 'javascript:alert(1)' }],
      }),
    (error) =>
      error instanceof ArticlePublicationInvariantError && error.code === 'NO_CITABLE_SUPPORT',
  );
  for (const unqualifiedEvidence of [
    {
      stance: 'supporting' as const,
      label: 'Unverified social post',
      url: 'https://social.example/unverified-post',
      sourceTier: 'unverified' as const,
      credible: true,
    },
    {
      stance: 'supporting' as const,
      label: 'Reporter post not yet reviewed',
      url: 'https://reporter.example/unreviewed-post',
      sourceTier: 'tier_1' as const,
      credible: false,
    },
  ]) {
    assert.throws(
      () =>
        createVerifiedNewsroomArticleDraft({
          ...input,
          activeEvidence: [unqualifiedEvidence],
        }),
      (error) =>
        error instanceof ArticlePublicationInvariantError && error.code === 'NO_CITABLE_SUPPORT',
    );
  }

  assert.match(slugifyArticleTitle('<script>alert(1)</script>'), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(slugifyArticleTitle('\u5317\u4eac\u30cb\u30e5\u30fc\u30b9'), /^story-[a-f0-9]{12}$/);
  assert.ok(slugifyArticleTitle('x'.repeat(1_000)).length <= 200);
});
