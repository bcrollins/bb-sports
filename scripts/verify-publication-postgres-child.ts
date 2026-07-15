/**
 * Internal child for verify-publication-postgres.ts.
 *
 * Do not invoke this bundle directly. The parent supplies a capability token
 * and a database URL whose database name matches the disposable-only prefix.
 * All imports below are the real application persistence and publication
 * modules; no mocked repository or alternate schema is used.
 */
import { eq, sql } from 'drizzle-orm';
import {
  ARTICLE_PUBLICATION_CONFIRMATION_PHRASE,
  hashArticleEditableState,
  hashArticlePublicationSnapshot,
} from '../lib/article-publication';
import {
  createArticleRevision,
  deleteVirginArticleDraft,
  getArticlePublicationStatus,
  PublicationError,
  publishArticleRevision,
  unpublishArticle,
  type ArticlePublicationActor,
} from '../lib/article-publication-queries';
import { ensureBootstrapped } from '../lib/db/bootstrap';
import { closeDatabaseClient, db } from '../lib/db/client';
import {
  articlePublicationEvents,
  articleRevisions,
  articles,
  newsEventArticles,
  newsEvents,
  newsSources,
  publicationRuntimeControls,
  users,
} from '../lib/db/schema';
import {
  createArticle,
  getArticleById,
  getPublishedArticleBySlug,
  updateArticle,
} from '../lib/queries';

const PUBLICATION_VERIFY_DATABASE_PREFIX = 'bbs_pub_verify_';
const CHILD_PHASE_ENV = 'BBS_PUBLICATION_VERIFY_PHASE';
const CHILD_TOKEN_ENV = 'BBS_PUBLICATION_VERIFY_TOKEN';
const CHILD_DATABASE_ENV = 'BBS_PUBLICATION_VERIFY_DATABASE';

type ChildPhase = 'bootstrap' | 'verify';
type PostgresErrorShape = {
  code?: unknown;
  constraint?: unknown;
  constraint_name?: unknown;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown child verification failure.';
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

function currentDatabaseName(): string {
  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, 'Verifier child requires DATABASE_URL.');
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  assert(
    databaseName.startsWith(PUBLICATION_VERIFY_DATABASE_PREFIX) &&
      databaseName.length <= 63 &&
      /^[a-z0-9_]+$/.test(databaseName),
    'Verifier child refused a non-disposable database name.',
  );
  assert(
    databaseName === process.env[CHILD_DATABASE_ENV],
    'Verifier child database does not match its parent capability.',
  );
  return databaseName;
}

function requireParentCapability(): ChildPhase {
  const phase = process.env[CHILD_PHASE_ENV];
  assert(phase === 'bootstrap' || phase === 'verify', 'Verifier child phase is invalid.');
  assert(
    /^[a-f0-9]{64}$/.test(process.env[CHILD_TOKEN_ENV] ?? ''),
    'Verifier child capability is missing or invalid.',
  );
  currentDatabaseName();
  return phase;
}

function postgresError(error: unknown): PostgresErrorShape {
  let current = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current !== 'object' || current === null) return {};
    const record = current as PostgresErrorShape & { cause?: unknown };
    if (typeof record.code === 'string') return record;
    current = record.cause;
  }
  return {};
}

async function expectPostgresRejection(
  label: string,
  expectedCode: string,
  operation: () => Promise<unknown>,
  expectedConstraint?: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const record = postgresError(error);
    assert(record.code === expectedCode, `${label} returned SQLSTATE ${String(record.code)}.`);
    if (expectedConstraint) {
      const constraint = record.constraint_name ?? record.constraint;
      assert(
        constraint === expectedConstraint,
        `${label} returned constraint ${String(constraint)}.`,
      );
    }
    console.info(`[publication-db-verify] PASS ${label}`);
    return;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
}

async function expectPublicationRejection(
  label: string,
  expectedCode: PublicationError['code'],
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof PublicationError, `${label} did not return PublicationError.`);
    assert(error.code === expectedCode, `${label} returned ${error.code}.`);
    console.info(`[publication-db-verify] PASS ${label}`);
    return;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
}

async function assertBootstrapContracts(): Promise<void> {
  assert(db, 'Application database client was not initialized.');
  const sourceRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(newsSources)
    .where(eq(newsSources.sourceKey, 'manual-newsroom'));
  assert(sourceRows[0]?.count === 1, 'Idempotent bootstrap duplicated its manual source.');

  const constraintResult = await db.execute(sql`
    SELECT conname, confdeltype::text AS delete_action, convalidated
    FROM pg_constraint
    WHERE conname IN (
      'article_revisions_article_id_fkey',
      'articles_published_revision_same_article',
      'articles_published_snapshot_complete'
    )
    ORDER BY conname
  `);
  const constraints = constraintResult as unknown as Array<{
    conname: string;
    delete_action: string;
    convalidated: boolean;
  }>;
  assert(constraints.length === 3, 'Required publication constraints are missing.');
  for (const constraint of constraints) {
    assert(constraint.convalidated, `${constraint.conname} is not validated.`);
  }
  for (const name of [
    'article_revisions_article_id_fkey',
    'articles_published_revision_same_article',
  ]) {
    assert(
      constraints.some(
        (constraint) => constraint.conname === name && constraint.delete_action === 'r',
      ),
      `${name} is not ON DELETE RESTRICT.`,
    );
  }
  console.info('[publication-db-verify] PASS second real bootstrap is idempotent');
}

async function runPublicationVerification(): Promise<void> {
  const database = db;
  assert(database, 'Application database client was not initialized.');
  await assertBootstrapContracts();

  const legacyBackfills = await database
    .select({
      articleId: articles.id,
      slug: articles.slug,
      title: articles.title,
      dek: articles.dek,
      body: articles.body,
      sport: articles.sport,
      hero: articles.hero,
      heroAlt: articles.heroAlt,
      heroCredit: articles.heroCredit,
      authorName: articles.authorName,
      aiAssisted: articles.aiAssisted,
      bradsTake: articles.bradsTake,
      published: articles.published,
      publishedAt: articles.publishedAt,
      publishedSnapshot: articles.publishedSnapshot,
      publishedContentHash: articles.publishedContentHash,
      publishedRevisionId: articles.publishedRevisionId,
      revisionId: articleRevisions.id,
      revisionArticleId: articleRevisions.articleId,
      revisionContentHash: articleRevisions.contentHash,
      revisionSnapshot: articleRevisions.snapshot,
      eventId: articlePublicationEvents.id,
      eventArticleId: articlePublicationEvents.articleId,
      eventRevisionId: articlePublicationEvents.revisionId,
      eventContentHash: articlePublicationEvents.contentHash,
    })
    .from(articlePublicationEvents)
    .innerJoin(articles, eq(articlePublicationEvents.articleId, articles.id))
    .innerJoin(articleRevisions, eq(articlePublicationEvents.revisionId, articleRevisions.id))
    .where(eq(articlePublicationEvents.action, 'legacy_backfill'));
  assert(legacyBackfills.length === 1, 'Expected exactly one legacy_backfill audit event.');
  const legacy = legacyBackfills[0];
  assert(legacy, 'Legacy backfill verification row is missing.');
  assert(
    /^rolling-legacy-live-[a-f0-9]{12}$/.test(legacy.slug),
    'Legacy backfill did not preserve the exact disposable slug.',
  );
  const expectedLegacySnapshot = {
    slug: legacy.slug,
    title: 'Pointerless legacy live article',
    dek: '',
    body: 'An old replica must not unpublish this row before backfill finishes.',
    sport: 'Op-Ed',
    hero: '/images/publication-verifier-legacy-hero.png',
    heroAlt: 'Disposable exact-match legacy hero',
    heroCredit: 'BB Sports publication verifier',
    authorName: 'Publication Verifier',
    aiAssisted: false,
    bradsTake: '',
  } as const;
  const readerVisibleFields = [
    'slug',
    'title',
    'dek',
    'body',
    'sport',
    'hero',
    'heroAlt',
    'heroCredit',
    'authorName',
    'aiAssisted',
    'bradsTake',
  ] as const;
  assert(
    readerVisibleFields.every((field) => legacy[field] === expectedLegacySnapshot[field]),
    'Legacy backfill changed reader-visible fields beyond hero metadata.',
  );
  assert(legacy.published, 'Legacy backfill unpublished the live article.');
  assert(legacy.publishedAt, 'Legacy backfill removed the original publication time.');
  assert(legacy.publishedSnapshot, 'Legacy backfill did not create an immutable snapshot.');
  assert(
    readerVisibleFields.every(
      (field) => legacy.publishedSnapshot?.[field] === expectedLegacySnapshot[field],
    ),
    'Legacy immutable snapshot does not match the preserved reader-visible fields.',
  );
  assert(
    readerVisibleFields.every(
      (field) => legacy.revisionSnapshot[field] === expectedLegacySnapshot[field],
    ),
    'Legacy immutable revision does not match the preserved reader-visible fields.',
  );
  const expectedLegacyHash = hashArticlePublicationSnapshot(expectedLegacySnapshot);
  assert(
    legacy.publishedRevisionId === legacy.revisionId &&
      legacy.revisionArticleId === legacy.articleId &&
      legacy.eventArticleId === legacy.articleId &&
      legacy.eventRevisionId === legacy.revisionId,
    'Legacy backfill pointers do not identify the immutable same-article revision.',
  );
  assert(
    legacy.publishedContentHash === expectedLegacyHash &&
      legacy.revisionContentHash === expectedLegacyHash &&
      legacy.eventContentHash === expectedLegacyHash,
    'Legacy backfill hash is not bound consistently across article, revision, and event.',
  );
  const publicLegacy = await getPublishedArticleBySlug(legacy.slug);
  assert(
    publicLegacy?.title === expectedLegacySnapshot.title &&
      publicLegacy.body === expectedLegacySnapshot.body &&
      publicLegacy.heroAlt === expectedLegacySnapshot.heroAlt &&
      publicLegacy.heroCredit === expectedLegacySnapshot.heroCredit,
    'Public legacy read did not materialize the completed immutable snapshot.',
  );
  console.info(
    '[publication-db-verify] PASS legacy metadata completion preserves and immutably snapshots the live story',
  );

  const suffix = (process.env[CHILD_TOKEN_ENV] ?? '').slice(0, 12);
  const [superAdmin] = await database
    .insert(users)
    .values({
      email: `publication-verify-${suffix}@example.invalid`,
      passwordHash: 'not-a-login-credential',
      name: 'Publication Verifier',
      role: 'super_admin',
    })
    .returning();
  assert(superAdmin, 'Could not create disposable super administrator.');
  const actor: ArticlePublicationActor = {
    userId: superAdmin.id,
    label: superAdmin.name,
  };

  const slug = `publication-verifier-${suffix}`;
  const originalTitle = 'Disposable publication verification story';
  const article = await createArticle({
    slug,
    title: originalTitle,
    dek: 'A disposable story used only inside an isolated verification database.',
    body: '## Verified workflow\n\nThis row can never enter the configured application database.',
    sport: 'NFL',
    authorId: superAdmin.id,
    authorName: superAdmin.name,
  });
  const initialStatus = await getArticlePublicationStatus(article.id);
  assert(initialStatus.draftHash, 'Draft did not produce a publication hash.');
  const prepared = await createArticleRevision(article.id, actor, initialStatus.draftHash);
  assert(prepared.revision.articleId === article.id, 'Prepared revision belongs to another article.');

  const published = await publishArticleRevision(
    {
      articleId: article.id,
      expectedRevisionId: prepared.revision.id,
      expectedContentHash: prepared.revision.contentHash,
      confirmation: ARTICLE_PUBLICATION_CONFIRMATION_PHRASE,
      rationale: 'Disposable real-Postgres verification of the exact approved revision.',
      checklistAttestation: [
        'source_url',
        'names_spelling',
        'numbers_fresh',
        'quotes_attributed',
        'bias_disclosed',
        'ai_labeled',
      ],
    },
    actor,
  );
  assert(published.article.published, 'Actual publication query did not make the article live.');
  const publicArticle = await getPublishedArticleBySlug(slug);
  assert(publicArticle?.title === originalTitle, 'Public read did not materialize approved content.');
  console.info('[publication-db-verify] PASS prepare and publish exact immutable revision');

  const editedTitle = `${originalTitle} — working-copy edit`;
  const blockedEditable = await getArticleById(article.id);
  assert(blockedEditable, 'Published article disappeared before release-gate verification.');
  const blockedEditToken = hashArticleEditableState(blockedEditable);
  await expectPublicationRejection(
    'published working-copy edit is blocked before activation',
    'RELEASE_CONVERGENCE',
    () => updateArticle(article.id, { title: editedTitle }, blockedEditToken),
  );
  const afterBlockedEdit = await getArticleById(article.id);
  assert(
    afterBlockedEdit?.title === originalTitle,
    'Release-convergence rejection changed the working copy.',
  );

  // The production release command deliberately rejects verifier databases.
  // Exercise the same guarded database transition directly, but only after
  // re-validating the parent-issued disposable-database capability.
  currentDatabaseName();
  const activationTime = new Date();
  await database.transaction(async (transaction) => {
    const [disabledControl] = await transaction
      .select({ enabled: publicationRuntimeControls.enabled })
      .from(publicationRuntimeControls)
      .where(
        eq(
          publicationRuntimeControls.controlKey,
          'published_working_copy_edits_v1',
        ),
      )
      .limit(1)
      .for('update');
    assert(disabledControl, 'Published working-copy control row is missing.');
    assert(!disabledControl.enabled, 'Published working-copy control was not fail-closed by default.');
    await transaction.execute(sql`
      SELECT set_config(
        'bbsports.publication_activation_contract',
        'v1',
        true
      )
    `);
    const [activatedControl] = await transaction
      .update(publicationRuntimeControls)
      .set({
        enabled: true,
        deploymentSha: (process.env[CHILD_TOKEN_ENV] ?? '').slice(0, 40),
        changedAt: activationTime,
        changedBy: 'Disposable publication verifier',
        updatedAt: activationTime,
      })
      .where(
        eq(
          publicationRuntimeControls.controlKey,
          'published_working_copy_edits_v1',
        ),
      )
      .returning({ enabled: publicationRuntimeControls.enabled });
    assert(activatedControl?.enabled, 'Disposable working-copy control activation did not persist.');
  });
  console.info('[publication-db-verify] PASS disposable release activation is guarded and explicit');

  const currentEditable = await getArticleById(article.id);
  assert(currentEditable, 'Published article disappeared before edit-CAS verification.');
  const freshEditToken = hashArticleEditableState(currentEditable);
  const edited = await updateArticle(article.id, { title: editedTitle }, freshEditToken);
  assert(edited?.title === editedTitle, 'Correct edit precondition did not update the draft.');
  await expectPublicationRejection('stale article edit CAS is rejected', 'CONFLICT', () =>
    updateArticle(article.id, { dek: 'This stale write must not win.' }, freshEditToken),
  );
  const publicAfterEdit = await getPublishedArticleBySlug(slug);
  assert(
    publicAfterEdit?.title === originalTitle,
    'Working-copy edit changed the approved public snapshot.',
  );
  const editedStatus = await getArticlePublicationStatus(article.id);
  assert(editedStatus.hasUnpublishedChanges, 'Status did not expose unpublished working changes.');
  console.info('[publication-db-verify] PASS edit-CAS preserves immutable public copy');

  const [event] = await database
    .insert(newsEvents)
    .values({
      headline: 'Disposable verified event for append-only coverage',
      summary: 'Exists only in the disposable database.',
      sport: 'NFL',
      state: 'verified',
      urgency: 'routine',
    })
    .returning();
  assert(event, 'Could not create disposable newsroom event.');
  const [sourceLink] = await database
    .insert(newsEventArticles)
    .values({
      eventId: event.id,
      articleId: article.id,
      revisionId: prepared.revision.id,
      relation: 'source',
      actorUserId: superAdmin.id,
      actorLabel: superAdmin.name,
    })
    .returning();
  assert(sourceLink, 'Could not create disposable newsroom article link.');

  await expectPostgresRejection('article revision UPDATE trigger', '55000', () =>
    database
      .update(articleRevisions)
      .set({ revisionNumber: prepared.revision.revisionNumber + 100 })
      .where(eq(articleRevisions.id, prepared.revision.id)),
  );
  await expectPostgresRejection('publication event DELETE trigger', '55000', () =>
    database
      .delete(articlePublicationEvents)
      .where(eq(articlePublicationEvents.id, published.publicationEvent.id)),
  );
  await expectPostgresRejection('news-event article UPDATE trigger', '55000', () =>
    database
      .update(newsEventArticles)
      .set({ actorLabel: 'Tampered actor' })
      .where(eq(newsEventArticles.id, sourceLink.id)),
  );

  const mismatchedHash = `${prepared.revision.contentHash.startsWith('0') ? '1' : '0'}${prepared.revision.contentHash.slice(1)}`;
  await expectPostgresRejection(
    'publication revision/hash composite FK',
    '23503',
    () =>
      database.insert(articlePublicationEvents).values({
        articleId: article.id,
        revisionId: prepared.revision.id,
        contentHash: mismatchedHash,
        action: 'unpublished',
        actorUserId: superAdmin.id,
        actorLabel: superAdmin.name,
        exactConfirmation: '',
        rationale: 'This deliberately mismatched audit row must be rejected by PostgreSQL.',
      }),
    'article_publication_events_revision_integrity',
  );

  const corruptionDraft = await createArticle({
    slug: `publication-check-${suffix}`,
    title: 'Disposable check-constraint draft',
    body: 'This row exists only to prove corrupt live state is rejected.',
    authorId: superAdmin.id,
    authorName: superAdmin.name,
  });
  await expectPostgresRejection(
    'incomplete live-state CHECK constraint',
    '23514',
    () =>
      database.transaction(async (transaction) => {
        await transaction.execute(sql`
          SELECT set_config('bbsports.article_publication_contract', 'v1', true)
        `);
        return transaction
          .update(articles)
          .set({ published: true, publishedAt: new Date() })
          .where(eq(articles.id, corruptionDraft.id));
      }),
    'articles_published_snapshot_complete',
  );
  await expectPostgresRejection(
    'cross-article live revision pointer FK',
    '23503',
    () =>
      database.transaction(async (transaction) => {
        await transaction.execute(sql`
          SELECT set_config('bbsports.article_publication_contract', 'v1', true)
        `);
        return transaction
          .update(articles)
          .set({
            published: true,
            publishedAt: new Date(),
            publishedSnapshot: {
              ...prepared.revision.snapshot,
              slug: `publication-wrong-pointer-${suffix}`,
            },
            publishedContentHash: prepared.revision.contentHash,
            publishedRevisionId: prepared.revision.id,
          })
          .where(eq(articles.id, corruptionDraft.id));
      }),
    'articles_published_revision_same_article',
  );

  const unpublished = await unpublishArticle(
    article.id,
    'Disposable verification completed; remove the temporary public snapshot.',
    actor,
  );
  assert(!unpublished.article.published, 'Actual unpublish query left the article public.');
  assert(
    (await getPublishedArticleBySlug(slug)) === null,
    'Public read still returned an unpublished article.',
  );
  await expectPublicationRejection('audit-preserved article deletion is rejected', 'CONFLICT', () =>
    deleteVirginArticleDraft(article.id, actor),
  );

  const virginDraft = await createArticle({
    slug: `publication-virgin-${suffix}`,
    title: 'Disposable virgin draft',
    body: 'This draft should be eligible for privileged permanent deletion.',
    authorId: superAdmin.id,
    authorName: superAdmin.name,
  });
  assert(
    await deleteVirginArticleDraft(virginDraft.id, actor),
    'Privileged virgin-draft deletion did not report success.',
  );
  assert((await getArticleById(virginDraft.id)) === null, 'Deleted virgin draft still exists.');
  console.info('[publication-db-verify] PASS unpublish and privileged deletion boundaries');

  const revokedDraft = await createArticle({
    slug: `publication-revoked-${suffix}`,
    title: 'Disposable role-revocation draft',
    body: 'A stale actor claim must not survive current-role revocation.',
    authorId: superAdmin.id,
    authorName: superAdmin.name,
  });
  const revokedStatus = await getArticlePublicationStatus(revokedDraft.id);
  assert(revokedStatus.draftHash, 'Role-revocation draft did not produce a hash.');
  const revokedRevision = await createArticleRevision(
    revokedDraft.id,
    actor,
    revokedStatus.draftHash,
  );
  await database
    .update(users)
    .set({ role: 'admin', updatedAt: new Date() })
    .where(eq(users.id, superAdmin.id));
  await expectPublicationRejection('current super-admin role revocation', 'FORBIDDEN', () =>
    publishArticleRevision(
      {
        articleId: revokedDraft.id,
        expectedRevisionId: revokedRevision.revision.id,
        expectedContentHash: revokedRevision.revision.contentHash,
        confirmation: ARTICLE_PUBLICATION_CONFIRMATION_PHRASE,
        rationale: 'This stale authority attempt must be rejected after role revocation.',
        checklistAttestation: [
          'source_url',
          'names_spelling',
          'numbers_fresh',
          'quotes_attributed',
          'bias_disclosed',
          'ai_labeled',
        ],
      },
      actor,
    ),
  );
  const revokedAfterAttempt = await getArticleById(revokedDraft.id);
  assert(!revokedAfterAttempt?.published, 'Role-revoked actor published an article.');

  const eventRows = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(articlePublicationEvents)
    .where(eq(articlePublicationEvents.articleId, article.id));
  assert(eventRows[0]?.count === 2, 'Expected exactly one publish and one unpublish audit event.');
  console.info('[publication-db-verify] PASS current-role authorization uses database truth');
}

async function main(): Promise<void> {
  const phase = requireParentCapability();
  try {
    assert(db, 'Application database client was not initialized.');
    const identityResult = await db.execute(sql`
      SELECT
        current_database() AS database_name,
        to_regclass('public.articles') IS NULL AS articles_missing
    `);
    const identity = (identityResult as unknown as Array<{
      database_name: string;
      articles_missing: boolean;
    }>)[0];
    assert(
      identity?.database_name === process.env[CHILD_DATABASE_ENV],
      'Connected PostgreSQL database differs from the disposable capability.',
    );
    if (phase === 'bootstrap') {
      assert(identity.articles_missing, 'First bootstrap did not receive an empty database.');
    }
    await ensureBootstrapped();
    if (phase === 'bootstrap') {
      assert(db, 'Application database client was not initialized.');
      const liveRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(articles)
        .where(eq(articles.published, true));
      assert(liveRows[0]?.count === 0, 'Fresh bootstrap manufactured a published article.');
      console.info('[publication-db-verify] PASS first real bootstrap completed');
      return;
    }
    await runPublicationVerification();
  } finally {
    await closeDatabaseClient();
  }
}

main().catch((error) => {
  console.error(`[publication-db-verify] FAIL ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});
