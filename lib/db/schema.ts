/**
 * BB Sports — database schema (Drizzle ORM, Postgres).
 *
 * Tables:
 *   users         — admin accounts (Bradley is the seed super-admin).
 *   articles      — blog posts. Migrated from /content/articles markdown on first boot.
 *   site_config   — key/value settings the admin can edit (breaking ticker, hero, about bio).
 *   sessions      — JWT session log (for audit + revoke). Cookie carries the JWT, this is for traceability.
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

// ---------- type exports ----------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type SiteConfigRow = typeof siteConfig.$inferSelect;
export type Session = typeof sessions.$inferSelect;
