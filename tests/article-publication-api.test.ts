import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  ARTICLE_PUBLICATION_CONFIRMATION_PHRASE,
  articleRevisionPrepareRequestSchema,
  articlePublishRequestSchema,
  hashArticleEditableState,
} from '../lib/article-publication';
import {
  isArticleSlugUniqueViolation,
  isPostgresConstraintViolation,
} from '../lib/article-publication-queries';
import {
  ARTICLE_MAX_JSON_BODY_BYTES,
  articlePayloadSchema,
  articleUnpublishRequestSchema,
} from '../lib/article-validation';
import {
  BoundedJsonError,
  DEFAULT_MAX_JSON_BODY_BYTES,
  readBoundedJson,
} from '../lib/bounded-json';

const ROOT = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function handlerSource(relativePath: string, method: string): string {
  const contents = source(relativePath);
  const marker = `export async function ${method}`;
  const start = contents.indexOf(marker);
  assert.notEqual(start, -1, `${relativePath} must export ${method}`);
  const next = contents.indexOf('export async function ', start + marker.length);
  return contents.slice(start, next === -1 ? undefined : next);
}

test('every article handler authenticates before params, bodies, or protected queries', () => {
  const contracts = [
    ['app/api/admin/articles/route.ts', 'GET', /getAllArticles\s*\(/],
    ['app/api/admin/articles/route.ts', 'POST', /readBoundedJson\s*\(/],
    ['app/api/admin/articles/[id]/route.ts', 'GET', /await\s+params/],
    ['app/api/admin/articles/[id]/route.ts', 'PUT', /await\s+params/],
    ['app/api/admin/articles/[id]/route.ts', 'DELETE', /deleteVirginArticleDraft\s*\(/],
    ['app/api/admin/articles/[id]/revision/route.ts', 'GET', /await\s+params/],
    ['app/api/admin/articles/[id]/revision/route.ts', 'POST', /await\s+params/],
    ['app/api/admin/articles/[id]/publish/route.ts', 'POST', /await\s+params/],
    ['app/api/admin/articles/[id]/publish/route.ts', 'DELETE', /await\s+params/],
  ] as const;

  for (const [file, method, sensitivePattern] of contracts) {
    const handler = handlerSource(file, method);
    const authAt = handler.search(/getCurrentUser\s*\(/);
    const rejectionAt = handler.search(/\bUnauthorized\b/);
    const sensitiveAt = handler.search(sensitivePattern);
    const label = `${method} ${file}`;

    assert.notEqual(authAt, -1, `${label} must use active DB-backed authentication`);
    assert.notEqual(rejectionAt, -1, `${label} must reject an absent or revoked session`);
    assert.notEqual(sensitiveAt, -1, `${label} sensitive-operation assertion is stale`);
    assert.ok(authAt < sensitiveAt, `${label} must authenticate before protected work`);
    assert.ok(rejectionAt < sensitiveAt, `${label} must reject before protected work`);
  }
});

test('publish and unpublish check the exact super-admin role before reading a body', () => {
  const file = 'app/api/admin/articles/[id]/publish/route.ts';
  for (const method of ['POST', 'DELETE']) {
    const handler = handlerSource(file, method);
    const authAt = handler.search(/getCurrentUser\s*\(/);
    const roleAt = handler.search(/canPublishArticle\s*\(\s*user\.role\s*\)/);
    const forbiddenAt = handler.search(/\bFORBIDDEN\b/);
    const bodyAt = handler.search(/readBoundedJson\s*\(/);

    assert.ok(authAt >= 0 && roleAt > authAt, `${method} must authenticate before role check`);
    assert.ok(forbiddenAt > roleAt, `${method} must return a clear 403`);
    assert.ok(bodyAt > forbiddenAt, `${method} must not read unauthorized request bodies`);
  }
});

test('legacy article endpoints cannot create, publish, or unpublish directly', () => {
  const collection = source('app/api/admin/articles/route.ts');
  const item = source('app/api/admin/articles/[id]/route.ts');
  const queries = source('lib/queries.ts');
  const createStart = queries.indexOf('export async function createArticle');
  const updateStart = queries.indexOf('export async function updateArticle', createStart);
  const updateEnd = queries.indexOf('export async function adjacentArticles', updateStart);
  const createQuery = queries.slice(createStart, updateStart);
  const updateQuery = queries.slice(updateStart, updateEnd);

  assert.match(collection, /body\.published\s*===\s*true/);
  assert.match(collection, /published:\s*false/);
  assert.doesNotMatch(collection, /published:\s*input\.published/);

  assert.match(item, /Object\.hasOwn\(body,\s*['"]published['"]\)/);
  assert.match(item, /PUBLICATION_REQUIRES_APPROVAL/);
  assert.doesNotMatch(item, /patch\.published\s*=/);

  for (const legacy of [collection, item]) {
    assert.doesNotMatch(legacy, /publishArticleRevision|unpublishArticle|createArticleRevision/);
  }

  assert.match(createQuery, /input\.published\s*===\s*true/);
  assert.match(createQuery, /published:\s*false/);
  assert.match(
    updateQuery,
    /(?:Object\.hasOwn\(patch,\s*['"]published['"]\)|['"]published['"]\s+in\s+patch)/,
  );
  assert.doesNotMatch(updateQuery, /willUnpublish|publishedAt\s*=|publishedSnapshot\s*=/);
});

test('privileged DELETE maps the typed virgin-draft conflict without leaking internals', () => {
  const item = source('app/api/admin/articles/[id]/route.ts');
  const deletion = handlerSource('app/api/admin/articles/[id]/route.ts', 'DELETE');
  const queries = source('lib/article-publication-queries.ts');
  const deleteStart = queries.indexOf('export async function deleteVirginArticleDraft');
  const deleteEnd = queries.indexOf('export async function createVerifiedEventArticleDraft', deleteStart);
  const deleteQuery = queries.slice(deleteStart, deleteEnd);

  assert.match(item, /PublicationError/);
  assert.match(item, /error\.code/);
  assert.match(item, /error\.status/);
  assert.match(deletion, /deleteVirginArticleDraft\s*\(/);
  assert.match(deletion, /requestErrorResponse\s*\(\s*error\s*\)/);

  assert.ok(deleteStart >= 0 && deleteEnd > deleteStart);
  assert.match(deleteQuery, /\.transaction\s*\(/);
  const actorAt = deleteQuery.indexOf('requireCurrentActor(');
  const lockAt = deleteQuery.indexOf('lockArticle(');
  assert.ok(actorAt >= 0 && lockAt > actorAt);
  assert.match(deleteQuery, /superAdmin:\s*true/);
  assert.match(deleteQuery, /current\.published/);
  assert.match(deleteQuery, /articleRevisions/);
  assert.match(deleteQuery, /articlePublicationEvents/);
  assert.match(deleteQuery, /newsEventArticles/);
  assert.match(deleteQuery, /PublicationError\s*\(\s*['"]CONFLICT['"]\s*,\s*409/);
  assert.match(deleteQuery, /eq\(articles\.published,\s*false\)/);
  assert.match(
    deleteQuery,
    /set_config\('bbsports\.article_delete_contract', 'v1', true\)/,
  );
  assert.match(deleteQuery, /isNull\(articles\.publishedAt\)/);
  assert.match(deleteQuery, /isNull\(articles\.publishedRevisionId\)/);
});

test('permanent deletion requires exact super-admin authority in API and server UI', () => {
  const deletion = handlerSource('app/api/admin/articles/[id]/route.ts', 'DELETE');
  const authAt = deletion.indexOf('getCurrentUser(');
  const roleAt = deletion.indexOf('canPublishArticle(user.role)');
  const forbiddenAt = deletion.indexOf('FORBIDDEN');
  const paramsAt = deletion.indexOf('await params');
  const deleteAt = deletion.indexOf('deleteVirginArticleDraft(id, publicationActor(user))');
  assert.ok(authAt >= 0 && roleAt > authAt);
  assert.ok(forbiddenAt > roleAt && paramsAt > forbiddenAt && deleteAt > paramsAt);

  const page = source('app/admin/articles/page.tsx');
  const rows = source('app/admin/articles/_components/ArticleRowActions.tsx');
  const pageAuthAt = page.indexOf('requireAdminPage(');
  const roleProjectionAt = page.indexOf('canPublishArticle(user.role)');
  const queryAt = page.indexOf('getAllArticlesForAdmin()');
  assert.ok(pageAuthAt >= 0 && queryAt > pageAuthAt);
  assert.ok(roleProjectionAt > pageAuthAt);
  assert.match(page, /canDelete=\{canDelete\s*&&\s*canDeleteVirginDraft\}/);
  assert.match(page, /canDeleteVirginDraft/);
  assert.match(rows, /canDelete:\s*boolean/);
  assert.match(rows, /!published\s*&&\s*canDelete/);

  const roster = source('lib/queries.ts');
  assert.match(roster, /canDeleteVirginDraft:/);
  assert.match(roster, /article_revisions history_revision/);
  assert.match(roster, /article_publication_events history_event/);
  assert.match(roster, /news_event_articles history_link/);
  assert.match(roster, /!hasHistory/);
});

test('publish approval binds exact path article, revision, hash, phrase, and rationale', () => {
  const valid = {
    articleId: '11111111-1111-4111-8111-111111111111',
    expectedRevisionId: '22222222-2222-4222-8222-222222222222',
    expectedContentHash: 'a'.repeat(64),
    confirmation: ARTICLE_PUBLICATION_CONFIRMATION_PHRASE,
    rationale: 'Brad checked the evidence and approves this exact immutable revision.',
  };
  assert.deepEqual(articlePublishRequestSchema.parse(valid), valid);

  for (const invalid of [
    { ...valid, expectedRevisionId: 'not-a-uuid' },
    { ...valid, expectedContentHash: 'A'.repeat(64) },
    { ...valid, confirmation: 'publish' },
    { ...valid, rationale: 'Too short.' },
    { ...valid, override: true },
  ]) {
    assert.equal(articlePublishRequestSchema.safeParse(invalid).success, false);
  }

  const publishRoute = handlerSource(
    'app/api/admin/articles/[id]/publish/route.ts',
    'POST',
  );
  assert.match(publishRoute, /input\.articleId\s*!==\s*id/);
  assert.match(publishRoute, /ARTICLE_ID_MISMATCH/);
});

test('revision preparation binds the exact draft hash in schema, route, and transaction', () => {
  const valid = { expectedDraftHash: 'a'.repeat(64) };
  assert.deepEqual(articleRevisionPrepareRequestSchema.parse(valid), valid);
  for (const invalid of [
    {},
    { expectedDraftHash: 'A'.repeat(64) },
    { expectedDraftHash: 'a'.repeat(63) },
    { expectedDraftHash: 'a'.repeat(64), force: true },
  ]) {
    assert.equal(articleRevisionPrepareRequestSchema.safeParse(invalid).success, false);
  }

  const route = handlerSource(
    'app/api/admin/articles/[id]/revision/route.ts',
    'POST',
  );
  const authAt = route.indexOf('getCurrentUser(');
  const bodyAt = route.indexOf('readBoundedJson(req)');
  const parseAt = route.indexOf('articleRevisionPrepareRequestSchema.parse');
  const prepareAt = route.indexOf('createArticleRevision(');
  const hashArgumentAt = route.indexOf('input.expectedDraftHash', prepareAt);
  assert.ok(authAt >= 0 && bodyAt > authAt);
  assert.ok(parseAt >= 0 && prepareAt > bodyAt && hashArgumentAt > prepareAt);

  const queries = source('lib/article-publication-queries.ts');
  const start = queries.indexOf('export async function createArticleRevision');
  const end = queries.indexOf('export async function getArticlePublicationStatus', start);
  const prepare = queries.slice(start, end);
  const canonicalHashAt = prepare.indexOf('hashArticlePublicationSnapshot(snapshot)');
  const compareAt = prepare.indexOf('contentHash !== expectedDraftHash');
  const revisionLookupAt = prepare.indexOf('.from(articleRevisions)');
  const revisionInsertAt = prepare.indexOf('.insert(articleRevisions)');
  assert.match(prepare, /articleRevisionPrepareRequestSchema/);
  assert.ok(canonicalHashAt >= 0 && compareAt > canonicalHashAt);
  assert.ok(revisionLookupAt > compareAt && revisionInsertAt > compareAt);
  assert.match(prepare, /PublicationError\(\s*['"]CONFLICT['"]\s*,\s*409/);
});

test('article edits require a quoted If-Match token and compare it under a row lock', () => {
  const editable = {
    slug: 'breaking-roster-move',
    title: 'Breaking roster move',
    dek: 'A confirmed transaction changed the depth chart.',
    body: 'The transaction was confirmed by the club.',
    sport: 'NFL',
    hero: '',
    heroAlt: '',
    heroCredit: '',
    authorName: 'Brad Benson',
    aiAssisted: false,
    bradsTake: '',
  };
  const editToken = hashArticleEditableState(editable);
  assert.match(editToken, /^[a-f0-9]{64}$/);
  assert.notEqual(
    hashArticleEditableState({ ...editable, body: `${editable.body} Updated.` }),
    editToken,
  );

  const item = source('app/api/admin/articles/[id]/route.ts');
  const put = handlerSource('app/api/admin/articles/[id]/route.ts', 'PUT');
  const authAt = put.indexOf('getCurrentUser(');
  const preconditionAt = put.indexOf('ifMatchEditToken(req)');
  const requiredAt = put.indexOf('PRECONDITION_REQUIRED');
  const statusAt = put.indexOf('428', requiredAt);
  const bodyAt = put.indexOf('readBoundedJson(');
  const updateAt = put.indexOf('updateArticle(id, patch, expectedEditToken)');
  assert.match(item, /headers\.get\(['"]if-match['"]\)/);
  assert.match(item, /\^"\(\[a-f0-9\]\{64\}\)"\$/);
  assert.ok(authAt >= 0 && preconditionAt > authAt);
  assert.ok(requiredAt > preconditionAt && statusAt > requiredAt && bodyAt > statusAt);
  assert.ok(updateAt > bodyAt);
  assert.match(item, /function articleDraftHashes[\s\S]*editToken:/);
  assert.match(
    handlerSource('app/api/admin/articles/[id]/route.ts', 'GET'),
    /articleDraftHashes\(article\)/,
  );
  assert.match(handlerSource('app/api/admin/articles/route.ts', 'POST'), /editToken/);

  const queries = source('lib/queries.ts');
  const updateStart = queries.indexOf('export async function updateArticle');
  const updateEnd = queries.indexOf('export async function adjacentArticles', updateStart);
  const update = queries.slice(updateStart, updateEnd);
  const lockAt = update.indexOf('FOR UPDATE');
  const compareAt = update.indexOf('hashArticleEditableState(current) !== expectedEditToken');
  const writeAt = update.indexOf('.update(articles)');
  assert.match(update, /expectedEditToken:\s*string/);
  assert.match(update, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(update, /\.transaction\s*\(/);
  assert.ok(lockAt >= 0 && compareAt > lockAt && writeAt > compareAt);
  assert.match(update, /PublicationError\(\s*['"]CONFLICT['"]\s*,\s*409/);
});

test('article create and edit map wrapped slug uniqueness failures to a documented 409', () => {
  for (const constraintName of ['articles_slug_key', 'articles_slug_unique']) {
    const wrapped = {
      name: 'DrizzleQueryError',
      cause: { code: '23505', constraint_name: constraintName },
    };
    assert.equal(isArticleSlugUniqueViolation(wrapped), true);
  }
  assert.equal(
    isArticleSlugUniqueViolation({
      cause: { code: '23505', constraint_name: 'idx_articles_live_snapshot_slug' },
    }),
    false,
  );

  for (const [file, method] of [
    ['app/api/admin/articles/route.ts', 'POST'],
    ['app/api/admin/articles/[id]/route.ts', 'PUT'],
  ] as const) {
    const handler = handlerSource(file, method);
    assert.match(handler, /isArticleSlugUniqueViolation\(error\)/);
    assert.match(handler, /SLUG_CONFLICT/);
    assert.match(handler, /409/);
  }
});

test('unpublish requires one strict, bounded, meaningful rationale', () => {
  assert.deepEqual(
    articleUnpublishRequestSchema.parse({
      rationale: 'Brad is retracting this article while a material claim is rechecked.',
    }),
    { rationale: 'Brad is retracting this article while a material claim is rechecked.' },
  );
  assert.equal(
    articleUnpublishRequestSchema.safeParse({ rationale: 'Too short.' }).success,
    false,
  );
  assert.equal(
    articleUnpublishRequestSchema.safeParse({ rationale: 'x'.repeat(4_001) }).success,
    false,
  );
  assert.equal(
    articleUnpublishRequestSchema.safeParse({
      rationale: 'This rationale is sufficiently long.',
      bypassApproval: true,
    }).success,
    false,
  );
});

test('bounded JSON reader accepts JSON and rejects unsafe media, syntax, and size', async () => {
  const valid = new Request('https://example.test/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ title: 'Breaking news' }),
  });
  assert.deepEqual(await readBoundedJson(valid), { title: 'Breaking news' });

  const cases: Array<[Request, number, string]> = [
    [
      new Request('https://example.test/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: '{}',
      }),
      415,
      'INVALID_CONTENT_TYPE',
    ],
    [
      new Request('https://example.test/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
      400,
      'INVALID_JSON',
    ],
    [
      new Request('https://example.test/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
      400,
      'JSON_BODY_REQUIRED',
    ],
    [
      new Request('https://example.test/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(DEFAULT_MAX_JSON_BODY_BYTES + 1),
        },
        body: '{}',
      }),
      413,
      'JSON_BODY_TOO_LARGE',
    ],
    [
      new Request('https://example.test/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'x'.repeat(DEFAULT_MAX_JSON_BODY_BYTES) }),
      }),
      413,
      'JSON_BODY_TOO_LARGE',
    ],
  ];

  for (const [request, status, code] of cases) {
    await assert.rejects(
      () => readBoundedJson(request),
      (error: unknown) =>
        error instanceof BoundedJsonError &&
        error.status === status &&
        error.code === code,
    );
  }
});

test('article saves use a bounded envelope that admits every valid 100k-character body', async () => {
  assert.equal(ARTICLE_MAX_JSON_BODY_BYTES, 1024 * 1024);
  assert.ok(ARTICLE_MAX_JSON_BODY_BYTES > DEFAULT_MAX_JSON_BODY_BYTES);

  const overDefaultButValid = new Request('https://example.test/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: 'x'.repeat(DEFAULT_MAX_JSON_BODY_BYTES + 1_024) }),
  });
  const parsed = await readBoundedJson(
    overDefaultButValid,
    ARTICLE_MAX_JSON_BODY_BYTES,
  ) as { body: string };
  assert.equal(parsed.body.length, DEFAULT_MAX_JSON_BODY_BYTES + 1_024);

  const baseArticle = {
    slug: 'encoded-boundary-proof',
    title: 'Encoded boundary proof',
    dek: '',
    sport: 'NFL',
    hero: '',
    heroAlt: '',
    heroCredit: '',
    authorName: 'Brad Benson',
    aiAssisted: false,
    bradsTake: '',
    published: false,
  };
  for (const body of ['界'.repeat(100_000), '\u0001'.repeat(100_000)]) {
    const request = new Request('https://example.test/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseArticle, body }),
    });
    const decoded = await readBoundedJson(request, ARTICLE_MAX_JSON_BODY_BYTES);
    assert.equal(articlePayloadSchema.parse(decoded).body.length, 100_000);
  }

  const oversized = new Request('https://example.test/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: 'x'.repeat(ARTICLE_MAX_JSON_BODY_BYTES) }),
  });
  await assert.rejects(
    () => readBoundedJson(oversized, ARTICLE_MAX_JSON_BODY_BYTES),
    (error: unknown) =>
      error instanceof BoundedJsonError &&
      error.status === 413 &&
      error.code === 'JSON_BODY_TOO_LARGE',
  );

  assert.match(
    handlerSource('app/api/admin/articles/route.ts', 'POST'),
    /readBoundedJson\(req,\s*ARTICLE_MAX_JSON_BODY_BYTES\)/,
  );
  assert.match(
    handlerSource('app/api/admin/articles/[id]/route.ts', 'PUT'),
    /readBoundedJson\(req,\s*ARTICLE_MAX_JSON_BODY_BYTES\)/,
  );
});

test('publish and unpublish invalidate every public article surface after mutation', () => {
  const file = source('app/api/admin/articles/[id]/publish/route.ts');
  const invalidatorStart = file.indexOf('function invalidatePublicationSurfaces');
  const postStart = file.indexOf('export async function POST', invalidatorStart);
  const invalidator = file.slice(invalidatorStart, postStart);

  assert.match(file, /from ['"]next\/cache['"]/);
  for (const path of ['/', '/articles', '/search', '/rss.xml', '/sitemap.xml']) {
    assert.ok(invalidator.includes(`'${path}'`), `missing cache invalidation for ${path}`);
  }
  assert.match(invalidator, /previousSlug[\s\S]*`\/articles\/\$\{previousSlug\}`/);
  assert.match(invalidator, /nextSlug[\s\S]*`\/articles\/\$\{nextSlug\}`/);
  assert.match(invalidator, /revalidatePath\(path\)/);
  assert.match(invalidator, /revalidatePath\(['"]\/rankings['"],\s*['"]layout['"]\)/);

  for (const method of ['POST', 'DELETE']) {
    const handler = handlerSource(
      'app/api/admin/articles/[id]/publish/route.ts',
      method,
    );
    const mutationAt = handler.search(
      method === 'POST' ? /publishArticleRevision\s*\(/ : /unpublishArticle\s*\(/,
    );
    const statusAt = handler.indexOf('getArticlePublicationStatus(id)', mutationAt);
    const invalidateAt = handler.indexOf('invalidatePublicationSurfaces(', mutationAt);
    const responseAt = handler.indexOf('return json({ status })', mutationAt);
    assert.ok(mutationAt >= 0, `${method} mutation contract is stale`);
    assert.ok(statusAt > mutationAt, `${method} must reload committed publication state`);
    assert.ok(invalidateAt > statusAt, `${method} must invalidate only after committed state`);
    assert.ok(responseAt > invalidateAt, `${method} must invalidate before reporting success`);
  }
});

test('a concurrent live-slug winner becomes an actionable 409 instead of a generic 500', () => {
  const queries = source('lib/article-publication-queries.ts');
  const start = queries.indexOf('export async function publishArticleRevision');
  const end = queries.indexOf('export async function unpublishArticle', start);
  const publish = queries.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(publish, /try\s*\{[\s\S]*database\.transaction/);
  assert.match(publish, /catch\s*\(error\)/);
  assert.match(publish, /['"]23505['"]/);
  assert.match(publish, /idx_articles_live_snapshot_slug/);
  assert.match(publish, /PublicationError\(\s*['"]CONFLICT['"]\s*,\s*409/);

  const driverError = {
    code: '23505',
    constraint_name: 'idx_articles_live_snapshot_slug',
  };
  assert.equal(
    isPostgresConstraintViolation(
      driverError,
      '23505',
      'idx_articles_live_snapshot_slug',
    ),
    true,
  );
  assert.equal(
    isPostgresConstraintViolation(
      { name: 'DrizzleQueryError', cause: driverError },
      '23505',
      'idx_articles_live_snapshot_slug',
    ),
    true,
  );
  assert.equal(
    isPostgresConstraintViolation(
      { cause: { cause: driverError } },
      '23505',
      'idx_articles_live_snapshot_slug',
    ),
    true,
  );
  assert.equal(
    isPostgresConstraintViolation(
      { cause: { code: '23505', constraint_name: 'different_index' } },
      '23505',
      'idx_articles_live_snapshot_slug',
    ),
    false,
  );
});

test('routine publication status is bounded and never serializes article history or prose', () => {
  const queries = source('lib/article-publication-queries.ts');
  const start = queries.indexOf('export async function getArticlePublicationStatus');
  const end = queries.indexOf('export async function publishArticleRevision', start);
  const status = queries.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(status, /const \[revisions|publicationEvents|sourceLinks/);
  assert.doesNotMatch(status, /\.limit\(100\)|\.limit\(250\)/);
  assert.match(status, /publishedSlug:\s*liveArticle\?\.slug \?\? null/);
  assert.match(status, /publishedRevisionNumber:/);

  const editor = source('app/admin/articles/_components/ArticleEditor.tsx');
  assert.doesNotMatch(editor, /status\.publishedRevision\b/);
  assert.match(editor, /nullableText\(status\.publishedSlug\)/);
});

test('publication API responses are private and unexpected errors are not serialized', () => {
  const files = [
    'app/api/admin/articles/route.ts',
    'app/api/admin/articles/[id]/route.ts',
    'app/api/admin/articles/[id]/revision/route.ts',
    'app/api/admin/articles/[id]/publish/route.ts',
  ];

  for (const file of files) {
    const contents = source(file);
    assert.match(contents, /Cache-Control['"]?:\s*['"]private, no-store['"]/);
    assert.match(contents, /code:\s*['"]INTERNAL['"]/);
    assert.doesNotMatch(
      contents,
      /err\s+instanceof\s+Error\s*\?\s*err\.message|String\s*\(\s*err(?:or)?\s*\)/,
      `${file} must not serialize arbitrary database or runtime errors`,
    );
  }
});
