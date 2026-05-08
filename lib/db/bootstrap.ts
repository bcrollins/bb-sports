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
import { users, articles, siteConfig } from './schema';

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
      unsubscribed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token varchar(96);`);
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
      ip_address varchar(64),
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
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
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published, published_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_articles_sport ON articles(sport);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status, updated_at DESC);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_unsubscribe_token ON newsletter_subscribers(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_donation_intents_status ON donation_intents(status, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_media_assets_approved ON media_assets(approved, placement, updated_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_media_assets_request ON media_assets(request_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_article_public ON comments(article_id, status, created_at ASC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_ip_recent ON comments(ip_address, created_at DESC);`);

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
      { sport: 'CFB', text: "Florida-Georgia preview drops next month. Yes, I'm biased." },
      { sport: 'NHL', text: 'Wild-Avs Game 1 was a 9–6 firework show.' },
      { sport: 'PL', text: "Man United's 'rebuild' is the longest-running take from Brad." },
    ],
    hero: {
      version: 2,
      eyebrow: 'SOFT LAUNCH',
      headline: "Sports from\nthe fan's view.\nNo bullshit.",
      sub: 'Opinion-led NFL, NHL, college football, soccer, NBA, and MMA — written like a fan, sourced like a reporter. Founded and edited by',
      cta_primary: { label: 'Read the takes', href: '/articles' },
      cta_secondary: { label: 'Get the newsletter', href: '/#newsletter' },
    },
    about_bio: [
      "I'm Brad Benson, a journalism &amp; sports media major at the University of Florida (class of '27). I grew up in Chicago — where you bleed Bears, Bulls, Hawks, Cubs, and yelling at the TV is a love language.",
      "BB Sports is the place I write the way I'd talk to my friends about the game last night — but with the homework done. I do the research. I read the depth charts. I watch the All-22 if it matters. And then I tell you what I actually think.",
      "No bullshit means I won't give you fence-sitting takes to be safe. I'll be wrong sometimes. When I am, I say so on /corrections. That's the deal.",
    ],
    footer_tagline: "Sports from the fan's view. No bullshit.",
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
