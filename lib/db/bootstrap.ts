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
import { sql } from 'drizzle-orm';
import { db, dbAvailable } from './client';
import { users, articles, siteConfig, newsSources } from './schema';

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
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  // Forward-compat: ALTER TABLE for older databases that were bootstrapped
  // before these columns existed. Idempotent — IF NOT EXISTS is supported on
  // ADD COLUMN in Postgres 9.6+.
  await db.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS hero_alt text NOT NULL DEFAULT '';`);
  await db.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS hero_credit text NOT NULL DEFAULT '';`);
  await db.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_assisted boolean NOT NULL DEFAULT false;`);
  await db.execute(sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS brads_take text NOT NULL DEFAULT '';`);
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
      source_id uuid REFERENCES news_sources(id) ON DELETE SET NULL,
      signal_id uuid REFERENCES news_signals(id) ON DELETE SET NULL,
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
      added_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS news_verification_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES news_events(id),
      reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
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
      actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      actor_label varchar(160) NOT NULL,
      action varchar(64) NOT NULL,
      from_state varchar(32),
      to_state varchar(32),
      summary text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    ALTER TABLE news_evidence
    ADD COLUMN IF NOT EXISTS supersedes_evidence_id uuid REFERENCES news_evidence(id);
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
    END;
    $block$;
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published, published_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_articles_sport ON articles(sport);`);
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

  // 4. Articles seed — only if articles table is empty (one-time on first boot).
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
          published: true,
          publishedAt: data.date ? new Date(String(data.date)) : new Date(),
        })
        .onConflictDoNothing({ target: articles.slug });
    }
  }
}
