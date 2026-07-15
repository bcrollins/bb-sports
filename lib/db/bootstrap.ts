/**
 * BB Sports — boot-time database bootstrap.
 *
 * Runs at server start (lazily, once per cold boot). Performs:
 *   1. CREATE TABLE IF NOT EXISTS for all schema tables.
 *   2. Seed admin user from env (ADMIN_EMAIL + ADMIN_PASSWORD_HASH).
 *   3. Seed site_config defaults.
 *   4. Seed articles from /content/articles markdown if articles table is empty.
 *
 * Idempotent — safe to call on every cold start.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import matter from 'gray-matter';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db, dbAvailable } from './client';
import {
  articlePublicationEvents,
  articleRevisions,
  articles,
  mediaAssets,
  newsProviders,
  newsSources,
  siteConfig,
  sportsLeagues,
  sportsPeople,
  sportsTeams,
  users,
} from './schema';
import {
  ARTICLE_PUBLICATION_FIELDS,
  articleHeroMediaAssetId,
  hashArticlePublicationSnapshot,
  normalizeArticlePublicationSnapshot,
} from '../article-publication';
import type { ArticlePublicationSnapshot } from '../article-publication';
import {
  NEWSROOM_PROVIDER_CATALOG,
  NEWSROOM_PROVIDER_KEYS,
} from '../newsroom-providers';
import { LEAGUE_SEEDS } from '../sports-encyclopedia/leagues.seed';
import { PERSON_SEEDS } from '../sports-encyclopedia/people.seed';
import { TEAM_SEEDS } from '../sports-encyclopedia/teams.seed';

type LegacyPublicationRequiredField =
  | 'slug'
  | 'title'
  | 'sport'
  | 'heroAlt'
  | 'heroCredit'
  | 'authorName'
  | 'bradsTake';

export interface LegacyPublicationWorkingCopy {
  id: string;
  slug: string;
  title: string;
  sport: string;
  hero: string;
  heroAlt: string;
  heroCredit: string;
  authorName: string;
  aiAssisted: boolean;
  bradsTake: string;
}

export interface RepositoryLegacyPublicationMetadata {
  slug: string;
  hero: string;
  heroAlt: string;
  heroCredit: string;
}

export interface LegacyPublicationMetadataPatch {
  heroAlt?: string;
  heroCredit?: string;
}

const PUBLICATION_FIELD_NAMES = new Set<string>(ARTICLE_PUBLICATION_FIELDS);

function canonicalRepositoryMetadata(value: string): string {
  const canonical = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  return canonical.length <= 500 ? canonical : '';
}

function missingLegacyPublicationFields(
  workingCopy: LegacyPublicationWorkingCopy,
): LegacyPublicationRequiredField[] {
  const missing: LegacyPublicationRequiredField[] = [];
  if (!workingCopy.slug.trim()) missing.push('slug');
  if (!workingCopy.title.trim()) missing.push('title');
  if (!workingCopy.sport.trim()) missing.push('sport');
  if (workingCopy.hero.trim() && !workingCopy.heroAlt.trim()) missing.push('heroAlt');
  if (workingCopy.hero.trim() && !workingCopy.heroCredit.trim()) missing.push('heroCredit');
  if (!workingCopy.authorName.trim()) missing.push('authorName');
  if (workingCopy.aiAssisted && !workingCopy.bradsTake.trim()) missing.push('bradsTake');
  return missing;
}

function safeLegacyArticleReference(workingCopy: LegacyPublicationWorkingCopy): string {
  const id = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(workingCopy.id)
    ? workingCopy.id
    : '[invalid-id]';
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workingCopy.slug)
    ? workingCopy.slug
    : '[invalid-slug]';
  return `${id} (${slug})`;
}

function legacyPublicationMetadataError(
  workingCopy: LegacyPublicationWorkingCopy,
  fields: readonly string[],
  reason: string,
): Error {
  const fieldList = fields.length > 0 ? fields.join(', ') : 'unknown';
  return new Error(
    `Legacy live article ${safeLegacyArticleReference(workingCopy)} cannot be preserved: ` +
      `${reason} [fields: ${fieldList}].`,
  );
}

function redactedPublicationValidationFields(error: unknown): string[] {
  if (!error || typeof error !== 'object' || !('issues' in error)) return [];
  const issues = (error as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];
  const fields = issues.flatMap((issue) => {
    if (!issue || typeof issue !== 'object' || !('path' in issue)) return [];
    const path = (issue as { path?: unknown }).path;
    const field = Array.isArray(path) ? path[0] : undefined;
    return typeof field === 'string' && PUBLICATION_FIELD_NAMES.has(field) ? [field] : [];
  });
  return [...new Set(fields)];
}

/**
 * Complete only publication-required hero metadata on an old live row. The
 * repository record is an authority only when its frontmatter slug and hero
 * are byte-for-byte identical to the database values. Existing nonblank
 * working-copy values are never replaced.
 */
export function completeLegacyPublicationMetadata(
  workingCopy: LegacyPublicationWorkingCopy,
  repositoryMetadata?: RepositoryLegacyPublicationMetadata,
): LegacyPublicationMetadataPatch {
  const missing = missingLegacyPublicationFields(workingCopy);
  if (missing.length === 0) return {};

  const patch: LegacyPublicationMetadataPatch = {};
  const repositoryMatches =
    repositoryMetadata?.slug === workingCopy.slug &&
    repositoryMetadata.hero === workingCopy.hero;

  if (repositoryMatches && missing.includes('heroAlt')) {
    const heroAlt = canonicalRepositoryMetadata(repositoryMetadata.heroAlt);
    if (heroAlt) patch.heroAlt = heroAlt;
  }
  if (repositoryMatches && missing.includes('heroCredit')) {
    const heroCredit = canonicalRepositoryMetadata(repositoryMetadata.heroCredit);
    if (heroCredit) patch.heroCredit = heroCredit;
  }

  const unresolved = missingLegacyPublicationFields({ ...workingCopy, ...patch });
  if (unresolved.length > 0) {
    throw legacyPublicationMetadataError(
      workingCopy,
      unresolved,
      'required metadata is unavailable; repository fallback is restricted to blank heroAlt/heroCredit on an exact-slug record with an identical hero',
    );
  }
  return patch;
}

let bootstrapPromise: Promise<void> | null = null;

/** Returns once the DB is ready. Subsequent calls re-use the same promise. */
export function ensureBootstrapped(): Promise<void> {
  if (!dbAvailable) return Promise.resolve();
  if (!bootstrapPromise) bootstrapPromise = bootstrap();
  return bootstrapPromise;
}

async function bootstrap(): Promise<void> {
  if (!db) return;

  // 1. Tables — minimal hand-written DDL so we don't ship `drizzle-kit` to production.
  //    Keep this in lockstep with lib/db/schema.ts.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(255) NOT NULL UNIQUE,
      password_hash text NOT NULL,
      name varchar(120) NOT NULL,
      role varchar(24) NOT NULL DEFAULT 'admin',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS articles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug varchar(200) NOT NULL UNIQUE,
      title text NOT NULL,
      dek text NOT NULL DEFAULT '',
      body text NOT NULL DEFAULT '',
      sport varchar(24) NOT NULL DEFAULT 'Op-Ed',
      hero text NOT NULL DEFAULT '',
      hero_alt text NOT NULL DEFAULT '',
      hero_credit text NOT NULL DEFAULT '',
      author_id uuid REFERENCES users(id) ON DELETE SET NULL,
      author_name varchar(120) NOT NULL DEFAULT 'Brad Benson',
      ai_assisted boolean NOT NULL DEFAULT false,
      brads_take text NOT NULL DEFAULT '',
      published boolean NOT NULL DEFAULT false,
      published_at timestamptz,
      published_snapshot jsonb,
      published_content_hash varchar(64),
      published_revision_id uuid,
      created_under_approval_gate boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  // Forward-compat: ALTER TABLE for older databases that were bootstrapped
  // before these columns existed. Idempotent — IF NOT EXISTS is supported on
  // ADD COLUMN in Postgres 9.6+.
  // The first table lock is the rolling-deploy boundary. PostgreSQL holds it
  // until commit, so old writers that arrive after this point wait until the
  // state check, transition/edit/delete triggers, activation control, and live
  // media guard all become visible together. No partially installed contract
  // can be observed by another connection.
  await db.transaction(async (migration) => {
    await migration.execute(sql`LOCK TABLE articles IN ACCESS EXCLUSIVE MODE;`);
    await migration.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS hero_alt text NOT NULL DEFAULT '';`);
    await migration.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS hero_credit text NOT NULL DEFAULT '';`);
    await migration.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_assisted boolean NOT NULL DEFAULT false;`);
    await migration.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS brads_take text NOT NULL DEFAULT '';`);
    await migration.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_snapshot jsonb;`);
    await migration.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_content_hash varchar(64);`);
    await migration.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_revision_id uuid;`);
    await migration.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS created_under_approval_gate boolean NOT NULL DEFAULT false;`);
  // Install the complete two-way state invariant before any snapshot backfill.
  // NOT VALID permits legacy rows to be reconciled below, while PostgreSQL
  // immediately enforces the constraint for concurrent writes from older
  // rolling-deploy instances. A version marker prevents a same-named weak
  // predecessor (including an adversarial `OR true`) from being trusted.
    await migration.execute(sql`
    DO $block$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'articles_published_snapshot_complete'
          AND conrelid = 'articles'::regclass
          AND obj_description(oid, 'pg_constraint') =
            'bbsports:articles-published-snapshot-complete:v2'
      ) THEN
        ALTER TABLE articles
        DROP CONSTRAINT IF EXISTS articles_published_snapshot_complete;
        ALTER TABLE articles
        ADD CONSTRAINT articles_published_snapshot_complete CHECK (
          (
            published = false
            AND published_at IS NULL
            AND published_snapshot IS NULL
            AND published_content_hash IS NULL
            AND published_revision_id IS NULL
          )
          OR (
            published = true
            AND published_at IS NOT NULL
            AND published_snapshot IS NOT NULL
            AND published_content_hash IS NOT NULL
            AND published_content_hash ~ '^[a-f0-9]{64}$'
            AND published_revision_id IS NOT NULL
          )
        ) NOT VALID;
        COMMENT ON CONSTRAINT articles_published_snapshot_complete ON articles IS
          'bbsports:articles-published-snapshot-complete:v2';
      END IF;
    END;
    $block$;
  `);
  // Published working-copy edits stay globally disabled until the release
  // operator confirms every old reader has drained. The control is reversible:
  // disable it before rolling back to code that reads mutable article columns.
    await migration.execute(sql`
    CREATE TABLE IF NOT EXISTS publication_runtime_controls (
      control_key varchar(80) PRIMARY KEY
        CHECK (control_key = 'published_working_copy_edits_v1'),
      enabled boolean NOT NULL DEFAULT false,
      deployment_sha varchar(64),
      changed_at timestamptz,
      changed_by varchar(160) NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT publication_runtime_controls_sha CHECK (
        deployment_sha IS NULL OR deployment_sha ~ '^[a-f0-9]{40}$'
      ),
      CONSTRAINT publication_runtime_controls_enabled_audit CHECK (
        enabled = false
        OR (
          deployment_sha IS NOT NULL
          AND changed_at IS NOT NULL
          AND length(trim(changed_by)) > 0
        )
      )
    );
  `);
    await migration.execute(sql`
    INSERT INTO publication_runtime_controls (control_key, enabled)
    VALUES ('published_working_copy_edits_v1', false)
    ON CONFLICT (control_key) DO NOTHING;
  `);
    await migration.execute(sql`
    CREATE OR REPLACE FUNCTION bbsports_guard_publication_runtime_control()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'publication runtime controls cannot be deleted'
          USING
            ERRCODE = '55000',
            CONSTRAINT = 'publication_runtime_controls_guarded';
      END IF;
      IF OLD.control_key IS DISTINCT FROM NEW.control_key
        OR OLD.enabled IS NOT DISTINCT FROM NEW.enabled
        OR current_setting(
          'bbsports.publication_activation_contract',
          true
        ) IS DISTINCT FROM 'v1'
        OR length(trim(NEW.changed_by)) = 0
        OR NEW.changed_at IS NULL
        OR (
          NEW.enabled = true
          AND (
            NEW.deployment_sha IS NULL
            OR NEW.deployment_sha !~ '^[a-f0-9]{40}$'
          )
        )
      THEN
        RAISE EXCEPTION 'publication runtime control changes require the guarded release command'
          USING
            ERRCODE = '55000',
            CONSTRAINT = 'publication_runtime_controls_guarded';
      END IF;
      IF NEW.enabled = false
        AND EXISTS (
          SELECT 1
          FROM articles
          WHERE published = true
            AND published_snapshot IS DISTINCT FROM jsonb_build_object(
              'slug', slug,
              'title', title,
              'dek', dek,
              'body', body,
              'sport', sport,
              'hero', hero,
              'heroAlt', hero_alt,
              'heroCredit', hero_credit,
              'authorName', author_name,
              'aiAssisted', ai_assisted,
              'bradsTake', brads_take
            )
        )
      THEN
        RAISE EXCEPTION 'working-copy edits cannot be disabled while a live article differs from its approved snapshot'
          USING
            ERRCODE = '55000',
            CONSTRAINT = 'publication_runtime_controls_live_drift';
      END IF;
      RETURN NEW;
    END;
    $function$;
  `);
    await migration.execute(sql`
    DO $block$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'publication_runtime_controls_guarded'
          AND tgrelid = 'publication_runtime_controls'::regclass
          AND obj_description(oid, 'pg_trigger') =
            'bbsports:publication-runtime-controls:v1'
      ) THEN
        DROP TRIGGER IF EXISTS publication_runtime_controls_guarded
          ON publication_runtime_controls;
        CREATE TRIGGER publication_runtime_controls_guarded
        BEFORE UPDATE OR DELETE ON publication_runtime_controls
        FOR EACH ROW EXECUTE FUNCTION bbsports_guard_publication_runtime_control();
        COMMENT ON TRIGGER publication_runtime_controls_guarded
          ON publication_runtime_controls IS
          'bbsports:publication-runtime-controls:v1';
      END IF;
    END;
    $block$;
  `);
  // Rolling deployments can keep an older application instance alive after
  // immutable publication pointers are installed. That older code writes the
  // reader-visible columns directly and can delete drafts without the current
  // authorization/history checks. Install both mutation contracts before any
  // later bootstrap work can block: old instances do not know the transaction-
  // local capabilities, while current code enables each capability only after
  // completing its row lock, CAS, authorization, and audit checks.
    await migration.execute(sql`
    CREATE OR REPLACE FUNCTION bbsports_enforce_article_mutation_contracts()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF current_setting('bbsports.article_delete_contract', true) IS DISTINCT FROM 'v1' THEN
          RAISE EXCEPTION 'article deletion requires the guarded deletion contract'
            USING
              ERRCODE = '55000',
              CONSTRAINT = 'articles_guarded_delete_contract';
        END IF;
        RETURN OLD;
      END IF;

      IF OLD.published IS DISTINCT FROM NEW.published
        AND current_setting('bbsports.article_publication_contract', true) IS DISTINCT FROM 'v1'
      THEN
        RAISE EXCEPTION 'article publication transitions require the guarded publication contract'
          USING
            ERRCODE = '55000',
            CONSTRAINT = 'articles_publication_transition_contract';
      END IF;

      IF OLD.published = true
        AND (
          OLD.slug IS DISTINCT FROM NEW.slug
          OR OLD.title IS DISTINCT FROM NEW.title
          OR OLD.dek IS DISTINCT FROM NEW.dek
          OR OLD.body IS DISTINCT FROM NEW.body
          OR OLD.sport IS DISTINCT FROM NEW.sport
          OR OLD.hero IS DISTINCT FROM NEW.hero
          OR OLD.hero_alt IS DISTINCT FROM NEW.hero_alt
          OR OLD.hero_credit IS DISTINCT FROM NEW.hero_credit
          OR OLD.author_name IS DISTINCT FROM NEW.author_name
          OR OLD.ai_assisted IS DISTINCT FROM NEW.ai_assisted
          OR OLD.brads_take IS DISTINCT FROM NEW.brads_take
        )
      THEN
        IF current_setting(
          'bbsports.article_legacy_metadata_backfill_contract',
          true
        ) IS NOT DISTINCT FROM 'v1'
        THEN
          -- This compatibility capability exists solely for the one atomic
          -- migration that promotes a pointerless legacy live row. It can
          -- complete blank hero attribution, but cannot rewrite any existing
          -- content or point at anything other than the matching immutable
          -- revision and legacy audit event created in the same transaction.
          IF OLD.published_snapshot IS NOT NULL
            OR OLD.published_content_hash IS NOT NULL
            OR OLD.published_revision_id IS NOT NULL
            OR NEW.published_snapshot IS NULL
            OR NEW.published_content_hash IS NULL
            OR NEW.published_revision_id IS NULL
            OR length(trim(OLD.hero)) = 0
            OR ROW(
              OLD.id,
              OLD.slug,
              OLD.title,
              OLD.dek,
              OLD.body,
              OLD.sport,
              OLD.hero,
              OLD.author_id,
              OLD.author_name,
              OLD.ai_assisted,
              OLD.brads_take,
              OLD.published,
              OLD.published_at,
              OLD.created_under_approval_gate,
              OLD.created_at,
              OLD.updated_at
            ) IS DISTINCT FROM ROW(
              NEW.id,
              NEW.slug,
              NEW.title,
              NEW.dek,
              NEW.body,
              NEW.sport,
              NEW.hero,
              NEW.author_id,
              NEW.author_name,
              NEW.ai_assisted,
              NEW.brads_take,
              NEW.published,
              NEW.published_at,
              NEW.created_under_approval_gate,
              NEW.created_at,
              NEW.updated_at
            )
            OR NOT (
              OLD.hero_alt IS NOT DISTINCT FROM NEW.hero_alt
              OR (
                length(trim(OLD.hero_alt)) = 0
                AND length(trim(NEW.hero_alt)) BETWEEN 1 AND 500
              )
            )
            OR NOT (
              OLD.hero_credit IS NOT DISTINCT FROM NEW.hero_credit
              OR (
                length(trim(OLD.hero_credit)) = 0
                AND length(trim(NEW.hero_credit)) BETWEEN 1 AND 500
              )
            )
            OR NEW.published_snapshot IS DISTINCT FROM jsonb_build_object(
              'slug', NEW.slug,
              'title', NEW.title,
              'dek', NEW.dek,
              'body', NEW.body,
              'sport', NEW.sport,
              'hero', NEW.hero,
              'heroAlt', NEW.hero_alt,
              'heroCredit', NEW.hero_credit,
              'authorName', NEW.author_name,
              'aiAssisted', NEW.ai_assisted,
              'bradsTake', NEW.brads_take
            )
            OR NOT EXISTS (
              SELECT 1
              FROM article_revisions
              WHERE article_id = NEW.id
                AND id = NEW.published_revision_id
                AND content_hash = NEW.published_content_hash
                AND snapshot = NEW.published_snapshot
            )
            OR NOT EXISTS (
              SELECT 1
              FROM article_publication_events
              WHERE article_id = NEW.id
                AND revision_id = NEW.published_revision_id
                AND content_hash = NEW.published_content_hash
                AND action = 'legacy_backfill'
            )
          THEN
            RAISE EXCEPTION 'legacy publication metadata completion requires the exact guarded backfill contract'
              USING
                ERRCODE = '55000',
                CONSTRAINT = 'articles_legacy_metadata_backfill_contract';
          END IF;
        ELSIF current_setting(
          'bbsports.published_working_copy_edit_contract',
          true
        ) IS DISTINCT FROM 'v1'
          OR NOT EXISTS (
            SELECT 1
            FROM publication_runtime_controls
            WHERE control_key = 'published_working_copy_edits_v1'
              AND enabled = true
          )
        THEN
          RAISE EXCEPTION 'published working-copy edits require the guarded edit contract'
            USING
              ERRCODE = '55000',
              CONSTRAINT = 'articles_published_working_copy_edit_contract';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $function$;
  `);
    await migration.execute(sql`
    DO $block$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'articles_published_working_copy_edit_guard'
          AND tgrelid = 'articles'::regclass
          AND obj_description(oid, 'pg_trigger') =
            'bbsports:published-working-copy-edit-contract:v1'
      ) THEN
        DROP TRIGGER IF EXISTS articles_published_working_copy_edit_guard ON articles;
        CREATE TRIGGER articles_published_working_copy_edit_guard
        BEFORE UPDATE OF
          slug,
          title,
          dek,
          body,
          sport,
          hero,
          hero_alt,
          hero_credit,
          author_name,
          ai_assisted,
          brads_take
        ON articles
        FOR EACH ROW EXECUTE FUNCTION bbsports_enforce_article_mutation_contracts();
        COMMENT ON TRIGGER articles_published_working_copy_edit_guard ON articles IS
          'bbsports:published-working-copy-edit-contract:v1';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'articles_guarded_delete'
          AND tgrelid = 'articles'::regclass
          AND obj_description(oid, 'pg_trigger') =
            'bbsports:article-delete-contract:v1'
      ) THEN
        DROP TRIGGER IF EXISTS articles_guarded_delete ON articles;
        CREATE TRIGGER articles_guarded_delete
        BEFORE DELETE ON articles
        FOR EACH ROW EXECUTE FUNCTION bbsports_enforce_article_mutation_contracts();
        COMMENT ON TRIGGER articles_guarded_delete ON articles IS
          'bbsports:article-delete-contract:v1';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'articles_publication_transition_guard'
          AND tgrelid = 'articles'::regclass
          AND obj_description(oid, 'pg_trigger') =
            'bbsports:article-publication-contract:v1'
      ) THEN
        DROP TRIGGER IF EXISTS articles_publication_transition_guard ON articles;
        CREATE TRIGGER articles_publication_transition_guard
        BEFORE UPDATE OF published ON articles
        FOR EACH ROW EXECUTE FUNCTION bbsports_enforce_article_mutation_contracts();
        COMMENT ON TRIGGER articles_publication_transition_guard ON articles IS
          'bbsports:article-publication-contract:v1';
      END IF;
    END;
    $block$;
  `);
  // Media referenced by an immutable live snapshot must remain renderable for
  // as long as that snapshot is public. Create the table and install this
  // no-bypass invariant before the remainder of bootstrap so a legacy replica
  // cannot invalidate or delete a live hero during a rolling deployment.
    await migration.execute(sql`
    CREATE TABLE IF NOT EXISTS media_assets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind varchar(24) NOT NULL DEFAULT 'image',
      status varchar(32) NOT NULL DEFAULT 'ready',
      title text NOT NULL DEFAULT '',
      sport varchar(40) NOT NULL DEFAULT 'general',
      placement varchar(40) NOT NULL DEFAULT 'homepage',
      prompt text NOT NULL DEFAULT '',
      provider varchar(40) NOT NULL DEFAULT 'xai',
      model varchar(80) NOT NULL DEFAULT '',
      asset_url text NOT NULL DEFAULT '',
      external_url text NOT NULL DEFAULT '',
      content_type varchar(80) NOT NULL DEFAULT '',
      data_base64 text NOT NULL DEFAULT '',
      alt_text text NOT NULL DEFAULT '',
      credit text NOT NULL DEFAULT 'AI-generated via xAI Grok; approved by BB Sports.',
      aspect_ratio varchar(16) NOT NULL DEFAULT '16:9',
      resolution varchar(16) NOT NULL DEFAULT '',
      duration_seconds integer,
      animated boolean NOT NULL DEFAULT false,
      approved boolean NOT NULL DEFAULT false,
      request_id varchar(160),
      raw_response jsonb,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
    await migration.execute(sql`LOCK TABLE media_assets IN ACCESS EXCLUSIVE MODE;`);
    await migration.execute(sql`
    CREATE OR REPLACE FUNCTION bbsports_preserve_live_article_media()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      referenced_asset_id uuid := OLD.id;
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM articles
        WHERE published = true
          AND published_snapshot->>'hero' =
            '/api/media/assets/' || referenced_asset_id::text || '/file'
      ) THEN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'a live article hero asset cannot be deleted while referenced'
            USING
              ERRCODE = '23514',
              CONSTRAINT = 'media_assets_live_article_ready';
        END IF;
        IF NEW.id IS DISTINCT FROM OLD.id
          OR NEW.kind IS DISTINCT FROM OLD.kind
          OR NEW.status IS DISTINCT FROM OLD.status
          OR NEW.approved IS DISTINCT FROM OLD.approved
          OR NEW.content_type IS DISTINCT FROM OLD.content_type
          OR NEW.data_base64 IS DISTINCT FROM OLD.data_base64
        THEN
          RAISE EXCEPTION 'a live article hero asset and its durable bytes are immutable while referenced'
            USING
              ERRCODE = '23514',
              CONSTRAINT = 'media_assets_live_article_ready';
        END IF;
      END IF;
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END;
    $function$;
  `);
    await migration.execute(sql`
    DO $block$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'media_assets_live_article_ready_guard'
          AND tgrelid = 'media_assets'::regclass
          AND obj_description(oid, 'pg_trigger') =
            'bbsports:media-assets-live-article-ready:v1'
      ) THEN
        DROP TRIGGER IF EXISTS media_assets_live_article_ready_guard ON media_assets;
        CREATE TRIGGER media_assets_live_article_ready_guard
        BEFORE UPDATE OR DELETE ON media_assets
        FOR EACH ROW EXECUTE FUNCTION bbsports_preserve_live_article_media();
        COMMENT ON TRIGGER media_assets_live_article_ready_guard ON media_assets IS
          'bbsports:media-assets-live-article-ready:v1';
      END IF;
    END;
    $block$;
  `);
  });
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS site_config (
      key varchar(64) PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by uuid REFERENCES users(id) ON DELETE SET NULL
    );
  `);
  // A historical admin route stored access_wall as a JSON-encoded string
  // inside JSONB. That malformed row contains a retired credential hash and
  // must never remain an alternate way through the wall. Correct object rows
  // created by the current dedicated endpoint are preserved.
  await db.execute(sql`
    DELETE FROM site_config
    WHERE key = 'access_wall'
      AND jsonb_typeof(value) = 'string';
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      jwt_id varchar(64) NOT NULL UNIQUE,
      ip_address varchar(64),
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(255) NOT NULL UNIQUE,
      status varchar(24) NOT NULL DEFAULT 'subscribed',
      unsubscribe_token varchar(96) UNIQUE,
      source varchar(80) NOT NULL DEFAULT 'site',
      consent_text text NOT NULL DEFAULT 'Newsletter signup on BB Sports. No spam. Unsubscribe in one click.',
      consent_version varchar(32) NOT NULL DEFAULT '2026-05-07',
      signup_count integer NOT NULL DEFAULT 1,
      last_ip_address varchar(64),
      last_user_agent text,
      welcome_sent_at timestamptz,
      welcome_provider_id varchar(160),
      welcome_error text,
      unsubscribed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token varchar(96);`);
  await db.execute(sql`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;`);
  await db.execute(sql`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS welcome_provider_id varchar(160);`);
  await db.execute(sql`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS welcome_error text;`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mode varchar(24) NOT NULL,
      email varchar(255) NOT NULL,
      name varchar(120) NOT NULL DEFAULT '',
      message text NOT NULL,
      confidential boolean NOT NULL DEFAULT false,
      status varchar(24) NOT NULL DEFAULT 'new',
      ip_address varchar(64),
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS donation_intents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(255),
      name varchar(120) NOT NULL DEFAULT '',
      amount_cents integer,
      message text NOT NULL DEFAULT '',
      source varchar(80) NOT NULL DEFAULT 'site',
      status varchar(32) NOT NULL DEFAULT 'waiting_for_stripe',
      stripe_payment_link text,
      stripe_checkout_session_id varchar(255),
      stripe_payment_intent_id varchar(255),
      stripe_customer_id varchar(255),
      stripe_currency varchar(8),
      stripe_amount_received_cents integer,
      paid_at timestamptz,
      ip_address varchar(64),
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`ALTER TABLE donation_intents ADD COLUMN IF NOT EXISTS stripe_checkout_session_id varchar(255);`);
  await db.execute(sql`ALTER TABLE donation_intents ADD COLUMN IF NOT EXISTS stripe_payment_intent_id varchar(255);`);
  await db.execute(sql`ALTER TABLE donation_intents ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(255);`);
  await db.execute(sql`ALTER TABLE donation_intents ADD COLUMN IF NOT EXISTS stripe_currency varchar(8);`);
  await db.execute(sql`ALTER TABLE donation_intents ADD COLUMN IF NOT EXISTS stripe_amount_received_cents integer;`);
  await db.execute(sql`ALTER TABLE donation_intents ADD COLUMN IF NOT EXISTS paid_at timestamptz;`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      parent_id uuid REFERENCES comments(id) ON DELETE SET NULL,
      author_name varchar(80) NOT NULL,
      author_email varchar(255),
      body text NOT NULL,
      status varchar(24) NOT NULL DEFAULT 'pending',
      moderation_reason text NOT NULL DEFAULT '',
      ip_address varchar(64),
      user_agent text,
      approved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_name varchar(80) NOT NULL,
      path text NOT NULL DEFAULT '/',
      referrer text NOT NULL DEFAULT '',
      source varchar(80) NOT NULL DEFAULT 'site',
      anon_id varchar(96),
      properties jsonb NOT NULL DEFAULT '{}'::jsonb,
      ip_hash varchar(96),
      user_agent_hash varchar(96),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_sources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_key varchar(120) NOT NULL UNIQUE,
      display_name varchar(200) NOT NULL,
      source_type varchar(32) NOT NULL DEFAULT 'manual',
      owner_key varchar(160) NOT NULL,
      tier varchar(24) NOT NULL DEFAULT 'unverified'
        CHECK (tier IN ('primary', 'official', 'tier_1', 'tier_2', 'unverified')),
      commercial_status varchar(32) NOT NULL DEFAULT 'review_required'
        CHECK (commercial_status IN ('approved', 'review_required', 'prohibited')),
      commercial_notes text NOT NULL DEFAULT '',
      homepage_url text,
      enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_signals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id uuid NOT NULL REFERENCES news_sources(id),
      external_id varchar(240),
      canonical_url text,
      exact_url_hash varchar(64),
      exact_content_hash varchar(64) NOT NULL,
      headline text NOT NULL,
      summary text NOT NULL DEFAULT '',
      sport varchar(40) NOT NULL DEFAULT 'General',
      source_published_at timestamptz,
      observed_at timestamptz NOT NULL DEFAULT now(),
      raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      headline text NOT NULL,
      summary text NOT NULL DEFAULT '',
      sport varchar(40) NOT NULL DEFAULT 'General',
      state varchar(32) NOT NULL DEFAULT 'new'
        CHECK (state IN ('new', 'investigating', 'verification_ready', 'verified', 'dismissed')),
      urgency varchar(24) NOT NULL DEFAULT 'routine'
        CHECK (urgency IN ('routine', 'watch', 'breaking')),
      version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      first_signal_at timestamptz NOT NULL DEFAULT now(),
      last_signal_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_event_signals (
      event_id uuid NOT NULL REFERENCES news_events(id),
      signal_id uuid NOT NULL REFERENCES news_signals(id),
      linkage varchar(24) NOT NULL DEFAULT 'manual'
        CHECK (linkage IN ('manual', 'exact', 'clustered')),
      similarity_basis_points integer
        CHECK (similarity_basis_points IS NULL OR similarity_basis_points BETWEEN 0 AND 10000),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT news_event_signals_pk PRIMARY KEY (event_id, signal_id)
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_evidence (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES news_events(id),
      source_id uuid REFERENCES news_sources(id) ON DELETE RESTRICT,
      signal_id uuid REFERENCES news_signals(id) ON DELETE RESTRICT,
      supersedes_evidence_id uuid REFERENCES news_evidence(id),
      stance varchar(24) NOT NULL CHECK (stance IN ('supporting', 'contradicting', 'context')),
      evidence_class varchar(24) NOT NULL CHECK (evidence_class IN ('primary', 'official', 'reporting', 'context')),
      owner_key varchar(160) NOT NULL,
      source_tier varchar(24) NOT NULL
        CHECK (source_tier IN ('primary', 'official', 'tier_1', 'tier_2', 'unverified')),
      credible boolean NOT NULL DEFAULT false,
      label text NOT NULL,
      url text,
      excerpt text NOT NULL DEFAULT '',
      notes text NOT NULL DEFAULT '',
      captured_at timestamptz NOT NULL DEFAULT now(),
      added_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_verification_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES news_events(id),
      reviewer_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      reviewer_label varchar(160) NOT NULL,
      decision varchar(24) NOT NULL CHECK (decision IN ('verified', 'rejected')),
      rationale text NOT NULL CHECK (length(trim(rationale)) >= 20),
      event_version integer NOT NULL CHECK (event_version > 0),
      criteria_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS newsroom_activity (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence bigserial NOT NULL UNIQUE,
      event_id uuid REFERENCES news_events(id),
      signal_id uuid REFERENCES news_signals(id),
      actor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      actor_label varchar(160) NOT NULL,
      action varchar(64) NOT NULL,
      from_state varchar(32),
      to_state varchar(32),
      summary text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  // External provider governance. Defaults keep every connector dark. Secrets
  // never land here — only env name lists and presence digests.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_providers (
      provider_key varchar(64) PRIMARY KEY,
      display_name varchar(200) NOT NULL,
      provider_kind varchar(32) NOT NULL
        CHECK (provider_kind IN ('stream', 'firehose', 'poll', 'query')),
      commercial_status varchar(32) NOT NULL DEFAULT 'review_required'
        CHECK (commercial_status IN ('approved', 'review_required', 'prohibited', 'enterprise')),
      commercial_notes text NOT NULL DEFAULT '',
      terms_url text,
      terms_reviewed_at timestamptz,
      terms_review_owner varchar(160) NOT NULL DEFAULT '',
      approval_owner varchar(160) NOT NULL DEFAULT '',
      approved_at timestamptz,
      next_review_at timestamptz,
      credential_env_names jsonb NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(credential_env_names) = 'array'),
      credential_presence varchar(24) NOT NULL DEFAULT 'absent'
        CHECK (credential_presence IN ('absent', 'present', 'invalid')),
      credential_presence_digest varchar(64)
        CHECK (
          credential_presence_digest IS NULL
          OR credential_presence_digest ~ '^[a-f0-9]{64}$'
        ),
      retention_posture jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(retention_posture) = 'object'),
      attribution_posture text NOT NULL DEFAULT '',
      allowed_use varchar(40) NOT NULL DEFAULT 'none'
        CHECK (allowed_use IN ('none', 'alerting_only', 'internal_display', 'corroboration_only')),
      monthly_spend_ceiling_cents integer
        CHECK (
          monthly_spend_ceiling_cents IS NULL
          OR monthly_spend_ceiling_cents >= 0
        ),
      config_enabled boolean NOT NULL DEFAULT false,
      cursor_kind varchar(32) NOT NULL DEFAULT 'none'
        CHECK (cursor_kind IN ('none', 'opaque', 'time_us', 'rss_etag', 'x_post_id')),
      last_success_at timestamptz,
      last_failure_at timestamptz,
      last_failure_summary text NOT NULL DEFAULT '',
      consecutive_failures integer NOT NULL DEFAULT 0
        CHECK (consecutive_failures >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT news_providers_approved_audit CHECK (
        commercial_status <> 'approved'
        OR (
          approved_at IS NOT NULL
          AND length(trim(approval_owner)) > 0
        )
      ),
      CONSTRAINT news_providers_enabled_requires_review_posture CHECK (
        config_enabled = false
        OR commercial_status IN ('approved', 'review_required')
      )
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_provider_leases (
      provider_key varchar(64) PRIMARY KEY
        REFERENCES news_providers(provider_key) ON DELETE RESTRICT,
      owner_id varchar(160) NOT NULL CHECK (length(trim(owner_id)) > 0),
      fence_token integer NOT NULL CHECK (fence_token > 0),
      acquired_at timestamptz NOT NULL,
      renewed_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      heartbeat_at timestamptz NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata) = 'object'),
      CONSTRAINT news_provider_leases_time_order CHECK (
        renewed_at >= acquired_at
        AND heartbeat_at >= acquired_at
        AND expires_at > acquired_at
      )
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_provider_checkpoints (
      provider_key varchar(64) PRIMARY KEY
        REFERENCES news_providers(provider_key) ON DELETE RESTRICT,
      cursor_kind varchar(32) NOT NULL DEFAULT 'none'
        CHECK (cursor_kind IN ('none', 'opaque', 'time_us', 'rss_etag', 'x_post_id')),
      cursor_value text NOT NULL DEFAULT '',
      fence_token integer NOT NULL DEFAULT 0 CHECK (fence_token >= 0),
      last_committed_at timestamptz,
      last_observed_provider_at timestamptz,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata) = 'object'),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_provider_ingest_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_key varchar(64) NOT NULL
        REFERENCES news_providers(provider_key) ON DELETE RESTRICT,
      attempt_kind varchar(32) NOT NULL
        CHECK (attempt_kind IN (
          'connect', 'poll', 'parse', 'persist', 'checkpoint',
          'reconnect', 'rate_limit', 'shutdown', 'lease'
        )),
      outcome varchar(32) NOT NULL
        CHECK (outcome IN (
          'success', 'failure', 'rate_limited', 'skipped', 'duplicate', 'dead_lettered'
        )),
      started_at timestamptz NOT NULL,
      finished_at timestamptz NOT NULL,
      latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
      http_status integer CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
      retry_after_ms integer CHECK (retry_after_ms IS NULL OR retry_after_ms >= 0),
      fence_token integer CHECK (fence_token IS NULL OR fence_token > 0),
      cursor_before text,
      cursor_after text,
      external_id varchar(320),
      payload_hash varchar(64)
        CHECK (payload_hash IS NULL OR payload_hash ~ '^[a-f0-9]{64}$'),
      error_code varchar(80),
      error_summary text NOT NULL DEFAULT '',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata) = 'object'),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT news_provider_ingest_attempts_time_order CHECK (finished_at >= started_at)
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_provider_dead_letters (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_key varchar(64) NOT NULL
        REFERENCES news_providers(provider_key) ON DELETE RESTRICT,
      reason varchar(80) NOT NULL CHECK (length(trim(reason)) > 0),
      external_id varchar(320),
      payload_hash varchar(64)
        CHECK (payload_hash IS NULL OR payload_hash ~ '^[a-f0-9]{64}$'),
      observed_at timestamptz NOT NULL DEFAULT now(),
      error_summary text NOT NULL DEFAULT '',
      raw_provenance jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(raw_provenance) = 'object'),
      ingest_attempt_id uuid
        REFERENCES news_provider_ingest_attempts(id) ON DELETE RESTRICT,
      resolved_at timestamptz,
      resolution_summary text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT news_provider_dead_letters_resolution CHECK (
        (
          resolved_at IS NULL
          AND resolution_summary = ''
        )
        OR (
          resolved_at IS NOT NULL
          AND length(trim(resolution_summary)) >= 8
        )
      )
    );
  `);
  // First-party sports encyclopedia: public franchise identity only.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sports_leagues (
      league_key varchar(16) PRIMARY KEY,
      display_name varchar(120) NOT NULL,
      short_name varchar(16) NOT NULL,
      sport varchar(64) NOT NULL,
      governing_body varchar(160) NOT NULL,
      official_url text NOT NULL,
      team_count integer NOT NULL CHECK (team_count > 0),
      data_source text NOT NULL,
      data_source_url text NOT NULL,
      data_verified_date timestamptz NOT NULL,
      data_confidence varchar(24) NOT NULL DEFAULT 'VERIFIED'
        CHECK (data_confidence IN ('VERIFIED', 'CROSS_REFERENCED', 'FLAGGED')),
      data_notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sports_teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      league_key varchar(16) NOT NULL
        REFERENCES sports_leagues(league_key) ON DELETE RESTRICT,
      team_key varchar(80) NOT NULL,
      display_name varchar(160) NOT NULL,
      city varchar(80) NOT NULL,
      nickname varchar(80) NOT NULL,
      abbreviation varchar(8) NOT NULL,
      conference varchar(40),
      division varchar(40),
      founded_year integer CHECK (founded_year IS NULL OR founded_year BETWEEN 1800 AND 2100),
      official_url text NOT NULL,
      rankings_id varchar(40),
      data_source text NOT NULL,
      data_source_url text NOT NULL,
      data_verified_date timestamptz NOT NULL,
      data_confidence varchar(24) NOT NULL DEFAULT 'VERIFIED'
        CHECK (data_confidence IN ('VERIFIED', 'CROSS_REFERENCED', 'FLAGGED')),
      data_notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sports_people (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      person_key varchar(120) NOT NULL UNIQUE,
      full_name varchar(160) NOT NULL,
      common_name varchar(120) NOT NULL,
      role varchar(32) NOT NULL
        CHECK (role IN ('player', 'head_coach', 'general_manager', 'owner', 'executive')),
      league_key varchar(16) NOT NULL
        REFERENCES sports_leagues(league_key) ON DELETE RESTRICT,
      team_key varchar(80) NOT NULL,
      position_or_title varchar(80) NOT NULL DEFAULT '',
      summary text NOT NULL DEFAULT '',
      official_url text,
      data_source text NOT NULL,
      data_source_url text NOT NULL,
      data_verified_date timestamptz NOT NULL,
      data_confidence varchar(24) NOT NULL DEFAULT 'CROSS_REFERENCED'
        CHECK (data_confidence IN ('VERIFIED', 'CROSS_REFERENCED', 'FLAGGED')),
      data_notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS article_revisions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id uuid NOT NULL REFERENCES articles(id) ON DELETE RESTRICT,
      revision_number integer NOT NULL CHECK (revision_number > 0),
      content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
      snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
      created_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      source_event_id uuid REFERENCES news_events(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS article_publication_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id uuid NOT NULL REFERENCES articles(id) ON DELETE RESTRICT,
      revision_id uuid NOT NULL REFERENCES article_revisions(id) ON DELETE RESTRICT,
      content_hash varchar(64) NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
      action varchar(24) NOT NULL
        CHECK (action IN ('published', 'unpublished', 'legacy_backfill')),
      actor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      actor_label varchar(160) NOT NULL,
      exact_confirmation text NOT NULL DEFAULT '',
      rationale text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT article_publication_events_confirmation_check CHECK (
        (action = 'published' AND exact_confirmation = 'BRAD APPROVES THIS EXACT ARTICLE FOR PUBLICATION')
        OR (action <> 'published' AND exact_confirmation = '')
      )
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_event_articles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES news_events(id) ON DELETE RESTRICT,
      article_id uuid NOT NULL REFERENCES articles(id) ON DELETE RESTRICT,
      revision_id uuid NOT NULL REFERENCES article_revisions(id) ON DELETE RESTRICT,
      relation varchar(24) NOT NULL DEFAULT 'source' CHECK (relation = 'source'),
      actor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      actor_label varchar(160) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    ALTER TABLE news_evidence
    ADD COLUMN IF NOT EXISTS supersedes_evidence_id uuid REFERENCES news_evidence(id);
  `);
  // CREATE TABLE IF NOT EXISTS does not repair referential actions on an
  // already-deployed schema. Older newsroom ledgers used SET NULL and an
  // early publication migration used CASCADE; both can issue an implicit
  // UPDATE/DELETE that conflicts with the append-only triggers below. Replace
  // those historical foreign keys in place and validate every replacement.
  await db.execute(sql`
    DO $block$
    DECLARE
      desired record;
    BEGIN
      FOR desired IN
        SELECT *
        FROM (VALUES
          (
            'news_evidence',
            'news_evidence_source_id_fkey',
            'FOREIGN KEY (source_id) REFERENCES news_sources(id) ON DELETE RESTRICT'
          ),
          (
            'news_evidence',
            'news_evidence_signal_id_fkey',
            'FOREIGN KEY (signal_id) REFERENCES news_signals(id) ON DELETE RESTRICT'
          ),
          (
            'news_evidence',
            'news_evidence_added_by_fkey',
            'FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE RESTRICT'
          ),
          (
            'news_verification_reviews',
            'news_verification_reviews_reviewer_id_fkey',
            'FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT'
          ),
          (
            'newsroom_activity',
            'newsroom_activity_actor_user_id_fkey',
            'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT'
          ),
          (
            'article_revisions',
            'article_revisions_article_id_fkey',
            'FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT'
          ),
          (
            'article_revisions',
            'article_revisions_created_by_fkey',
            'FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT'
          ),
          (
            'article_revisions',
            'article_revisions_source_event_id_fkey',
            'FOREIGN KEY (source_event_id) REFERENCES news_events(id) ON DELETE RESTRICT'
          ),
          (
            'article_publication_events',
            'article_publication_events_article_id_fkey',
            'FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT'
          ),
          (
            'article_publication_events',
            'article_publication_events_revision_id_fkey',
            'FOREIGN KEY (revision_id) REFERENCES article_revisions(id) ON DELETE RESTRICT'
          ),
          (
            'article_publication_events',
            'article_publication_events_actor_user_id_fkey',
            'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT'
          ),
          (
            'news_event_articles',
            'news_event_articles_event_id_fkey',
            'FOREIGN KEY (event_id) REFERENCES news_events(id) ON DELETE RESTRICT'
          ),
          (
            'news_event_articles',
            'news_event_articles_article_id_fkey',
            'FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT'
          ),
          (
            'news_event_articles',
            'news_event_articles_revision_id_fkey',
            'FOREIGN KEY (revision_id) REFERENCES article_revisions(id) ON DELETE RESTRICT'
          ),
          (
            'news_event_articles',
            'news_event_articles_actor_user_id_fkey',
            'FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT'
          )
        ) AS desired_fks(table_name, constraint_name, definition)
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = desired.constraint_name
            AND conrelid = to_regclass(desired.table_name)
            AND contype = 'f'
            AND confdeltype = 'r'
        ) THEN
          EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
            desired.table_name,
            desired.constraint_name
          );
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I %s NOT VALID',
            desired.table_name,
            desired.constraint_name,
            desired.definition
          );
        END IF;

        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = desired.constraint_name
            AND conrelid = to_regclass(desired.table_name)
            AND convalidated = false
        ) THEN
          EXECUTE format(
            'ALTER TABLE %I VALIDATE CONSTRAINT %I',
            desired.table_name,
            desired.constraint_name
          );
        END IF;
      END LOOP;
    END;
    $block$;
  `);
  // Database-enforced append-only ledgers. Corrections and reversals are new
  // rows; UPDATE/DELETE can never rewrite the historical verification basis.
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION bbsports_reject_newsroom_ledger_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      RAISE EXCEPTION '% is append-only; append a superseding record instead', TG_TABLE_NAME
        USING ERRCODE = '55000';
    END;
    $function$;
  `);
  await db.execute(sql`
    DO $block$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'news_evidence_append_only'
          AND tgrelid = 'news_evidence'::regclass
      ) THEN
        CREATE TRIGGER news_evidence_append_only
        BEFORE UPDATE OR DELETE ON news_evidence
        FOR EACH ROW EXECUTE FUNCTION bbsports_reject_newsroom_ledger_mutation();
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'news_verification_reviews_append_only'
          AND tgrelid = 'news_verification_reviews'::regclass
      ) THEN
        CREATE TRIGGER news_verification_reviews_append_only
        BEFORE UPDATE OR DELETE ON news_verification_reviews
        FOR EACH ROW EXECUTE FUNCTION bbsports_reject_newsroom_ledger_mutation();
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'newsroom_activity_append_only'
          AND tgrelid = 'newsroom_activity'::regclass
      ) THEN
        CREATE TRIGGER newsroom_activity_append_only
        BEFORE UPDATE OR DELETE ON newsroom_activity
        FOR EACH ROW EXECUTE FUNCTION bbsports_reject_newsroom_ledger_mutation();
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'news_provider_ingest_attempts_append_only'
          AND tgrelid = 'news_provider_ingest_attempts'::regclass
      ) THEN
        CREATE TRIGGER news_provider_ingest_attempts_append_only
        BEFORE UPDATE OR DELETE ON news_provider_ingest_attempts
        FOR EACH ROW EXECUTE FUNCTION bbsports_reject_newsroom_ledger_mutation();
      END IF;
    END;
    $block$;
  `);
  // Dead letters are append-only for provenance. The only allowed mutation is a
  // one-shot resolve that sets resolved_at + resolution_summary and nothing else.
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION bbsports_guard_news_provider_dead_letter()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'news_provider_dead_letters is append-only; resolve instead of delete'
          USING ERRCODE = '55000';
      END IF;
      IF OLD.resolved_at IS NOT NULL THEN
        RAISE EXCEPTION 'news_provider_dead_letters cannot be changed after resolution'
          USING ERRCODE = '55000';
      END IF;
      IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.provider_key IS DISTINCT FROM OLD.provider_key
        OR NEW.reason IS DISTINCT FROM OLD.reason
        OR NEW.external_id IS DISTINCT FROM OLD.external_id
        OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
        OR NEW.observed_at IS DISTINCT FROM OLD.observed_at
        OR NEW.error_summary IS DISTINCT FROM OLD.error_summary
        OR NEW.raw_provenance IS DISTINCT FROM OLD.raw_provenance
        OR NEW.ingest_attempt_id IS DISTINCT FROM OLD.ingest_attempt_id
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
      THEN
        RAISE EXCEPTION 'news_provider_dead_letters may only set resolution fields'
          USING ERRCODE = '55000';
      END IF;
      IF NEW.resolved_at IS NULL OR length(trim(NEW.resolution_summary)) < 8 THEN
        RAISE EXCEPTION 'news_provider_dead_letters resolution requires resolved_at and summary'
          USING ERRCODE = '55000';
      END IF;
      RETURN NEW;
    END;
    $function$;
  `);
  await db.execute(sql`
    DO $block$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'news_provider_dead_letters_guard'
          AND tgrelid = 'news_provider_dead_letters'::regclass
      ) THEN
        CREATE TRIGGER news_provider_dead_letters_guard
        BEFORE UPDATE OR DELETE ON news_provider_dead_letters
        FOR EACH ROW EXECUTE FUNCTION bbsports_guard_news_provider_dead_letter();
      END IF;
    END;
    $block$;
  `);
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION bbsports_reject_publication_ledger_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      RAISE EXCEPTION '% is append-only; append a new publication record instead', TG_TABLE_NAME
        USING ERRCODE = '55000';
    END;
    $function$;
  `);
  await db.execute(sql`
    DO $block$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'article_revisions_append_only'
          AND tgrelid = 'article_revisions'::regclass
      ) THEN
        CREATE TRIGGER article_revisions_append_only
        BEFORE UPDATE OR DELETE ON article_revisions
        FOR EACH ROW EXECUTE FUNCTION bbsports_reject_publication_ledger_mutation();
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'article_publication_events_append_only'
          AND tgrelid = 'article_publication_events'::regclass
      ) THEN
        CREATE TRIGGER article_publication_events_append_only
        BEFORE UPDATE OR DELETE ON article_publication_events
        FOR EACH ROW EXECUTE FUNCTION bbsports_reject_publication_ledger_mutation();
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'news_event_articles_append_only'
          AND tgrelid = 'news_event_articles'::regclass
      ) THEN
        CREATE TRIGGER news_event_articles_append_only
        BEFORE UPDATE OR DELETE ON news_event_articles
        FOR EACH ROW EXECUTE FUNCTION bbsports_reject_publication_ledger_mutation();
      END IF;
    END;
    $block$;
  `);
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION bbsports_reject_article_origin_change()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      IF OLD.created_under_approval_gate IS DISTINCT FROM NEW.created_under_approval_gate THEN
        RAISE EXCEPTION 'article creation provenance is immutable'
          USING ERRCODE = '55000';
      END IF;
      RETURN NEW;
    END;
    $function$;
  `);
  await db.execute(sql`
    DO $block$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'articles_creation_provenance_immutable'
          AND tgrelid = 'articles'::regclass
      ) THEN
        CREATE TRIGGER articles_creation_provenance_immutable
        BEFORE UPDATE OF created_under_approval_gate ON articles
        FOR EACH ROW EXECUTE FUNCTION bbsports_reject_article_origin_change();
      END IF;
    END;
    $block$;
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published, published_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_articles_sport ON articles(sport);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_live_snapshot_slug ON articles ((published_snapshot->>'slug')) WHERE published = true AND published_snapshot IS NOT NULL;`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_articles_live_snapshot_sport ON articles ((published_snapshot->>'sport'), published_at DESC) WHERE published = true AND published_snapshot IS NOT NULL;`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status, updated_at DESC);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_unsubscribe_token ON newsletter_subscribers(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_donation_intents_status ON donation_intents(status, created_at DESC);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_donation_intents_checkout_session ON donation_intents(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_donation_intents_payment_intent ON donation_intents(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_media_assets_approved ON media_assets(approved, placement, updated_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_media_assets_request ON media_assets(request_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_article_public ON comments(article_id, status, created_at ASC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_ip_recent ON comments(ip_address, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time ON analytics_events(event_name, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_path_time ON analytics_events(path, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_sources_enabled_tier ON news_sources(enabled, tier);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_sources_owner ON news_sources(owner_key);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_sources_commercial ON news_sources(commercial_status);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_signals_source_time ON news_signals(source_id, observed_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_signals_published_time ON news_signals(source_published_at DESC);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_news_signals_source_external ON news_signals(source_id, external_id) WHERE external_id IS NOT NULL;`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_news_signals_exact_url ON news_signals(exact_url_hash) WHERE exact_url_hash IS NOT NULL;`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_news_signals_exact_content ON news_signals(exact_content_hash);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_events_state_urgency ON news_events(state, urgency, updated_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_events_last_signal ON news_events(last_signal_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_event_signals_signal ON news_event_signals(signal_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_evidence_event_time ON news_evidence(event_id, created_at ASC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_evidence_source ON news_evidence(source_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_evidence_signal ON news_evidence(signal_id);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_news_evidence_supersedes ON news_evidence(supersedes_evidence_id) WHERE supersedes_evidence_id IS NOT NULL;`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_evidence_owner_stance ON news_evidence(owner_key, stance);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_verification_event_time ON news_verification_reviews(event_id, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_verification_reviewer ON news_verification_reviews(reviewer_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_newsroom_activity_sequence ON newsroom_activity(sequence);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_newsroom_activity_event_sequence ON newsroom_activity(event_id, sequence);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_newsroom_activity_signal ON newsroom_activity(signal_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_newsroom_activity_actor ON newsroom_activity(actor_user_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_providers_commercial ON news_providers(commercial_status);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_providers_enabled ON news_providers(config_enabled);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_providers_kind ON news_providers(provider_kind);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_provider_leases_expires ON news_provider_leases(expires_at);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_provider_leases_owner ON news_provider_leases(owner_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_provider_checkpoints_updated ON news_provider_checkpoints(updated_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_provider_ingest_provider_time ON news_provider_ingest_attempts(provider_key, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_provider_ingest_outcome ON news_provider_ingest_attempts(outcome, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_provider_ingest_external ON news_provider_ingest_attempts(provider_key, external_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_provider_ingest_payload ON news_provider_ingest_attempts(payload_hash);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_provider_dead_letters_open ON news_provider_dead_letters(provider_key, resolved_at);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_provider_dead_letters_payload ON news_provider_dead_letters(payload_hash);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_provider_dead_letters_external ON news_provider_dead_letters(provider_key, external_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sports_leagues_short ON sports_leagues(short_name);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_sports_teams_league_key ON sports_teams(league_key, team_key);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_sports_teams_league_abbr ON sports_teams(league_key, abbreviation);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sports_teams_rankings ON sports_teams(rankings_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sports_teams_city ON sports_teams(city);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sports_people_league_team ON sports_people(league_key, team_key);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sports_people_role ON sports_people(role);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sports_people_name ON sports_people(common_name);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_article_revisions_article_number ON article_revisions(article_id, revision_number);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_article_revisions_article_hash ON article_revisions(article_id, content_hash);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_article_revisions_article_id_id ON article_revisions(article_id, id);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_article_revisions_article_id_id_hash ON article_revisions(article_id, id, content_hash);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_revisions_created_by ON article_revisions(created_by);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_revisions_source_event ON article_revisions(source_event_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_publication_events_article_time ON article_publication_events(article_id, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_publication_events_revision ON article_publication_events(revision_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_publication_events_actor ON article_publication_events(actor_user_id);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_article_publication_events_legacy_once ON article_publication_events(article_id) WHERE action = 'legacy_backfill';`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_news_event_articles_event_relation ON news_event_articles(event_id, relation);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_news_event_articles_article_event ON news_event_articles(article_id, event_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_event_articles_article ON news_event_articles(article_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_event_articles_revision ON news_event_articles(revision_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_news_event_articles_actor ON news_event_articles(actor_user_id);`);

  // Credential-free intake source. It records a human newsroom observation but
  // is intentionally unverified, so it can never satisfy corroboration alone.
  await db
    .insert(newsSources)
    .values({
      sourceKey: 'manual-newsroom',
      displayName: 'BB Sports newsroom manual intake',
      sourceType: 'manual',
      ownerKey: 'bb-sports',
      tier: 'unverified',
      commercialStatus: 'approved',
      commercialNotes: 'First-party manual intake; not independent verification.',
      enabled: true,
    })
    .onConflictDoNothing({ target: newsSources.sourceKey });

  // External providers seed dark: review_required, config_enabled=false, no secrets.
  // Matching intake sources stay disabled so the ingest transaction fails closed
  // until commercial approval + config enablement intentionally turn them on.
  for (const providerKey of NEWSROOM_PROVIDER_KEYS) {
    const entry = NEWSROOM_PROVIDER_CATALOG[providerKey];
    await db
      .insert(newsProviders)
      .values({
        providerKey: entry.providerKey,
        displayName: entry.displayName,
        providerKind: entry.providerKind,
        commercialStatus: entry.commercialStatus,
        commercialNotes: entry.commercialNotes,
        termsUrl: entry.termsUrl,
        credentialEnvNames: [...entry.credentialEnvNames],
        credentialPresence: 'absent',
        retentionPosture: entry.retentionPosture,
        attributionPosture: entry.attributionPosture,
        allowedUse: entry.allowedUse,
        configEnabled: entry.configEnabledDefault,
        cursorKind: entry.cursorKind,
      })
      .onConflictDoNothing({ target: newsProviders.providerKey });

    await db
      .insert(newsSources)
      .values({
        sourceKey: `provider-intake:${providerKey}`,
        displayName: `${entry.displayName} intake`,
        sourceType: 'provider_intake',
        ownerKey: `provider:${providerKey}`,
        tier: 'unverified',
        commercialStatus: 'review_required',
        commercialNotes:
          'Synthetic provider intake source. Disabled until the matching provider is commercially approved and config-enabled. Never independent verification by itself.',
        homepageUrl: entry.termsUrl,
        enabled: false,
      })
      .onConflictDoNothing({ target: newsSources.sourceKey });
  }

  // First-party sports encyclopedia seeds (public franchise identity only).
  const sportsVerifiedAt = new Date('2026-07-15T00:00:00.000Z');
  for (const league of LEAGUE_SEEDS) {
    await db
      .insert(sportsLeagues)
      .values({
        leagueKey: league.leagueKey,
        displayName: league.displayName,
        shortName: league.shortName,
        sport: league.sport,
        governingBody: league.governingBody,
        officialUrl: league.officialUrl,
        teamCount: league.teamCount,
        dataSource: league.dataSource,
        dataSourceUrl: league.dataSourceUrl,
        dataVerifiedDate: sportsVerifiedAt,
        dataConfidence: league.dataConfidence,
        dataNotes: league.dataNotes ?? '',
      })
      .onConflictDoNothing({ target: sportsLeagues.leagueKey });
  }
  for (const team of TEAM_SEEDS) {
    await db
      .insert(sportsTeams)
      .values({
        leagueKey: team.leagueKey,
        teamKey: team.teamKey,
        displayName: team.displayName,
        city: team.city,
        nickname: team.nickname,
        abbreviation: team.abbreviation,
        conference: team.conference,
        division: team.division,
        foundedYear: team.foundedYear,
        officialUrl: team.officialUrl,
        rankingsId: team.rankingsId,
        dataSource: team.dataSource,
        dataSourceUrl: team.dataSourceUrl,
        dataVerifiedDate: sportsVerifiedAt,
        dataConfidence: team.dataConfidence,
        dataNotes: team.dataNotes ?? '',
      })
      .onConflictDoNothing({ target: [sportsTeams.leagueKey, sportsTeams.teamKey] });
  }
  for (const person of PERSON_SEEDS) {
    await db
      .insert(sportsPeople)
      .values({
        personKey: person.personKey,
        fullName: person.fullName,
        commonName: person.commonName,
        role: person.role,
        leagueKey: person.leagueKey,
        teamKey: person.teamKey,
        positionOrTitle: person.positionOrTitle,
        summary: person.summary,
        officialUrl: person.officialUrl,
        dataSource: person.dataSource,
        dataSourceUrl: person.dataSourceUrl,
        dataVerifiedDate: sportsVerifiedAt,
        dataConfidence: person.dataConfidence,
        dataNotes: person.dataNotes ?? '',
      })
      .onConflictDoNothing({ target: sportsPeople.personKey });
  }

  // 2. Admin user seed (idempotent ON CONFLICT DO NOTHING).
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  const adminName = process.env.ADMIN_NAME ?? 'Bradley Benson';
  let adminId: string | null = null;
  if (adminEmail && adminHash) {
    const inserted = await db
      .insert(users)
      .values({
        email: adminEmail.toLowerCase(),
        passwordHash: adminHash,
        name: adminName,
        role: 'super_admin',
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (inserted[0]) {
      adminId = inserted[0].id;
    } else {
      const existing = await db.execute(sql`SELECT id FROM users WHERE email = ${adminEmail.toLowerCase()} LIMIT 1`);
      const row = (existing as unknown as { id: string }[])[0];
      adminId = row?.id ?? null;
    }
  }

  // 3. site_config defaults — only insert keys that are missing.
  const defaults: Record<string, unknown> = {
    breaking_ticker: [
      { sport: 'NFL', text: "Bears 24, Vikings 17 — Caleb's first real road win." },
      { sport: 'MLB', text: 'Yankees just dropped 8 slots on the franchise rankings. Read why.' },
      { sport: 'CFB', text: "Florida-Georgia preview drops next month. Yes, I'm biased." },
      { sport: 'NHL', text: 'Wild-Avs Game 1 was a 9–6 firework show.' },
      { sport: 'PL', text: "Man United's 'rebuild' is the longest-running take from Brad." },
    ],
    hero: {
      version: 2,
      eyebrow: 'SOFT LAUNCH',
      headline: "Sports from\nthe fan's view.\nNo BS.",
      sub: 'Opinion-led NFL, MLB, NHL, NBA, college football, soccer, and MMA — bias turned all the way up. Founded and edited by',
      cta_primary: { label: 'Read the takes', href: '/articles' },
      cta_secondary: { label: 'Get the newsletter', href: '/#newsletter' },
    },
    about_bio: [
      "I'm Brad Benson, a journalism &amp; sports media major at the University of Florida (class of '27). I grew up in Chicago — where you bleed Bears, Bulls, Hawks, Cubs, and yelling at the TV is a love language.",
      "BB Sports is the place I write the way I'd talk to my friends about the game last night — but with the homework done. I do the research. I read the depth charts. I watch the All-22 if it matters. And then I tell you what I actually think.",
      "No BS means I won't give you fence-sitting takes to be safe. I'll be wrong sometimes. When I am, I say so on /corrections. That's the deal.",
    ],
    footer_tagline: "Sports from the fan's view. No BS.",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db
      .insert(siteConfig)
      .values({ key, value, updatedBy: adminId ?? undefined })
      .onConflictDoNothing({ target: siteConfig.key });
  }

  // 4. Draft import — only if articles table is empty (one-time on first boot).
  const countResult = await db.execute(sql`SELECT count(*)::int AS c FROM articles`);
  const count = (countResult as unknown as { c: number }[])[0]?.c ?? 0;
  if (count === 0) {
    const dir = path.join(process.cwd(), 'content', 'articles');
    let entries: string[] = [];
    try {
      entries = (await fs.readdir(dir)).filter((f) => f.endsWith('.md'));
    } catch {
      entries = [];
    }
    for (const file of entries) {
      const slug = file.replace(/\.md$/, '');
      const raw = await fs.readFile(path.join(dir, file), 'utf8');
      const { data, content } = matter(raw);
      await db
        .insert(articles)
        .values({
          slug,
          title: String(data.title ?? slug),
          dek: String(data.dek ?? data.description ?? ''),
          body: content.trim(),
          sport: String(data.sport ?? 'Op-Ed'),
          hero: String(data.hero ?? ''),
          heroAlt: String(data.heroAlt ?? ''),
          heroCredit: String(data.heroCredit ?? ''),
          authorId: adminId ?? undefined,
          authorName: String(data.author ?? 'Brad Benson'),
          aiAssisted: Boolean(data.aiAssisted),
          bradsTake: String(data.bradsTake ?? ''),
          // Repository content is an import candidate, not publication
          // approval. A fresh database must never manufacture a legacy live
          // state merely because a Markdown file exists.
          published: false,
          publishedAt: null,
        })
        .onConflictDoNothing({ target: articles.slug });
    }
  }

  // 5. Preserve every legacy live story as an immutable, content-addressed
  // revision before public queries begin serving snapshot-only content. The
  // per-article transaction and unique keys make crash/retry recovery safe.
  await backfillPublishedArticleSnapshots();

  // The composite key proves that a live pointer cannot reference another
  // article's revision or attach a different content hash to that revision.
  // It is added after legacy backfill, then fully validated; NOT VALID keeps
  // the initial DDL lock brief on an upgraded database.
  await db.execute(sql`
    DO $block$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'articles_published_revision_same_article'
          AND conrelid = 'articles'::regclass
          AND position(
            'published_content_hash'
            IN lower(pg_get_constraintdef(oid))
          ) = 0
      ) THEN
        ALTER TABLE articles
        DROP CONSTRAINT articles_published_revision_same_article;
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'articles_published_revision_same_article'
          AND conrelid = 'articles'::regclass
      ) THEN
        ALTER TABLE articles
        ADD CONSTRAINT articles_published_revision_same_article
        FOREIGN KEY (id, published_revision_id, published_content_hash)
        REFERENCES article_revisions(article_id, id, content_hash)
        ON DELETE RESTRICT
        NOT VALID;
      END IF;
    END;
    $block$;
  `);
  await db.execute(sql`
    DO $block$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'articles_published_revision_same_article'
          AND conrelid = 'articles'::regclass
          AND convalidated = false
      ) THEN
        ALTER TABLE articles
        VALIDATE CONSTRAINT articles_published_revision_same_article;
      END IF;
    END;
    $block$;
  `);

  // Audit rows cannot point at a revision owned by another article or claim a
  // different hash. Newsroom links receive the same same-article guarantee.
  await db.execute(sql`
    DO $block$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'article_publication_events_revision_integrity'
          AND conrelid = 'article_publication_events'::regclass
      ) THEN
        ALTER TABLE article_publication_events
        ADD CONSTRAINT article_publication_events_revision_integrity
        FOREIGN KEY (article_id, revision_id, content_hash)
        REFERENCES article_revisions(article_id, id, content_hash)
        NOT VALID;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'news_event_articles_revision_integrity'
          AND conrelid = 'news_event_articles'::regclass
      ) THEN
        ALTER TABLE news_event_articles
        ADD CONSTRAINT news_event_articles_revision_integrity
        FOREIGN KEY (article_id, revision_id)
        REFERENCES article_revisions(article_id, id)
        NOT VALID;
      END IF;
    END;
    $block$;
  `);
  await db.execute(sql`
    DO $block$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'article_publication_events_revision_integrity'
          AND conrelid = 'article_publication_events'::regclass
          AND convalidated = false
      ) THEN
        ALTER TABLE article_publication_events
        VALIDATE CONSTRAINT article_publication_events_revision_integrity;
      END IF;
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'news_event_articles_revision_integrity'
          AND conrelid = 'news_event_articles'::regclass
          AND convalidated = false
      ) THEN
        ALTER TABLE news_event_articles
        VALIDATE CONSTRAINT news_event_articles_revision_integrity;
      END IF;
    END;
    $block$;
  `);

  // Once legacy rows are reconciled, make it impossible for any old mutation
  // path to set `published = true` without all immutable publication pointers.
  await db.execute(sql`
    UPDATE articles
    SET published_at = NULL,
        published_snapshot = NULL,
        published_content_hash = NULL,
        published_revision_id = NULL
    WHERE published = false
      AND (
        published_at IS NOT NULL
        OR published_snapshot IS NOT NULL
        OR published_content_hash IS NOT NULL
        OR published_revision_id IS NOT NULL
      );
  `);
  await db.execute(sql`
    DO $block$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'articles_published_snapshot_complete'
          AND conrelid = 'articles'::regclass
          AND convalidated = false
      ) THEN
        ALTER TABLE articles
        VALIDATE CONSTRAINT articles_published_snapshot_complete;
      END IF;
    END;
    $block$;
  `);
}

async function loadRepositoryLegacyPublicationMetadata(): Promise<
  ReadonlyMap<string, RepositoryLegacyPublicationMetadata>
> {
  const directory = path.join(process.cwd(), 'content', 'articles');
  let entries: string[];
  try {
    entries = (await fs.readdir(directory)).filter((entry) => entry.endsWith('.md')).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map();
    throw new Error('Repository publication metadata directory could not be read safely.');
  }

  const metadataByExactSlug = new Map<string, RepositoryLegacyPublicationMetadata>();
  for (const entry of entries) {
    let data: Record<string, unknown>;
    try {
      const parsed = matter(await fs.readFile(path.join(directory, entry), 'utf8'));
      data = parsed.data;
    } catch {
      throw new Error('Repository publication metadata could not be parsed safely.');
    }
    if (typeof data.slug !== 'string' || data.slug.length === 0) continue;
    if (metadataByExactSlug.has(data.slug)) {
      throw new Error('Repository publication metadata contains an ambiguous exact slug.');
    }
    metadataByExactSlug.set(data.slug, {
      slug: data.slug,
      hero: typeof data.hero === 'string' ? data.hero : '',
      heroAlt: typeof data.heroAlt === 'string' ? data.heroAlt : '',
      heroCredit: typeof data.heroCredit === 'string' ? data.heroCredit : '',
    });
  }
  return metadataByExactSlug;
}

async function backfillPublishedArticleSnapshots(): Promise<void> {
  if (!db) return;

  let repositoryMetadataPromise:
    | Promise<ReadonlyMap<string, RepositoryLegacyPublicationMetadata>>
    | null = null;

  while (true) {
    const candidates = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.published, true),
          sql`(
            ${articles.publishedSnapshot} IS NULL
            OR ${articles.publishedContentHash} IS NULL
            OR ${articles.publishedRevisionId} IS NULL
          )`,
        ),
      )
      .orderBy(articles.createdAt)
      .limit(100);
    if (candidates.length === 0) return;

    if (
      candidates.some((candidate) =>
        missingLegacyPublicationFields(candidate).some(
          (field) => field === 'heroAlt' || field === 'heroCredit',
        ),
      )
    ) {
      repositoryMetadataPromise ??= loadRepositoryLegacyPublicationMetadata();
    }

    for (const candidate of candidates) {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM articles WHERE id = ${candidate.id} FOR UPDATE`);
        const [current] = await tx
          .select()
          .from(articles)
          .where(eq(articles.id, candidate.id))
          .limit(1);
        if (
          !current?.published ||
          (current.publishedSnapshot &&
            current.publishedContentHash &&
            current.publishedRevisionId)
        ) {
          return;
        }

        const missingFields = missingLegacyPublicationFields(current);
        const needsRepositoryHeroMetadata = missingFields.some(
          (field) => field === 'heroAlt' || field === 'heroCredit',
        );
        if (needsRepositoryHeroMetadata) {
          repositoryMetadataPromise ??= loadRepositoryLegacyPublicationMetadata();
        }
        const repositoryMetadata = repositoryMetadataPromise
          ? (await repositoryMetadataPromise).get(current.slug)
          : undefined;
        const metadataPatch = completeLegacyPublicationMetadata(
          current,
          repositoryMetadata,
        );
        const completedWorkingCopy = { ...current, ...metadataPatch };

        const internalHeroMediaId = articleHeroMediaAssetId(current.hero);
        if (internalHeroMediaId) {
          const [heroAsset] = await tx
            .select({
              kind: mediaAssets.kind,
              status: mediaAssets.status,
              contentType: mediaAssets.contentType,
              approved: mediaAssets.approved,
              hasBytes: sql<boolean>`length(${mediaAssets.dataBase64}) > 0`,
            })
            .from(mediaAssets)
            .where(eq(mediaAssets.id, internalHeroMediaId))
            .limit(1);
          if (
            !heroAsset ||
            heroAsset.kind !== 'image' ||
            heroAsset.status !== 'ready' ||
            !heroAsset.approved ||
            !/^image\/(?:jpeg|png|webp)$/i.test(heroAsset.contentType) ||
            !heroAsset.hasBytes
          ) {
            throw new Error(
              `Legacy live article ${current.id} references an unavailable publication hero.`,
            );
          }
        }

        let snapshot: ArticlePublicationSnapshot;
        try {
          snapshot = normalizeArticlePublicationSnapshot({
            slug: completedWorkingCopy.slug,
            title: completedWorkingCopy.title,
            dek: completedWorkingCopy.dek,
            body: completedWorkingCopy.body,
            sport: completedWorkingCopy.sport,
            hero: completedWorkingCopy.hero,
            heroAlt: completedWorkingCopy.heroAlt,
            heroCredit: completedWorkingCopy.heroCredit,
            authorName: completedWorkingCopy.authorName,
            aiAssisted: completedWorkingCopy.aiAssisted,
            bradsTake: completedWorkingCopy.bradsTake,
          });
        } catch (error) {
          throw legacyPublicationMetadataError(
            current,
            redactedPublicationValidationFields(error),
            'publication snapshot validation failed',
          );
        }
        const contentHash = hashArticlePublicationSnapshot(snapshot);

        let [revision] = await tx
          .select()
          .from(articleRevisions)
          .where(
            and(
              eq(articleRevisions.articleId, current.id),
              eq(articleRevisions.contentHash, contentHash),
            ),
          )
          .limit(1);
        if (!revision) {
          const [counter] = await tx
            .select({
              maximum: sql<number>`coalesce(max(${articleRevisions.revisionNumber}), 0)::int`,
            })
            .from(articleRevisions)
            .where(eq(articleRevisions.articleId, current.id));
          [revision] = await tx
            .insert(articleRevisions)
            .values({
              articleId: current.id,
              revisionNumber: (counter?.maximum ?? 0) + 1,
              contentHash,
              snapshot,
              createdBy: current.authorId,
            })
            .returning();
        }
        if (!revision) {
          throw new Error(`Could not preserve legacy article revision ${current.id}.`);
        }
        const preservedRevisionSnapshot = normalizeArticlePublicationSnapshot(revision.snapshot);
        if (
          revision.contentHash !== contentHash ||
          hashArticlePublicationSnapshot(preservedRevisionSnapshot) !== contentHash ||
          JSON.stringify(preservedRevisionSnapshot) !== JSON.stringify(snapshot)
        ) {
          throw new Error(`Legacy article revision integrity check failed for ${current.id}.`);
        }

        await tx
          .insert(articlePublicationEvents)
          .values({
            articleId: current.id,
            revisionId: revision.id,
            contentHash,
            action: 'legacy_backfill',
            actorUserId: null,
            actorLabel: 'BB Sports legacy bootstrap',
            exactConfirmation: '',
            rationale: 'Preserved the previously public article during immutable publication migration.',
          })
          .onConflictDoNothing();

        if (Object.keys(metadataPatch).length > 0) {
          await tx.execute(
            sql`SELECT set_config('bbsports.article_legacy_metadata_backfill_contract', 'v1', true)`,
          );
        }

        const updatePredicates = [
          eq(articles.id, current.id),
          eq(articles.published, true),
          eq(articles.slug, current.slug),
          eq(articles.hero, current.hero),
          isNull(articles.publishedSnapshot),
          isNull(articles.publishedContentHash),
          isNull(articles.publishedRevisionId),
        ];
        if (metadataPatch.heroAlt !== undefined) {
          updatePredicates.push(sql`length(trim(${articles.heroAlt})) = 0`);
        }
        if (metadataPatch.heroCredit !== undefined) {
          updatePredicates.push(sql`length(trim(${articles.heroCredit})) = 0`);
        }

        const updated = await tx
          .update(articles)
          .set({
            ...metadataPatch,
            publishedSnapshot: snapshot,
            publishedContentHash: contentHash,
            publishedRevisionId: revision.id,
          })
          .where(and(...updatePredicates))
          .returning({ id: articles.id });
        if (updated.length !== 1) {
          throw legacyPublicationMetadataError(
            current,
            Object.keys(metadataPatch),
            'the guarded atomic metadata and publication-pointer update did not apply',
          );
        }

        const [preserved] = await tx
          .select()
          .from(articles)
          .where(eq(articles.id, current.id))
          .limit(1);
        if (!preserved?.publishedSnapshot) {
          throw legacyPublicationMetadataError(
            current,
            [],
            'the guarded backfill row and publication snapshot could not be reread',
          );
        }
        let preservedPublishedSnapshot: ArticlePublicationSnapshot;
        let rereadSnapshot: ArticlePublicationSnapshot;
        try {
          preservedPublishedSnapshot = normalizeArticlePublicationSnapshot(
            preserved.publishedSnapshot,
          );
          rereadSnapshot = normalizeArticlePublicationSnapshot({
            slug: preserved.slug,
            title: preserved.title,
            dek: preserved.dek,
            body: preserved.body,
            sport: preserved.sport,
            hero: preserved.hero,
            heroAlt: preserved.heroAlt,
            heroCredit: preserved.heroCredit,
            authorName: preserved.authorName,
            aiAssisted: preserved.aiAssisted,
            bradsTake: preserved.bradsTake,
          });
        } catch (error) {
          throw legacyPublicationMetadataError(
            current,
            redactedPublicationValidationFields(error),
            'the guarded backfill reread failed publication validation',
          );
        }
        if (
          preserved.publishedContentHash !== contentHash ||
          preserved.publishedRevisionId !== revision.id ||
          JSON.stringify(preservedPublishedSnapshot) !== JSON.stringify(snapshot) ||
          JSON.stringify(rereadSnapshot) !== JSON.stringify(snapshot)
        ) {
          throw legacyPublicationMetadataError(
            current,
            Object.keys(metadataPatch),
            'the guarded backfill reread did not match its immutable revision',
          );
        }
      });
    }
  }
}
