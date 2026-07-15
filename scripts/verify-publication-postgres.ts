/**
 * Disposable real-Postgres publication verifier.
 *
 * The parent process is deliberately the only process that can create or drop
 * a database. It creates a cryptographically unique database beside the one in
 * DATABASE_URL, runs two isolated verifier children, and drops the database in
 * a finally block. The application database modules are never imported here,
 * so their singleton client cannot accidentally bind to the production URL.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import postgres from 'postgres';

export const PUBLICATION_VERIFY_DATABASE_PREFIX = 'bbs_pub_verify_';
const CHILD_PHASE_ENV = 'BBS_PUBLICATION_VERIFY_PHASE';
const CHILD_TOKEN_ENV = 'BBS_PUBLICATION_VERIFY_TOKEN';
const CHILD_DATABASE_ENV = 'BBS_PUBLICATION_VERIFY_DATABASE';
const CHILD_TIMEOUT_MS = 180_000;
const CHILD_EXECUTABLE = fileURLToPath(
  new URL('./verify-publication-postgres-child.mjs', import.meta.url),
);

type ChildPhase = 'bootstrap' | 'verify';

export function isDisposablePublicationDatabaseName(name: string): boolean {
  return (
    name.startsWith(PUBLICATION_VERIFY_DATABASE_PREFIX) &&
    name.length <= 63 &&
    /^[a-z0-9_]+$/.test(name)
  );
}

export function createDisposablePublicationDatabaseName(): string {
  const name = [
    PUBLICATION_VERIFY_DATABASE_PREFIX.replace(/_$/, ''),
    Date.now().toString(36),
    process.pid.toString(36),
    randomBytes(12).toString('hex'),
  ].join('_');
  if (!isDisposablePublicationDatabaseName(name)) {
    throw new Error('Generated disposable database name failed its safety policy.');
  }
  return name;
}

export function deriveDisposableDatabaseUrl(
  baseUrlInput: string,
  databaseName: string,
): string {
  if (!isDisposablePublicationDatabaseName(databaseName)) {
    throw new Error('Refusing to derive a URL for a non-disposable database name.');
  }
  const url = new URL(baseUrlInput);
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
  }
  url.pathname = `/${databaseName}`;
  url.searchParams.set('application_name', 'bbsports-publication-verify');
  return url.toString();
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown verification failure.';
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

function postgresErrorCode(error: unknown): string | null {
  let current = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current !== 'object' || current === null) return null;
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === 'string') return record.code;
    current = record.cause;
  }
  return null;
}

async function expectRawPostgresCode(
  label: string,
  expectedCode: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const code = postgresErrorCode(error);
    if (code !== expectedCode) {
      throw new Error(`${label} returned SQLSTATE ${code ?? 'unknown'}.`);
    }
    console.info(`[publication-db-verify] PASS ${label}`);
    return;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function childEnvironment(
  databaseUrl: string,
  databaseName: string,
  phase: ChildPhase,
  capabilityToken: string,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    TMP: process.env.TMP,
    TEMP: process.env.TEMP,
    TZ: process.env.TZ,
    NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS,
    SSL_CERT_FILE: process.env.SSL_CERT_FILE,
    SSL_CERT_DIR: process.env.SSL_CERT_DIR,
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'production',
    PGOPTIONS:
      '-c client_min_messages=warning -c statement_timeout=120000 -c lock_timeout=30000 -c idle_in_transaction_session_timeout=30000',
    [CHILD_PHASE_ENV]: phase,
    [CHILD_TOKEN_ENV]: capabilityToken,
    [CHILD_DATABASE_ENV]: databaseName,
  };
  return environment;
}

function waitForChild(child: ChildProcess, phase: ChildPhase): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error(`Publication verifier ${phase} child exceeded its hard deadline.`));
    }, CHILD_TIMEOUT_MS);
    child.once('error', (error) => finish(error));
    child.once('exit', (code, signal) => {
      if (code === 0) {
        finish();
        return;
      }
      finish(
        new Error(
          `Publication verifier ${phase} child failed (${signal ? `signal ${signal}` : `exit ${code ?? 'unknown'}`}).`,
        ),
      );
    });
  });
}

async function stopChild(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      resolve();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

export async function runDisposablePublicationVerification(): Promise<void> {
  const baseDatabaseUrl = process.env.DATABASE_URL;
  if (!baseDatabaseUrl) {
    throw new Error('DATABASE_URL is required; no database was created.');
  }

  // Parse before opening a socket, both to validate the URL and to guarantee
  // that the generated database is distinct from the configured database.
  const baseUrl = new URL(baseDatabaseUrl);
  if (baseUrl.protocol !== 'postgres:' && baseUrl.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
  }
  const baseDatabaseName = decodeURIComponent(baseUrl.pathname.replace(/^\//, ''));
  if (!baseUrl.hostname || !baseUrl.username || !baseDatabaseName) {
    throw new Error('DATABASE_URL must include a host, user, and explicit database name.');
  }
  if (isDisposablePublicationDatabaseName(baseDatabaseName)) {
    throw new Error('DATABASE_URL already targets a disposable verification database.');
  }
  const databaseName = createDisposablePublicationDatabaseName();
  const disposableUrl = deriveDisposableDatabaseUrl(baseDatabaseUrl, databaseName);
  const ownershipMarker = 'bbsports-publication-verify:v1';
  const admin = postgres(baseDatabaseUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
    ssl: 'prefer',
  });

  let databaseCreated = false;
  let databaseMarked = false;
  let activeChild: ChildProcess | null = null;
  let cleanupPromise: Promise<void> | null = null;
  let workerCwd: string | null = null;
  let releaseMigrationBlocker: (() => void) | null = null;
  const auxiliaryClients: Array<ReturnType<typeof postgres>> = [];

  const cleanup = (): Promise<void> => {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      releaseMigrationBlocker?.();
      releaseMigrationBlocker = null;
      await stopChild(activeChild);
      activeChild = null;
      await Promise.allSettled(
        auxiliaryClients.map((client) => client.end({ timeout: 5 })),
      );
      if (!databaseCreated) return;
      if (!isDisposablePublicationDatabaseName(databaseName)) {
        throw new Error('Cleanup safety policy rejected the generated database name.');
      }
      const ownershipRows = await admin`
        SELECT shobj_description(oid, 'pg_database') AS marker
        FROM pg_database
        WHERE datname = ${databaseName}
        LIMIT 1
      `;
      if (ownershipRows.length === 0) {
        databaseCreated = false;
        return;
      }
      if (databaseMarked && ownershipRows[0]?.marker !== ownershipMarker) {
        throw new Error('Cleanup refused a disposable database with a foreign ownership marker.');
      }
      await admin`ALTER DATABASE ${admin(databaseName)} ALLOW_CONNECTIONS false`;
      await admin`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = ${databaseName}
          AND pid <> pg_backend_pid()
      `;
      await admin`DROP DATABASE IF EXISTS ${admin(databaseName)} WITH (FORCE)`;
      const remaining = await admin`
        SELECT 1
        FROM pg_database
        WHERE datname = ${databaseName}
        LIMIT 1
      `;
      if (remaining.length !== 0) {
        throw new Error('Disposable publication database still exists after DROP DATABASE.');
      }
      databaseCreated = false;
      console.info('[publication-db-verify] PASS disposable database dropped');
      if (workerCwd) {
        await rm(workerCwd, { recursive: true, force: true });
        workerCwd = null;
      }
    })();
    return cleanupPromise;
  };

  const startChild = (phase: ChildPhase): { child: ChildProcess; completion: Promise<void> } => {
    if (!workerCwd) throw new Error('Verifier worker directory is unavailable.');
    console.info(`[publication-db-verify] RUN ${phase}`);
    activeChild = spawn(process.execPath, [CHILD_EXECUTABLE], {
      cwd: workerCwd,
      env: childEnvironment(
        disposableUrl,
        databaseName,
        phase,
        randomBytes(32).toString('hex'),
      ),
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    const child = activeChild;
    const completion = waitForChild(child, phase).finally(() => {
      if (activeChild === child) activeChild = null;
    });
    return { child, completion };
  };

  const runChild = async (phase: ChildPhase): Promise<void> => {
    await startChild(phase).completion;
  };

  const runRollingMigrationWriteProof = async (): Promise<void> => {
    const race = postgres(disposableUrl, {
      max: 4,
      idle_timeout: 5,
      connect_timeout: 15,
      ssl: 'prefer',
    });
    const legacyWriter = postgres(disposableUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 15,
      ssl: 'prefer',
    });
    const legacyReader = postgres(disposableUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 15,
      ssl: 'prefer',
    });
    const preexistingWriter = postgres(disposableUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 15,
      ssl: 'prefer',
    });
    auxiliaryClients.push(race, legacyWriter, legacyReader, preexistingWriter);
    await race`SET statement_timeout = '30s'`;
    await race`SET lock_timeout = '10s'`;
    await legacyWriter`SET statement_timeout = '30s'`;
    await legacyWriter`SET lock_timeout = '10s'`;
    await legacyReader`SET statement_timeout = '30s'`;
    await legacyReader`SET lock_timeout = '10s'`;
    await preexistingWriter`SET statement_timeout = '30s'`;
    await preexistingWriter`SET lock_timeout = '10s'`;

    const suffix = randomBytes(6).toString('hex');
    const [draft] = await race`
      INSERT INTO articles (slug, title, body, author_name)
      VALUES (
        ${`rolling-draft-${suffix}`},
        'Rolling migration draft',
        'Old publish SQL must be rejected while the new check is NOT VALID.',
        'Publication Verifier'
      )
      RETURNING id
    `;
    const [live] = await race`
      INSERT INTO articles (slug, title, body, author_name)
      VALUES (
        ${`rolling-live-${suffix}`},
        'Rolling migration live article',
        'Old unpublish SQL must not leave immutable pointers on a draft.',
        'Publication Verifier'
      )
      RETURNING id
    `;
    if (!draft?.id || !live?.id) throw new Error('Could not create rolling migration fixtures.');
    const [heroAsset] = await race`
      INSERT INTO media_assets (
        kind,
        status,
        title,
        content_type,
        data_base64,
        approved
      )
      VALUES (
        'image',
        'ready',
        'Rolling migration immutable hero',
        'image/png',
        'aW1tdXRhYmxlLXZlcmlmaWVyLWltYWdl',
        true
      )
      RETURNING id
    `;
    if (!heroAsset?.id) throw new Error('Could not create rolling migration media fixture.');
    const contentHash = 'a'.repeat(64);
    const snapshot = {
      slug: `rolling-live-${suffix}`,
      title: 'Rolling migration live article',
      dek: '',
      body: 'Old unpublish SQL must not leave immutable pointers on a draft.',
      sport: 'Op-Ed',
      hero: `/api/media/assets/${heroAsset.id}/file`,
      heroAlt: 'Disposable rolling migration verification image',
      heroCredit: 'Publication Verifier',
      authorName: 'Publication Verifier',
      aiAssisted: false,
      bradsTake: '',
    };
    const [revision] = await race`
      INSERT INTO article_revisions (
        article_id,
        revision_number,
        content_hash,
        snapshot
      )
      VALUES (${live.id}, 1, ${contentHash}, ${race.json(snapshot)})
      RETURNING id
    `;
    if (!revision?.id) throw new Error('Could not create rolling migration revision.');
    await race.begin(async (transaction) => {
      await transaction`
        SELECT set_config('bbsports.article_publication_contract', 'v1', true)
      `;
      await transaction`
        UPDATE articles
        SET published = true,
            published_at = now(),
            published_snapshot = ${transaction.json(snapshot)},
            published_content_hash = ${contentHash},
            published_revision_id = ${revision.id}
        WHERE id = ${live.id}
      `;
    });
    await race`
      ALTER TABLE articles
      DROP CONSTRAINT articles_published_snapshot_complete
    `;
    await race`
      DROP TRIGGER articles_published_working_copy_edit_guard ON articles
    `;
    await race`
      DROP TRIGGER articles_guarded_delete ON articles
    `;
    await race`
      DROP TRIGGER articles_publication_transition_guard ON articles
    `;
    await race`
      DROP TRIGGER media_assets_live_article_ready_guard ON media_assets
    `;
    const legacySlug = `rolling-legacy-live-${suffix}`;
    const legacyHero = '/images/publication-verifier-legacy-hero.png';
    const legacyHeroAlt = 'Disposable exact-match legacy hero';
    const legacyHeroCredit = 'BB Sports publication verifier';
    const [legacyLive] = await race`
      INSERT INTO articles (
        slug,
        title,
        body,
        hero,
        hero_alt,
        hero_credit,
        author_name,
        published,
        published_at
      )
      VALUES (
        ${legacySlug},
        'Pointerless legacy live article',
        'An old replica must not unpublish this row before backfill finishes.',
        ${legacyHero},
        '',
        '',
        'Publication Verifier',
        true,
        now()
      )
      RETURNING id
    `;
    if (!legacyLive?.id) throw new Error('Could not create pointerless legacy live fixture.');
    if (!workerCwd) throw new Error('Verifier worker directory is unavailable.');
    await writeFile(
      path.join(workerCwd, 'content', 'articles', `${legacySlug}.md`),
      [
        '---',
        `slug: ${legacySlug}`,
        'title: Repository metadata must not replace the database title',
        `hero: ${legacyHero}`,
        `heroAlt: ${legacyHeroAlt}`,
        `heroCredit: ${legacyHeroCredit}`,
        '---',
        '',
        'Repository prose must not replace the already-public database body.',
        '',
      ].join('\n'),
      { encoding: 'utf8', mode: 0o600 },
    );

    let siteLockAcquiredResolve: (() => void) | null = null;
    let siteLockAcquiredReject: ((error: unknown) => void) | null = null;
    const siteLockAcquired = new Promise<void>((resolve, reject) => {
      siteLockAcquiredResolve = resolve;
      siteLockAcquiredReject = reject;
    });
    let mediaLockAcquiredResolve: (() => void) | null = null;
    let mediaLockAcquiredReject: ((error: unknown) => void) | null = null;
    const mediaLockAcquired = new Promise<void>((resolve, reject) => {
      mediaLockAcquiredResolve = resolve;
      mediaLockAcquiredReject = reject;
    });
    let releaseSiteLockResolve: () => void = () => undefined;
    const releaseSiteLock = new Promise<void>((resolve) => {
      releaseSiteLockResolve = resolve;
    });
    let releaseMediaLockResolve: () => void = () => undefined;
    const releaseMediaLock = new Promise<void>((resolve) => {
      releaseMediaLockResolve = resolve;
    });
    releaseMigrationBlocker = () => {
      releaseMediaLockResolve();
      releaseSiteLockResolve();
    };
    const siteBlocker = race
      .begin(async (transaction) => {
        await transaction`LOCK TABLE site_config IN ACCESS EXCLUSIVE MODE`;
        siteLockAcquiredResolve?.();
        await releaseSiteLock;
      })
      .catch((error) => {
        siteLockAcquiredReject?.(error);
        throw error;
      });
    const mediaBlocker = race
      .begin(async (transaction) => {
        await transaction`LOCK TABLE media_assets IN ACCESS EXCLUSIVE MODE`;
        mediaLockAcquiredResolve?.();
        await releaseMediaLock;
      })
      .catch((error) => {
        mediaLockAcquiredReject?.(error);
        throw error;
      });
    await Promise.all([siteLockAcquired, mediaLockAcquired]);

    const { completion } = startChild('verify');
    let preexistingWriterProof: Promise<void> | null = null;
    let proofError: unknown = null;
    try {
      const lockDeadline = Date.now() + 30_000;
      let atomicArticleLockVisible = false;
      while (Date.now() < lockDeadline) {
        const [lock] = await race`
          SELECT EXISTS (
            SELECT 1
            FROM pg_locks
            WHERE relation = 'articles'::regclass
              AND mode = 'AccessExclusiveLock'
              AND granted = true
              AND pid <> pg_backend_pid()
          ) AS held
        `;
        if (lock?.held === true) {
          atomicArticleLockVisible = true;
          break;
        }
        await delay(25);
      }
      if (!atomicArticleLockVisible) {
        throw new Error('Atomic rolling-migration article lock was not observable.');
      }

      let preexistingWriterSettled = false;
      preexistingWriterProof = expectRawPostgresCode(
        'writer waiting before atomic guard commit is rejected',
        '55000',
        () =>
          preexistingWriter`
            UPDATE articles
            SET title = 'Pre-commit writer must never become visible'
            WHERE id = ${live.id}
          `,
      ).finally(() => {
        preexistingWriterSettled = true;
      });
      await delay(150);
      if (preexistingWriterSettled) {
        throw new Error('Pre-existing writer did not wait behind the atomic article lock.');
      }
      releaseMediaLockResolve();
      await mediaBlocker;
      await preexistingWriterProof;

      const deadline = Date.now() + 30_000;
      let migrationContractsVisible = false;
      while (Date.now() < deadline) {
        const constraintRows = await race`
          SELECT convalidated,
                 obj_description(oid, 'pg_constraint') AS marker
          FROM pg_constraint
          WHERE conname = 'articles_published_snapshot_complete'
            AND conrelid = 'articles'::regclass
          LIMIT 1
        `;
        const triggerRows = await race`
          SELECT tgname,
                 obj_description(oid, 'pg_trigger') AS marker
          FROM pg_trigger
          WHERE (tgname, obj_description(oid, 'pg_trigger')) IN (
            (
              'articles_published_working_copy_edit_guard',
              'bbsports:published-working-copy-edit-contract:v1'
            ),
            (
              'articles_guarded_delete',
              'bbsports:article-delete-contract:v1'
            ),
            (
              'articles_publication_transition_guard',
              'bbsports:article-publication-contract:v1'
            ),
            (
              'media_assets_live_article_ready_guard',
              'bbsports:media-assets-live-article-ready:v1'
            )
          )
        `;
        if (
          constraintRows[0]?.convalidated === false &&
          constraintRows[0]?.marker === 'bbsports:articles-published-snapshot-complete:v2' &&
          triggerRows.length === 4
        ) {
          migrationContractsVisible = true;
          break;
        }
        await delay(50);
      }
      if (!migrationContractsVisible) {
        throw new Error('Early rolling-deploy publication contracts were not observable.');
      }

      await expectRawPostgresCode('old-style publish blocked during migration', '55000', () =>
        legacyWriter`
          UPDATE articles
          SET published = true, published_at = now()
          WHERE id = ${draft.id}
        `,
      );
      await expectRawPostgresCode('old-style unpublish blocked during migration', '55000', () =>
        legacyWriter`
          UPDATE articles
          SET published = false, published_at = NULL
          WHERE id = ${live.id}
        `,
      );
      await expectRawPostgresCode(
        'protocol-capable incomplete publish blocked by state check',
        '23514',
        () =>
          legacyWriter.begin(async (transaction) => {
            await transaction`
              SELECT set_config('bbsports.article_publication_contract', 'v1', true)
            `;
            await transaction`
              UPDATE articles
              SET published = true, published_at = now()
              WHERE id = ${draft.id}
            `;
          }),
      );
      await expectRawPostgresCode(
        'pointerless legacy live unpublish blocked during migration',
        '55000',
        () =>
          legacyWriter`
            UPDATE articles
            SET published = false, published_at = NULL
            WHERE id = ${legacyLive.id}
          `,
      );
      await expectRawPostgresCode('old published working-copy edit blocked', '55000', () =>
        legacyWriter`
          UPDATE articles
          SET title = 'Unapproved rolling edit',
              body = 'This mutable edit must never become visible to an old public reader.'
          WHERE id = ${live.id}
        `,
      );
      await expectRawPostgresCode('old unconditional article delete blocked', '55000', () =>
        legacyWriter`
          DELETE FROM articles
          WHERE id = ${draft.id}
        `,
      );
      for (const [label, statement] of [
        [
          'live hero approval mutation blocked',
          () => legacyWriter`UPDATE media_assets SET approved = false WHERE id = ${heroAsset.id}`,
        ],
        [
          'live hero readiness mutation blocked',
          () => legacyWriter`UPDATE media_assets SET status = 'failed' WHERE id = ${heroAsset.id}`,
        ],
        [
          'live hero kind mutation blocked',
          () => legacyWriter`UPDATE media_assets SET kind = 'video' WHERE id = ${heroAsset.id}`,
        ],
        [
          'live hero content-type mutation blocked',
          () => legacyWriter`UPDATE media_assets SET content_type = 'image/jpeg' WHERE id = ${heroAsset.id}`,
        ],
        [
          'live hero durable-byte replacement blocked',
          () => legacyWriter`UPDATE media_assets SET data_base64 = 'bmV3LWltYWdl' WHERE id = ${heroAsset.id}`,
        ],
        [
          'live hero identity mutation blocked',
          () => legacyWriter`UPDATE media_assets SET id = gen_random_uuid() WHERE id = ${heroAsset.id}`,
        ],
        [
          'live hero deletion blocked',
          () => legacyWriter`DELETE FROM media_assets WHERE id = ${heroAsset.id}`,
        ],
      ] as const) {
        await expectRawPostgresCode(label, '23514', statement);
      }
      const states = await legacyReader`
        SELECT id, title, body, published, published_at, published_revision_id
        FROM articles
        WHERE id IN (${draft.id}, ${live.id}, ${legacyLive.id})
      `;
      const draftState = states.find((row) => row.id === draft.id);
      const liveState = states.find((row) => row.id === live.id);
      const legacyLiveState = states.find((row) => row.id === legacyLive.id);
      if (draftState?.published !== false || draftState.published_at !== null) {
        throw new Error('Rejected rolling publish changed the draft row.');
      }
      if (
        liveState?.published !== true ||
        !liveState.published_revision_id ||
        liveState.title !== 'Rolling migration live article' ||
        liveState.body !== 'Old unpublish SQL must not leave immutable pointers on a draft.'
      ) {
        throw new Error('Rejected rolling mutation changed old-reader-visible live fields.');
      }
      if (legacyLiveState?.published !== true || legacyLiveState.published_revision_id !== null) {
        throw new Error('Rejected rolling unpublish changed the pointerless legacy live row.');
      }
      const [heroState] = await legacyReader`
        SELECT id, kind, status, content_type, data_base64, approved
        FROM media_assets
        WHERE id = ${heroAsset.id}
      `;
      if (
        heroState?.kind !== 'image' ||
        heroState.status !== 'ready' ||
        heroState.content_type !== 'image/png' ||
        heroState.data_base64 !== 'aW1tdXRhYmxlLXZlcmlmaWVyLWltYWdl' ||
        heroState.approved !== true
      ) {
        throw new Error('Rejected live-hero mutation changed the immutable media bytes.');
      }
    } catch (error) {
      proofError = error;
    } finally {
      releaseMigrationBlocker?.();
      releaseMigrationBlocker = null;
      await Promise.all([siteBlocker, mediaBlocker]);
      if (preexistingWriterProof) await preexistingWriterProof;
      await completion;
    }
    if (proofError) throw proofError;
  };

  const handleSignal = (signal: NodeJS.Signals, exitCode: number) => {
    console.error(`[publication-db-verify] ${signal}; cleaning disposable database`);
    void cleanup()
      .catch((error) => {
        console.error(`[publication-db-verify] cleanup failed: ${safeErrorMessage(error)}`);
      })
      .finally(async () => {
        await admin.end({ timeout: 5 }).catch(() => undefined);
        process.exit(exitCode);
      });
  };
  const onSigint = () => handleSignal('SIGINT', 130);
  const onSigterm = () => handleSignal('SIGTERM', 143);
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  try {
    const preflightResult = await admin`
      SELECT
        current_database() AS database_name,
        current_setting('server_version_num')::int AS server_version_num,
        current_setting('transaction_read_only') AS transaction_read_only,
        pg_is_in_recovery() AS in_recovery,
        (
          SELECT rolcreatedb OR rolsuper
          FROM pg_roles
          WHERE rolname = current_user
        ) AS can_create_database
    `;
    const preflight = preflightResult[0];
    if (
      preflight?.database_name !== baseDatabaseName ||
      preflight.transaction_read_only !== 'off' ||
      preflight.in_recovery !== false ||
      preflight.can_create_database !== true ||
      Number(preflight.server_version_num) < 130000
    ) {
      throw new Error(
        'PostgreSQL preflight failed: exact database, read-write, CREATEDB, and PostgreSQL 13+ are required.',
      );
    }
    await admin`SET statement_timeout = '30s'`;
    await admin`SET lock_timeout = '10s'`;
    workerCwd = await mkdtemp(path.join(tmpdir(), 'bbs-publication-verify-'));
    await mkdir(path.join(workerCwd, 'content', 'articles'), { recursive: true });
    console.info('[publication-db-verify] creating isolated disposable database');
    await admin`CREATE DATABASE ${admin(databaseName)} TEMPLATE template0`;
    databaseCreated = true;
    // PostgreSQL utility statements do not accept a bind parameter in the
    // COMMENT value position, so the fixed marker is an SQL literal while the
    // generated database identifier still uses postgres.js identifier quoting.
    await admin`
      COMMENT ON DATABASE ${admin(databaseName)} IS 'bbsports-publication-verify:v1'
    `;
    databaseMarked = true;
    // Two separate processes force the real bootstrap body to execute twice;
    // the in-process ensureBootstrapped cache cannot hide idempotency defects.
    await runChild('bootstrap');
    await runRollingMigrationWriteProof();
    console.info('[publication-db-verify] PASS all real-Postgres publication checks');
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    try {
      await cleanup();
    } finally {
      if (workerCwd) await rm(workerCwd, { recursive: true, force: true });
      await admin.end({ timeout: 5 });
    }
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (invokedPath === import.meta.url) {
  runDisposablePublicationVerification().catch((error) => {
    console.error(`[publication-db-verify] FAIL ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  });
}
