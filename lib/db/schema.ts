/**
 * BB Sports — database schema (Drizzle ORM, Postgres).
 *
 * Tables:
 *   users         — admin accounts (Bradley is the seed super-admin).
 *   articles      — blog posts. Migrated from /content/articles markdown on first boot.
 *   site_config   — key/value settings the admin can edit (breaking ticker, hero, about bio).
 *   sessions      — JWT session log (for audit + revoke). Cookie carries the JWT, this is for traceability.
 *   newsletter_subscribers — first-party newsletter list + consent ledger.
 *   contact_messages       — tips, press, sponsorship, and general inbox.
 *   donation_intents       — supporter-interest ledger before Stripe Checkout opens.
 *   media_assets           — internally tracked AI/generated/editorial media library.
 *
 * All timestamps stored as Postgres `timestamptz`. All ids are uuid v4.
 */
import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  integer,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// ---------- users ----------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  role: varchar('role', { length: 24 }).notNull().default('admin'), // 'super_admin' | 'admin' | 'editor'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- articles ----------
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 200 }).notNull().unique(),
  title: text('title').notNull(),
  dek: text('dek').notNull().default(''),
  body: text('body').notNull().default(''), // markdown source
  sport: varchar('sport', { length: 24 }).notNull().default('Op-Ed'),
  hero: text('hero').notNull().default(''), // hero image URL or empty
  heroAlt: text('hero_alt').notNull().default(''),     // alt text for the hero
  heroCredit: text('hero_credit').notNull().default(''), // photo credit line
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  authorName: varchar('author_name', { length: 120 }).notNull().default('Brad Benson'),
  // AI-assisted label: when true, the public article page renders the
  // "AI · Brad-edited" badge. Required by the editorial standards for any
  // piece where AI did the heavy lift of the draft.
  aiAssisted: boolean('ai_assisted').notNull().default(false),
  // "Brad's Take" — short personal commentary slot for AI-drafted pieces.
  // Optional plain text; the article page renders it as a callout block.
  bradsTake: text('brads_take').notNull().default(''),
  published: boolean('published').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- site_config ----------
export const siteConfig = pgTable('site_config', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ---------- sessions ----------
// Stores active sessions for audit. JWT is the source of truth for auth.
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  jwtId: varchar('jwt_id', { length: 64 }).notNull().unique(), // jti claim
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

// ---------- newsletter_subscribers ----------
export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  status: varchar('status', { length: 24 }).notNull().default('subscribed'),
  unsubscribeToken: varchar('unsubscribe_token', { length: 96 }).unique(),
  source: varchar('source', { length: 80 }).notNull().default('site'),
  consentText: text('consent_text').notNull().default('Newsletter signup on BB Sports. No spam. Unsubscribe in one click.'),
  consentVersion: varchar('consent_version', { length: 32 }).notNull().default('2026-05-07'),
  signupCount: integer('signup_count').notNull().default(1),
  lastIpAddress: varchar('last_ip_address', { length: 64 }),
  lastUserAgent: text('last_user_agent'),
  welcomeSentAt: timestamp('welcome_sent_at', { withTimezone: true }),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- contact_messages ----------
export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  mode: varchar('mode', { length: 24 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 120 }).notNull().default(''),
  message: text('message').notNull(),
  confidential: boolean('confidential').notNull().default(false),
  status: varchar('status', { length: 24 }).notNull().default('new'),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- donation_intents ----------
export const donationIntents = pgTable('donation_intents', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }),
  name: varchar('name', { length: 120 }).notNull().default(''),
  amountCents: integer('amount_cents'),
  message: text('message').notNull().default(''),
  source: varchar('source', { length: 80 }).notNull().default('site'),
  status: varchar('status', { length: 32 }).notNull().default('waiting_for_stripe'),
  stripePaymentLink: text('stripe_payment_link'),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- media_assets ----------
export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: varchar('kind', { length: 24 }).notNull().default('image'),
  status: varchar('status', { length: 32 }).notNull().default('ready'),
  title: text('title').notNull().default(''),
  sport: varchar('sport', { length: 40 }).notNull().default('general'),
  placement: varchar('placement', { length: 40 }).notNull().default('homepage'),
  prompt: text('prompt').notNull().default(''),
  provider: varchar('provider', { length: 40 }).notNull().default('xai'),
  model: varchar('model', { length: 80 }).notNull().default(''),
  assetUrl: text('asset_url').notNull().default(''),
  externalUrl: text('external_url').notNull().default(''),
  contentType: varchar('content_type', { length: 80 }).notNull().default(''),
  dataBase64: text('data_base64').notNull().default(''),
  altText: text('alt_text').notNull().default(''),
  credit: text('credit').notNull().default('AI-generated via xAI Grok; approved by BB Sports.'),
  aspectRatio: varchar('aspect_ratio', { length: 16 }).notNull().default('16:9'),
  resolution: varchar('resolution', { length: 16 }).notNull().default(''),
  durationSeconds: integer('duration_seconds'),
  animated: boolean('animated').notNull().default(false),
  approved: boolean('approved').notNull().default(false),
  requestId: varchar('request_id', { length: 160 }),
  rawResponse: jsonb('raw_response'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- comments ----------
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'set null' }),
  authorName: varchar('author_name', { length: 80 }).notNull(),
  authorEmail: varchar('author_email', { length: 255 }),
  body: text('body').notNull(),
  status: varchar('status', { length: 24 }).notNull().default('pending'),
  moderationReason: text('moderation_reason').notNull().default(''),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- type exports ----------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type SiteConfigRow = typeof siteConfig.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type DonationIntent = typeof donationIntents.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
export type Comment = typeof comments.$inferSelect;
