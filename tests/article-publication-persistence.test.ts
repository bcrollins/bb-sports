import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  hashArticlePublicationSnapshot,
  normalizeArticlePublicationSnapshot,
} from '../lib/article-publication';
import {
  materializePublishedArticle,
  PublicationError,
} from '../lib/article-publication-queries';
import { completeLegacyPublicationMetadata } from '../lib/db/bootstrap';
import type { Article, ArticleRevision } from '../lib/db/schema';

const bootstrap = readFileSync(new URL('../lib/db/bootstrap.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8');
const publicationQueries = readFileSync(
  new URL('../lib/article-publication-queries.ts', import.meta.url),
  'utf8',
);
const publicQueries = readFileSync(new URL('../lib/queries.ts', import.meta.url), 'utf8');

function publishedArticle(overrides: Partial<Article> = {}): Article {
  const snapshot = normalizeArticlePublicationSnapshot({
    slug: 'approved-reader-slug',
    title: 'Approved reader title',
    dek: 'Approved reader summary.',
    body: '## Approved copy\n\nThis is the approved body.',
    sport: 'NFL',
    hero: 'https://images.unsplash.com/approved.jpg',
    heroAlt: 'Approved football image description',
    heroCredit: 'BB Sports approved credit',
    authorName: 'Brad Benson',
    aiAssisted: false,
    bradsTake: '',
  });
  return {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'unapproved-working-slug',
    title: 'Unapproved working title',
    dek: 'Unapproved working summary.',
    body: 'Unapproved working body.',
    sport: 'NBA',
    hero: '',
    heroAlt: '',
    heroCredit: '',
    authorId: null,
    authorName: 'Working Editor',
    aiAssisted: false,
    bradsTake: '',
    published: true,
    publishedAt: new Date('2026-07-15T12:00:00.000Z'),
    publishedSnapshot: snapshot,
    publishedContentHash: hashArticlePublicationSnapshot(snapshot),
    publishedRevisionId: '22222222-2222-4222-8222-222222222222',
    createdUnderApprovalGate: true,
    createdAt: new Date('2026-07-15T10:00:00.000Z'),
    updatedAt: new Date('2026-07-15T13:00:00.000Z'),
    ...overrides,
  };
}

function pointedRevision(article: Article): ArticleRevision {
  return {
    id: article.publishedRevisionId!,
    articleId: article.id,
    revisionNumber: 1,
    contentHash: article.publishedContentHash!,
    snapshot: article.publishedSnapshot!,
    createdBy: article.authorId,
    sourceEventId: null,
    createdAt: new Date('2026-07-15T11:00:00.000Z'),
  };
}

const legacyMetadataRow = {
  id: '44444444-4444-4444-8444-444444444444',
  slug: 'legacy-live-story',
  title: 'Legacy live story',
  sport: 'NFL',
  hero: '/images/legacy-live-story.svg',
  heroAlt: '',
  heroCredit: '',
  authorName: 'Brad Benson',
  aiAssisted: false,
  bradsTake: '',
};

test('legacy metadata completion borrows only blank hero attribution from an exact repository match', () => {
  assert.deepEqual(
    completeLegacyPublicationMetadata(legacyMetadataRow, {
      slug: legacyMetadataRow.slug,
      hero: legacyMetadataRow.hero,
      heroAlt: '  Exact repository alt text  ',
      heroCredit: 'BB Sports illustration',
    }),
    {
      heroAlt: 'Exact repository alt text',
      heroCredit: 'BB Sports illustration',
    },
  );

  assert.deepEqual(
    completeLegacyPublicationMetadata(
      { ...legacyMetadataRow, heroAlt: 'Existing live alt text' },
      {
        slug: legacyMetadataRow.slug,
        hero: legacyMetadataRow.hero,
        heroAlt: 'Repository must not replace this value',
        heroCredit: 'BB Sports illustration',
      },
    ),
    { heroCredit: 'BB Sports illustration' },
  );
});

test('legacy metadata completion fails closed on slug, hero, or non-hero gaps without exposing content', () => {
  for (const repositoryMetadata of [
    {
      slug: 'different-slug',
      hero: legacyMetadataRow.hero,
      heroAlt: 'Should not be used',
      heroCredit: 'Should not be used',
    },
    {
      slug: legacyMetadataRow.slug,
      hero: '/images/different-secret-hero.svg',
      heroAlt: 'Should not be used',
      heroCredit: 'Should not be used',
    },
  ]) {
    assert.throws(
      () => completeLegacyPublicationMetadata(legacyMetadataRow, repositoryMetadata),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /fields: heroAlt, heroCredit/);
        assert.doesNotMatch(error.message, /different-secret|Should not be used/);
        return true;
      },
    );
  }

  assert.throws(
    () =>
      completeLegacyPublicationMetadata(
        { ...legacyMetadataRow, title: '' },
        {
          slug: legacyMetadataRow.slug,
          hero: legacyMetadataRow.hero,
          heroAlt: 'Exact repository alt text',
          heroCredit: 'BB Sports illustration',
        },
      ),
    /fields: title/,
  );
});

test('published materialization serves the approved snapshot instead of mutable working copy', () => {
  const row = publishedArticle();
  const publicArticle = materializePublishedArticle(row, pointedRevision(row));

  assert.ok(publicArticle);
  assert.equal(publicArticle.slug, 'approved-reader-slug');
  assert.equal(publicArticle.title, 'Approved reader title');
  assert.equal(publicArticle.body, '## Approved copy\n\nThis is the approved body.');
  assert.equal(publicArticle.sport, 'NFL');
  assert.notEqual(publicArticle.title, row.title);
  assert.equal(publicArticle.publishedContentHash, row.publishedContentHash);
});

test('published materialization fails closed for incomplete, invalid, or hash-mismatched pointers', () => {
  const valid = publishedArticle();
  const revision = pointedRevision(valid);
  assert.equal(materializePublishedArticle({ ...valid, publishedSnapshot: null }, revision), null);
  assert.equal(materializePublishedArticle({ ...valid, publishedRevisionId: null }, revision), null);
  assert.equal(
    materializePublishedArticle(
      { ...valid, publishedContentHash: '0'.repeat(64) },
      revision,
    ),
    null,
  );
  assert.equal(
    materializePublishedArticle({
      ...valid,
      publishedSnapshot: { ...valid.publishedSnapshot!, heroAlt: '' },
    }, revision),
    null,
  );
  assert.equal(materializePublishedArticle({ ...valid, published: false }, revision), null);
  assert.equal(materializePublishedArticle(valid, null), null);
  assert.equal(
    materializePublishedArticle(valid, {
      ...revision,
      articleId: '33333333-3333-4333-8333-333333333333',
    }),
    null,
  );
  const jointlyAlteredSnapshot = normalizeArticlePublicationSnapshot({
    ...valid.publishedSnapshot!,
    title: 'Jointly altered title that was never in the pointed revision',
  });
  assert.equal(
    materializePublishedArticle(
      {
        ...valid,
        publishedSnapshot: jointlyAlteredSnapshot,
        publishedContentHash: hashArticlePublicationSnapshot(jointlyAlteredSnapshot),
      },
      revision,
    ),
    null,
  );
});

test('schema declares immutable revisions, publication events, newsroom links, and live pointers', () => {
  for (const field of [
    "publishedSnapshot: jsonb('published_snapshot')",
    "publishedContentHash: varchar('published_content_hash'",
    "publishedRevisionId: uuid('published_revision_id')",
  ]) {
    assert.ok(schema.includes(field), `missing article publication field: ${field}`);
  }
  for (const table of [
    "'article_revisions'",
    "'article_publication_events'",
    "'news_event_articles'",
  ]) {
    assert.ok(schema.includes(table), `missing publication table: ${table}`);
  }
  assert.match(schema, /idx_article_revisions_article_number/);
  assert.match(schema, /idx_article_revisions_article_hash/);
  assert.match(schema, /idx_article_revisions_article_id_id/);
  assert.match(schema, /idx_article_revisions_article_id_id_hash/);
  assert.match(schema, /idx_article_publication_events_legacy_once/);
  assert.match(schema, /idx_news_event_articles_event_relation/);
  assert.match(schema, /type ArticleRevision =/);
  assert.match(schema, /type ArticlePublicationEvent =/);
  assert.match(schema, /type NewsEventArticle =/);

  const publicationStart = schema.indexOf('// ---------- immutable article publication ----------');
  assert.ok(publicationStart >= 0, 'immutable publication schema boundary must remain explicit');
  const publicationSchema = schema.slice(publicationStart);
  // Publication ledgers (10) + sports encyclopedia FKs declared after them (2).
  assert.equal(
    publicationSchema.match(/onDelete: 'restrict'/g)?.length,
    12,
    'every immutable publication foreign key must preserve its audit parent',
  );
  assert.doesNotMatch(publicationSchema, /onDelete: '(?:cascade|set null)'/);
});

test('bootstrap DDL is idempotent, append-only, and backfills legacy live content exactly once', () => {
  assert.match(
    schema,
    /articleId: uuid\('article_id'\)\.notNull\(\)\.references\(\(\) => articles\.id, \{ onDelete: 'cascade' \}\)/,
  );
  assert.match(
    bootstrap,
    /CREATE TABLE IF NOT EXISTS comments[\s\S]*?article_id uuid NOT NULL REFERENCES articles\(id\) ON DELETE CASCADE/,
  );
  for (const table of [
    'article_revisions',
    'article_publication_events',
    'news_event_articles',
  ]) {
    assert.match(bootstrap, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  for (const trigger of [
    'article_revisions_append_only',
    'article_publication_events_append_only',
    'news_event_articles_append_only',
  ]) {
    assert.match(bootstrap, new RegExp(`CREATE TRIGGER ${trigger}\\b`));
  }
  assert.match(bootstrap, /bbsports_reject_publication_ledger_mutation/);
  assert.match(bootstrap, /backfillPublishedArticleSnapshots\(\)/);
  const seedStart = bootstrap.indexOf('// 4. Draft import');
  const backfillStart = bootstrap.indexOf('// 5. Preserve every legacy live story');
  assert.ok(seedStart >= 0 && backfillStart > seedStart, 'fresh import must remain a bounded draft step');
  const seed = bootstrap.slice(seedStart, backfillStart);
  assert.match(seed, /Repository content is an import candidate, not publication/);
  assert.match(seed, /published: false/);
  assert.match(seed, /publishedAt: null/);
  assert.doesNotMatch(seed, /published: true/);
  assert.match(bootstrap, /normalizeArticlePublicationSnapshot\(/);
  assert.match(bootstrap, /hashArticlePublicationSnapshot\(snapshot\)/);
  assert.match(bootstrap, /action: 'legacy_backfill'/);
  assert.match(bootstrap, /\.onConflictDoNothing\(\)/);
  assert.match(bootstrap, /idx_article_publication_events_legacy_once/);
  assert.match(bootstrap, /articles_published_snapshot_complete/);
  assert.match(bootstrap, /DROP CONSTRAINT IF EXISTS articles_published_snapshot_complete/);
  assert.match(bootstrap, /pg_get_constraintdef\(oid\)/);
  assert.match(bootstrap, /published = false[\s\S]*published_at IS NULL/);
  assert.match(bootstrap, /published_snapshot IS NULL/);
  assert.match(bootstrap, /published_content_hash IS NULL/);
  assert.match(bootstrap, /published_revision_id IS NULL/);
  assert.match(bootstrap, /published = true[\s\S]*published_at IS NOT NULL/);
  assert.match(bootstrap, /published_snapshot IS NOT NULL/);
  assert.match(bootstrap, /published_content_hash IS NOT NULL/);
  assert.match(bootstrap, /published_revision_id IS NOT NULL/);
  assert.match(bootstrap, /articles_published_revision_same_article/);
  assert.match(
    bootstrap,
    /FOREIGN KEY \(id, published_revision_id, published_content_hash\)/,
  );
  assert.match(
    bootstrap,
    /REFERENCES article_revisions\(article_id, id, content_hash\)[\s\S]*ON DELETE RESTRICT/,
  );
  assert.match(bootstrap, /VALIDATE CONSTRAINT articles_published_revision_same_article/);
  assert.match(bootstrap, /article_publication_events_revision_integrity/);
  assert.match(bootstrap, /FOREIGN KEY \(article_id, revision_id, content_hash\)/);
  assert.match(bootstrap, /news_event_articles_revision_integrity/);
  assert.match(bootstrap, /FOR UPDATE/);

  const publicationDdlStart = bootstrap.indexOf('CREATE TABLE IF NOT EXISTS article_revisions');
  const fkMigrationStart = bootstrap.indexOf('// CREATE TABLE IF NOT EXISTS does not repair');
  assert.ok(
    publicationDdlStart >= 0 && fkMigrationStart > publicationDdlStart,
    'publication DDL and upgrade migration must remain ordered',
  );
  const publicationDdl = bootstrap.slice(publicationDdlStart, fkMigrationStart);
  assert.equal(publicationDdl.match(/ON DELETE RESTRICT/g)?.length, 10);
  assert.doesNotMatch(publicationDdl, /ON DELETE (?:CASCADE|SET NULL)/);
  for (const constraint of [
    'article_revisions_article_id_fkey',
    'article_revisions_created_by_fkey',
    'article_revisions_source_event_id_fkey',
    'article_publication_events_article_id_fkey',
    'article_publication_events_revision_id_fkey',
    'article_publication_events_actor_user_id_fkey',
    'news_event_articles_event_id_fkey',
    'news_event_articles_article_id_fkey',
    'news_event_articles_revision_id_fkey',
    'news_event_articles_actor_user_id_fkey',
  ]) {
    assert.match(bootstrap, new RegExp(`'${constraint}'`));
  }
  assert.match(bootstrap, /confdeltype = 'r'/);
  assert.match(bootstrap, /ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I/);
  assert.match(bootstrap, /ALTER TABLE %I ADD CONSTRAINT %I %s NOT VALID/);
  assert.match(bootstrap, /ALTER TABLE %I VALIDATE CONSTRAINT %I/);
});

test('rolling deploy installs the full publication-state guard before any backfill', () => {
  const addColumns = bootstrap.indexOf(
    'ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_revision_id uuid',
  );
  const stateConstraint = bootstrap.indexOf(
    'ADD CONSTRAINT articles_published_snapshot_complete CHECK',
  );
  const siteConfig = bootstrap.indexOf('CREATE TABLE IF NOT EXISTS site_config');
  const backfill = bootstrap.indexOf('await backfillPublishedArticleSnapshots()');
  const cleanup = bootstrap.indexOf('UPDATE articles\n    SET published_at = NULL');
  const validation = bootstrap.indexOf(
    'VALIDATE CONSTRAINT articles_published_snapshot_complete',
  );
  assert.ok(addColumns >= 0 && stateConstraint > addColumns);
  assert.ok(stateConstraint < siteConfig, 'state guard must precede the rest of bootstrap');
  assert.ok(stateConstraint < backfill, 'state guard must precede legacy snapshot backfill');
  assert.ok(cleanup > backfill && validation > cleanup);
  assert.match(
    bootstrap.slice(stateConstraint, siteConfig),
    /published = false[\s\S]*published_at IS NULL[\s\S]*published_snapshot IS NULL[\s\S]*published_content_hash IS NULL[\s\S]*published_revision_id IS NULL[\s\S]*published = true[\s\S]*published_at IS NOT NULL[\s\S]*published_snapshot IS NOT NULL[\s\S]*published_content_hash IS NOT NULL[\s\S]*published_revision_id IS NOT NULL[\s\S]*NOT VALID/,
  );
  assert.match(bootstrap, /bbsports:articles-published-snapshot-complete:v2/);
  assert.match(bootstrap, /obj_description\(oid, 'pg_constraint'\)/);
  assert.match(bootstrap, /db\.transaction\(async \(migration\)/);
  assert.match(bootstrap, /LOCK TABLE articles IN ACCESS EXCLUSIVE MODE/);
  assert.match(bootstrap, /LOCK TABLE media_assets IN ACCESS EXCLUSIVE MODE/);
  const atomicStart = bootstrap.indexOf('db.transaction(async (migration)');
  const atomicEnd = bootstrap.indexOf('CREATE TABLE IF NOT EXISTS site_config', atomicStart);
  const atomicInstall = bootstrap.slice(atomicStart, atomicEnd);
  for (const guard of [
    'articles_published_snapshot_complete',
    'articles_published_working_copy_edit_guard',
    'articles_guarded_delete',
    'articles_publication_transition_guard',
    'media_assets_live_article_ready_guard',
  ]) {
    assert.match(atomicInstall, new RegExp(guard));
  }
});

test('legacy hero metadata compatibility is exact-match, pointerless-only, and atomic with pointer install', () => {
  assert.match(bootstrap, /metadataByExactSlug\.set\(data\.slug/);
  assert.match(bootstrap, /repositoryMetadata\?\.slug === workingCopy\.slug/);
  assert.match(bootstrap, /repositoryMetadata\.hero === workingCopy\.hero/);
  assert.match(bootstrap, /missing\.includes\('heroAlt'\)/);
  assert.match(bootstrap, /missing\.includes\('heroCredit'\)/);
  assert.match(bootstrap, /Existing nonblank[\s\S]*never replaced/);
  assert.match(bootstrap, /\[invalid-id\]/);
  assert.match(bootstrap, /\[invalid-slug\]/);

  const triggerStart = bootstrap.indexOf(
    'CREATE OR REPLACE FUNCTION bbsports_enforce_article_mutation_contracts',
  );
  const triggerEnd = bootstrap.indexOf('DO $block$', triggerStart);
  assert.ok(triggerStart >= 0 && triggerEnd > triggerStart);
  const trigger = bootstrap.slice(triggerStart, triggerEnd);
  assert.match(trigger, /bbsports\.article_legacy_metadata_backfill_contract/);
  assert.match(trigger, /OLD\.published_snapshot IS NOT NULL/);
  assert.match(trigger, /OLD\.published_content_hash IS NOT NULL/);
  assert.match(trigger, /OLD\.published_revision_id IS NOT NULL/);
  assert.match(trigger, /NEW\.published_snapshot IS NULL/);
  assert.match(trigger, /NEW\.published_content_hash IS NULL/);
  assert.match(trigger, /NEW\.published_revision_id IS NULL/);
  assert.match(trigger, /length\(trim\(OLD\.hero_alt\)\) = 0/);
  assert.match(trigger, /length\(trim\(OLD\.hero_credit\)\) = 0/);
  assert.match(trigger, /article_revisions[\s\S]*snapshot = NEW\.published_snapshot/);
  assert.match(trigger, /article_publication_events[\s\S]*action = 'legacy_backfill'/);
  assert.match(trigger, /articles_legacy_metadata_backfill_contract/);

  const backfillStart = bootstrap.indexOf('async function backfillPublishedArticleSnapshots');
  assert.ok(backfillStart >= 0);
  const backfill = bootstrap.slice(backfillStart);
  const eventInsert = backfill.indexOf('.insert(articlePublicationEvents)');
  const capability = backfill.indexOf(
    "set_config('bbsports.article_legacy_metadata_backfill_contract', 'v1', true)",
  );
  const finalUpdate = backfill.indexOf('.update(articles)', capability);
  assert.ok(eventInsert >= 0 && capability > eventInsert && finalUpdate > capability);
  const update = backfill.slice(finalUpdate, backfill.indexOf('.returning(', finalUpdate));
  assert.match(update, /\.\.\.metadataPatch/);
  assert.match(update, /publishedSnapshot: snapshot/);
  assert.match(update, /publishedContentHash: contentHash/);
  assert.match(update, /publishedRevisionId: revision\.id/);
  assert.match(backfill, /length\(trim\(\$\{articles\.heroAlt\}\)\) = 0/);
  assert.match(backfill, /length\(trim\(\$\{articles\.heroCredit\}\)\) = 0/);
  assert.match(backfill, /const \[preserved\] = await tx[\s\S]*normalizeArticlePublicationSnapshot/);
});

test('publication status refuses to present corrupt live materialization as healthy', () => {
  const statusStart = publicationQueries.indexOf('export async function getArticlePublicationStatus');
  const publishStart = publicationQueries.indexOf('export async function publishArticleRevision');
  assert.ok(statusStart >= 0 && publishStart > statusStart);
  const statusQuery = publicationQueries.slice(statusStart, publishStart);
  assert.match(statusQuery, /materializePublishedArticle\(article, publishedRevision\)/);
  assert.match(statusQuery, /article\.published/);
  assert.match(statusQuery, /new PublicationError\([\s\S]*'CONFLICT',[\s\S]*409/);
  assert.match(statusQuery, /live article pointer failed its immutable content-integrity check/);
});

test('publication transaction rechecks current role, exact revision/hash/content, and fresh evidence', () => {
  assert.match(publicationQueries, /SELECT id FROM users WHERE id = \$\{actor\.userId\} FOR SHARE/);
  assert.match(publicationQueries, /canPublishArticle\(current\.role\)/);
  assert.match(publicationQueries, /superAdmin: true/);
  assert.match(publicationQueries, /SELECT id FROM articles WHERE id = \$\{articleId\} FOR UPDATE/);
  assert.match(publicationQueries, /revision\.contentHash !== request\.expectedContentHash/);
  assert.match(publicationQueries, /editableHash !== request\.expectedContentHash/);
  assert.match(publicationQueries, /JSON\.stringify\(editableSnapshot\)/);
  assert.doesNotMatch(publicationQueries, /eq\(articles\.updatedAt, article\.updatedAt\)/);
  assert.match(publicationQueries, /assertLinkedEventsRemainVerified\(tx, article\.id\)/);
  assert.match(publicationQueries, /SELECT id FROM news_events WHERE id = \$\{eventId\} FOR UPDATE/);
  assert.match(publicationQueries, /assessNewsVerification\(/);
  assert.match(publicationQueries, /assertActiveEvidenceSourcesApproved\(/);
  assert.match(publicationQueries, /source\.commercialStatus === 'approved'/);
  assert.match(publicationQueries, /source\.enabled/);
  assert.match(publicationQueries, /\.for\('share'\)/);
  assert.match(publicationQueries, /provider is missing, disabled, or no longer commercially approved/);
  assert.match(publicationQueries, /item\.sourceId === null/);
  assert.match(publicationQueries, /Credible supporting evidence must be linked/);
  assert.match(publicationQueries, /Fresh contradictory evidence blocks publication/);
  assert.match(publicationQueries, /ARTICLE_PUBLICATION_CONFIRMATION_PHRASE/);
  assert.match(
    publicationQueries,
    /set_config\('bbsports\.article_publication_contract', 'v1', true\)/,
  );
});

test('verified event drafting is deterministic, idempotent, and never auto-publishes', () => {
  const start = publicationQueries.indexOf('export async function createVerifiedEventArticleDraft');
  assert.ok(start >= 0);
  const draftFunction = publicationQueries.slice(start);
  assert.match(draftFunction, /event\.state !== 'verified'/);
  assert.match(draftFunction, /activeEvidence\(evidence\)\.map/);
  assert.match(draftFunction, /createVerifiedNewsroomArticleDraft\(/);
  assert.match(draftFunction, /deterministicEventSlug\(/);
  assert.match(draftFunction, /\.onConflictDoNothing\(\{ target: articles\.slug \}\)/);
  assert.match(draftFunction, /eq\(newsEventArticles\.eventId, event\.id\)/);
  assert.match(draftFunction, /createdUnderApprovalGate: true/);
  assert.match(draftFunction, /published: false/);
  assert.doesNotMatch(draftFunction, /published: true/);
  assert.match(draftFunction, /action: 'article\.draft_created'/);
});

test('public article, related, adjacent, and comment lookup paths use immutable snapshots', () => {
  const publicArticleStart = publicQueries.indexOf('export async function getPublishedArticles');
  const configStart = publicQueries.indexOf('// ---------- site_config ----------');
  const publicArticleQueries = publicQueries.slice(publicArticleStart, configStart);
  assert.match(publicArticleQueries, /materializePublishedArticle/);
  assert.match(publicArticleQueries, /innerJoin\(/);
  assert.match(publicArticleQueries, /articleRevisions\.contentHash/);
  assert.match(publicArticleQueries, /publishedSnapshot}->>'slug'/);
  assert.match(publicArticleQueries, /One MVCC statement/);
  assert.doesNotMatch(publicArticleQueries, /\.limit\(500\)|\.offset\(/);

  const adjacentStart = publicQueries.indexOf('export async function adjacentArticles');
  const audienceStart = publicQueries.indexOf('// ---------- audience / intake ledgers ----------');
  const recommendationQueries = publicQueries.slice(adjacentStart, audienceStart);
  assert.match(recommendationQueries, /materializePublishedArticle/);
  assert.match(recommendationQueries, /publishedSnapshot}->>'sport'/);

  const commentLookupStart = publicQueries.indexOf('async function getPublishedArticleIdBySlug');
  const commentCreateStart = publicQueries.indexOf('export async function createCommentForArticleSlug');
  const commentLookup = publicQueries.slice(commentLookupStart, commentCreateStart);
  assert.match(commentLookup, /publishedSnapshot}->>'slug'/);
  assert.match(commentLookup, /materializePublishedArticle/);
});

test('legacy mutations cannot bypass approval and deletion is locked draft-only', () => {
  const createStart = publicQueries.indexOf('export async function createArticle');
  const adjacentStart = publicQueries.indexOf('export async function adjacentArticles');
  const mutations = publicQueries.slice(createStart, adjacentStart);
  assert.match(mutations, /input\.published === true/);
  assert.match(mutations, /Object\.hasOwn\(patch, 'published'\)/);
  assert.match(mutations, /Publishing and unpublishing require Brad/);

  const deleteStart = publicationQueries.indexOf('export async function deleteVirginArticleDraft');
  const verifiedDraftStart = publicationQueries.indexOf(
    'export async function createVerifiedEventArticleDraft',
    deleteStart,
  );
  assert.ok(deleteStart >= 0 && verifiedDraftStart > deleteStart);
  const deletion = publicationQueries.slice(deleteStart, verifiedDraftStart);
  assert.match(deletion, /requireCurrentActor\(tx, actorInput, \{ superAdmin: true \}\)/);
  assert.match(deletion, /lockArticle\(tx, articleId\)/);
  assert.match(deletion, /current\.published/);
  assert.match(deletion, /current\.publishedAt/);
  assert.match(deletion, /current\.publishedRevisionId/);
  assert.match(deletion, /articleRevisions\.articleId/);
  assert.match(deletion, /articlePublicationEvents\.articleId/);
  assert.match(deletion, /newsEventArticles\.articleId/);
  assert.match(deletion, /audit-preserved article draft/);
  assert.match(deletion, /isNull\(articles\.publishedAt\)/);
  assert.match(deletion, /isNull\(articles\.publishedRevisionId\)/);
});

test('PublicationError carries stable API status and code', () => {
  const error = new PublicationError('CONFLICT', 409, 'Refresh the article.');
  assert.equal(error.name, 'PublicationError');
  assert.equal(error.code, 'CONFLICT');
  assert.equal(error.status, 409);
  assert.equal(error.message, 'Refresh the article.');
});
