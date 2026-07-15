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
 *   analytics_events       — first-party privacy-filtered behavior events.
 *   news_providers / leases / checkpoints / ingest_attempts / dead_letters
 *                 — external connector governance (seeded dark; no secrets).
 *   sports_leagues / sports_teams / sports_people
 *                 — first-party franchise encyclopedia (public identity + citations).
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
  bigserial,
  index,
  primaryKey,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { ArticlePublicationSnapshot } from '../article-publication';

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
  // Reader-visible content is served exclusively from this immutable,
  // content-addressed snapshot while `published` is true. Editors can keep
  // changing the working columns without silently changing the live story.
  publishedSnapshot: jsonb('published_snapshot').$type<ArticlePublicationSnapshot>(),
  publishedContentHash: varchar('published_content_hash', { length: 64 }),
  // Deliberately declared without an inline FK because article_revisions is
  // declared later. Bootstrap creates and validates the pointer atomically.
  publishedRevisionId: uuid('published_revision_id'),
  // False for every pre-gate/imported row. Only the modern draft-create path
  // sets this immutable provenance bit, so absence of newer ledgers can never
  // misclassify a legacy article as safe to hard-delete.
  createdUnderApprovalGate: boolean('created_under_approval_gate').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- publication_runtime_controls ----------
// Release-operator gate for published working-copy edits. Bootstrap installs
// the guarded transition trigger; application requests can read this state but
// cannot enable or disable it without the operational activation contract.
export const publicationRuntimeControls = pgTable('publication_runtime_controls', {
  controlKey: varchar('control_key', { length: 80 }).primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  deploymentSha: varchar('deployment_sha', { length: 64 }),
  changedAt: timestamp('changed_at', { withTimezone: true }),
  changedBy: varchar('changed_by', { length: 160 }).notNull().default(''),
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

// ---------- editorial_findings ----------
// Disputed/stale claims awaiting Brad-approved correction. Never auto-rewrite.
export const editorialFindings = pgTable(
  'editorial_findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    findingKey: varchar('finding_key', { length: 120 }).notNull().unique(),
    articleSlug: varchar('article_slug', { length: 200 }).notNull(),
    quotedClaim: text('quoted_claim').notNull(),
    findingType: varchar('finding_type', { length: 32 }).notNull(),
    severity: varchar('severity', { length: 8 }).notNull().default('P1'),
    evidenceNote: text('evidence_note').notNull().default(''),
    proposedCorrection: text('proposed_correction').notNull().default(''),
    state: varchar('state', { length: 32 }).notNull().default('open'),
    reviewerNote: text('reviewer_note').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_editorial_findings_slug_state').on(table.articleSlug, table.state),
    index('idx_editorial_findings_state').on(table.state),
  ],
);

// ---------- auth_attempts ----------
// Durable rate-limit ledger for gate + admin login. identity_hash is a
// privacy-safe digest (no raw passwords, no full raw IPs).
export const authAttempts = pgTable(
  'auth_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purpose: varchar('purpose', { length: 32 }).notNull(),
    identityHash: varchar('identity_hash', { length: 64 }).notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    failures: integer('failures').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_auth_attempts_purpose_identity').on(table.purpose, table.identityHash),
    index('idx_auth_attempts_locked_until').on(table.lockedUntil),
  ],
);

// ---------- newsletter_subscribers ----------
export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  status: varchar('status', { length: 24 }).notNull().default('subscribed'),
  unsubscribeToken: varchar('unsubscribe_token', { length: 96 }).unique(),
  source: varchar('source', { length: 80 }).notNull().default('site'),
  /** when_i_publish | weekly | major_only */
  frequency: varchar('frequency', { length: 32 }).notNull().default('when_i_publish'),
  /** Comma-separated sport keys; empty = all desk takes */
  topics: text('topics').notNull().default(''),
  consentText: text('consent_text').notNull().default('Newsletter signup on BB Sports. No spam. Unsubscribe in one click.'),
  consentVersion: varchar('consent_version', { length: 32 }).notNull().default('2026-05-07'),
  signupCount: integer('signup_count').notNull().default(1),
  lastIpAddress: varchar('last_ip_address', { length: 64 }),
  lastUserAgent: text('last_user_agent'),
  welcomeSentAt: timestamp('welcome_sent_at', { withTimezone: true }),
  welcomeProviderId: varchar('welcome_provider_id', { length: 160 }),
  welcomeError: text('welcome_error'),
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
  stripeCheckoutSessionId: varchar('stripe_checkout_session_id', { length: 255 }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeCurrency: varchar('stripe_currency', { length: 8 }),
  stripeAmountReceivedCents: integer('stripe_amount_received_cents'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
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

// ---------- analytics_events ----------
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventName: varchar('event_name', { length: 80 }).notNull(),
  path: text('path').notNull().default('/'),
  referrer: text('referrer').notNull().default(''),
  source: varchar('source', { length: 80 }).notNull().default('site'),
  anonId: varchar('anon_id', { length: 96 }),
  properties: jsonb('properties').notNull().default({}),
  ipHash: varchar('ip_hash', { length: 96 }),
  userAgentHash: varchar('user_agent_hash', { length: 96 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- real-time newsroom ----------
// The newsroom is deliberately a verification system, not a publishing
// system. There is no published state and no article foreign key here: a
// human-approved editorial workflow must remain a separate boundary.
export const newsSources = pgTable(
  'news_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceKey: varchar('source_key', { length: 120 }).notNull().unique(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    sourceType: varchar('source_type', { length: 32 }).notNull().default('manual'),
    ownerKey: varchar('owner_key', { length: 160 }).notNull(),
    tier: varchar('tier', { length: 24 }).notNull().default('unverified'),
    commercialStatus: varchar('commercial_status', { length: 32 }).notNull().default('review_required'),
    commercialNotes: text('commercial_notes').notNull().default(''),
    homepageUrl: text('homepage_url'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_news_sources_enabled_tier').on(table.enabled, table.tier),
    index('idx_news_sources_owner').on(table.ownerKey),
    index('idx_news_sources_commercial').on(table.commercialStatus),
  ],
);

export const newsSignals = pgTable(
  'news_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id').notNull().references(() => newsSources.id),
    externalId: varchar('external_id', { length: 240 }),
    canonicalUrl: text('canonical_url'),
    exactUrlHash: varchar('exact_url_hash', { length: 64 }),
    exactContentHash: varchar('exact_content_hash', { length: 64 }).notNull(),
    headline: text('headline').notNull(),
    summary: text('summary').notNull().default(''),
    sport: varchar('sport', { length: 40 }).notNull().default('General'),
    sourcePublishedAt: timestamp('source_published_at', { withTimezone: true }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    rawPayload: jsonb('raw_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_news_signals_source_time').on(table.sourceId, table.observedAt),
    index('idx_news_signals_published_time').on(table.sourcePublishedAt),
    uniqueIndex('idx_news_signals_source_external')
      .on(table.sourceId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    uniqueIndex('idx_news_signals_exact_url')
      .on(table.exactUrlHash)
      .where(sql`${table.exactUrlHash} IS NOT NULL`),
    uniqueIndex('idx_news_signals_exact_content').on(table.exactContentHash),
  ],
);

export const newsEvents = pgTable(
  'news_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    headline: text('headline').notNull(),
    summary: text('summary').notNull().default(''),
    sport: varchar('sport', { length: 40 }).notNull().default('General'),
    state: varchar('state', { length: 32 }).notNull().default('new'),
    urgency: varchar('urgency', { length: 24 }).notNull().default('routine'),
    version: integer('version').notNull().default(1),
    firstSignalAt: timestamp('first_signal_at', { withTimezone: true }).notNull().defaultNow(),
    lastSignalAt: timestamp('last_signal_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_news_events_state_urgency').on(table.state, table.urgency, table.updatedAt),
    index('idx_news_events_last_signal').on(table.lastSignalAt),
  ],
);

export const newsEventSignals = pgTable(
  'news_event_signals',
  {
    eventId: uuid('event_id').notNull().references(() => newsEvents.id),
    signalId: uuid('signal_id').notNull().references(() => newsSignals.id),
    linkage: varchar('linkage', { length: 24 }).notNull().default('manual'),
    similarityBasisPoints: integer('similarity_basis_points'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.signalId], name: 'news_event_signals_pk' }),
    index('idx_news_event_signals_signal').on(table.signalId),
  ],
);

// Append-only evidence. Source attributes are snapshotted so a later source
// reclassification cannot rewrite the basis of a historical verification.
export const newsEvidence = pgTable(
  'news_evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id').notNull().references(() => newsEvents.id),
    // Evidence is immutable. Referenced provenance and actors therefore use
    // RESTRICT: a parent delete must never masquerade as a permitted ledger
    // UPDATE through ON DELETE SET NULL.
    sourceId: uuid('source_id').references(() => newsSources.id, { onDelete: 'restrict' }),
    signalId: uuid('signal_id').references(() => newsSignals.id, { onDelete: 'restrict' }),
    supersedesEvidenceId: uuid('supersedes_evidence_id').references(
      (): AnyPgColumn => newsEvidence.id,
    ),
    stance: varchar('stance', { length: 24 }).notNull(),
    evidenceClass: varchar('evidence_class', { length: 24 }).notNull(),
    ownerKey: varchar('owner_key', { length: 160 }).notNull(),
    sourceTier: varchar('source_tier', { length: 24 }).notNull(),
    credible: boolean('credible').notNull().default(false),
    label: text('label').notNull(),
    url: text('url'),
    excerpt: text('excerpt').notNull().default(''),
    notes: text('notes').notNull().default(''),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    addedBy: uuid('added_by').references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_news_evidence_event_time').on(table.eventId, table.createdAt),
    index('idx_news_evidence_source').on(table.sourceId),
    index('idx_news_evidence_signal').on(table.signalId),
    uniqueIndex('idx_news_evidence_supersedes')
      .on(table.supersedesEvidenceId)
      .where(sql`${table.supersedesEvidenceId} IS NOT NULL`),
    index('idx_news_evidence_owner_stance').on(table.ownerKey, table.stance),
  ],
);

// Append-only decision ledger. A new review supersedes an old one without
// modifying or deleting the original record.
export const newsVerificationReviews = pgTable(
  'news_verification_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id').notNull().references(() => newsEvents.id),
    reviewerId: uuid('reviewer_id').references(() => users.id, { onDelete: 'restrict' }),
    reviewerLabel: varchar('reviewer_label', { length: 160 }).notNull(),
    decision: varchar('decision', { length: 24 }).notNull(),
    rationale: text('rationale').notNull(),
    eventVersion: integer('event_version').notNull(),
    criteriaSnapshot: jsonb('criteria_snapshot').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_news_verification_event_time').on(table.eventId, table.createdAt),
    index('idx_news_verification_reviewer').on(table.reviewerId),
  ],
);

// Append-only audit and SSE replay ledger. `sequence` is monotonic and is the
// public cursor; JSON metadata is intentionally excluded from feed queries.
export const newsroomActivity = pgTable(
  'newsroom_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sequence: bigserial('sequence', { mode: 'number' }).notNull().unique(),
    eventId: uuid('event_id').references(() => newsEvents.id),
    signalId: uuid('signal_id').references(() => newsSignals.id),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    actorLabel: varchar('actor_label', { length: 160 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    fromState: varchar('from_state', { length: 32 }),
    toState: varchar('to_state', { length: 32 }),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_newsroom_activity_sequence').on(table.sequence),
    index('idx_newsroom_activity_event_sequence').on(table.eventId, table.sequence),
    index('idx_newsroom_activity_signal').on(table.signalId),
    index('idx_newsroom_activity_actor').on(table.actorUserId),
  ],
);

// ---------- external provider governance ----------
// Configuration, leases, checkpoints, and operational ledgers for future
// connectors. No table here publishes articles or verifies newsroom events.
// Secrets never live in these rows — only credential presence metadata.
export const newsProviders = pgTable(
  'news_providers',
  {
    providerKey: varchar('provider_key', { length: 64 }).primaryKey(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    providerKind: varchar('provider_kind', { length: 32 }).notNull(),
    commercialStatus: varchar('commercial_status', { length: 32 })
      .notNull()
      .default('review_required'),
    commercialNotes: text('commercial_notes').notNull().default(''),
    termsUrl: text('terms_url'),
    termsReviewedAt: timestamp('terms_reviewed_at', { withTimezone: true }),
    termsReviewOwner: varchar('terms_review_owner', { length: 160 }).notNull().default(''),
    approvalOwner: varchar('approval_owner', { length: 160 }).notNull().default(''),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
    // Env var names only — never secret values.
    credentialEnvNames: jsonb('credential_env_names').$type<string[]>().notNull().default([]),
    credentialPresence: varchar('credential_presence', { length: 24 }).notNull().default('absent'),
    credentialPresenceDigest: varchar('credential_presence_digest', { length: 64 }),
    retentionPosture: jsonb('retention_posture').notNull().default({}),
    attributionPosture: text('attribution_posture').notNull().default(''),
    allowedUse: varchar('allowed_use', { length: 40 }).notNull().default('none'),
    monthlySpendCeilingCents: integer('monthly_spend_ceiling_cents'),
    // DB-side enablement. Still requires env gates + commercial approval.
    configEnabled: boolean('config_enabled').notNull().default(false),
    cursorKind: varchar('cursor_kind', { length: 32 }).notNull().default('none'),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    lastFailureSummary: text('last_failure_summary').notNull().default(''),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_news_providers_commercial').on(table.commercialStatus),
    index('idx_news_providers_enabled').on(table.configEnabled),
    index('idx_news_providers_kind').on(table.providerKind),
  ],
);

// Singleton mutable lease per provider. fence_token only increases on acquire.
export const newsProviderLeases = pgTable(
  'news_provider_leases',
  {
    providerKey: varchar('provider_key', { length: 64 })
      .primaryKey()
      .references(() => newsProviders.providerKey, { onDelete: 'restrict' }),
    ownerId: varchar('owner_id', { length: 160 }).notNull(),
    fenceToken: integer('fence_token').notNull(),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull(),
    renewedAt: timestamp('renewed_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (table) => [
    index('idx_news_provider_leases_expires').on(table.expiresAt),
    index('idx_news_provider_leases_owner').on(table.ownerId),
  ],
);

// Durable cursor/checkpoint. Writers must present a live matching fence token.
export const newsProviderCheckpoints = pgTable(
  'news_provider_checkpoints',
  {
    providerKey: varchar('provider_key', { length: 64 })
      .primaryKey()
      .references(() => newsProviders.providerKey, { onDelete: 'restrict' }),
    cursorKind: varchar('cursor_kind', { length: 32 }).notNull().default('none'),
    cursorValue: text('cursor_value').notNull().default(''),
    fenceToken: integer('fence_token').notNull().default(0),
    lastCommittedAt: timestamp('last_committed_at', { withTimezone: true }),
    lastObservedProviderAt: timestamp('last_observed_provider_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_news_provider_checkpoints_updated').on(table.updatedAt)],
);

// Append-only ingest attempt ledger: latency, rate limits, failures, reconnects.
export const newsProviderIngestAttempts = pgTable(
  'news_provider_ingest_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerKey: varchar('provider_key', { length: 64 })
      .notNull()
      .references(() => newsProviders.providerKey, { onDelete: 'restrict' }),
    attemptKind: varchar('attempt_kind', { length: 32 }).notNull(),
    outcome: varchar('outcome', { length: 32 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
    latencyMs: integer('latency_ms'),
    httpStatus: integer('http_status'),
    retryAfterMs: integer('retry_after_ms'),
    fenceToken: integer('fence_token'),
    cursorBefore: text('cursor_before'),
    cursorAfter: text('cursor_after'),
    externalId: varchar('external_id', { length: 320 }),
    payloadHash: varchar('payload_hash', { length: 64 }),
    errorCode: varchar('error_code', { length: 80 }),
    errorSummary: text('error_summary').notNull().default(''),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_news_provider_ingest_provider_time').on(table.providerKey, table.createdAt),
    index('idx_news_provider_ingest_outcome').on(table.outcome, table.createdAt),
    index('idx_news_provider_ingest_external').on(table.providerKey, table.externalId),
    index('idx_news_provider_ingest_payload').on(table.payloadHash),
  ],
);

// Append-only dead-letter ledger. Resolution appends a new activity/attempt;
// resolved_at may be set once via the controlled resolve path.
export const newsProviderDeadLetters = pgTable(
  'news_provider_dead_letters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerKey: varchar('provider_key', { length: 64 })
      .notNull()
      .references(() => newsProviders.providerKey, { onDelete: 'restrict' }),
    reason: varchar('reason', { length: 80 }).notNull(),
    externalId: varchar('external_id', { length: 320 }),
    payloadHash: varchar('payload_hash', { length: 64 }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    errorSummary: text('error_summary').notNull().default(''),
    // Bounded non-secret provenance only. Never full restricted provider bodies.
    rawProvenance: jsonb('raw_provenance').notNull().default({}),
    ingestAttemptId: uuid('ingest_attempt_id').references(
      () => newsProviderIngestAttempts.id,
      { onDelete: 'restrict' },
    ),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionSummary: text('resolution_summary').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_news_provider_dead_letters_open').on(table.providerKey, table.resolvedAt),
    index('idx_news_provider_dead_letters_payload').on(table.payloadHash),
    index('idx_news_provider_dead_letters_external').on(table.providerKey, table.externalId),
  ],
);

// ---------- immutable article publication ----------
// Revisions are content-addressed, append-only snapshots of the complete
// reader-visible surface. Creating a revision does not make it public.
export const articleRevisions = pgTable(
  'article_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    revisionNumber: integer('revision_number').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    snapshot: jsonb('snapshot').$type<ArticlePublicationSnapshot>().notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'restrict' }),
    sourceEventId: uuid('source_event_id').references(() => newsEvents.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_article_revisions_article_number').on(
      table.articleId,
      table.revisionNumber,
    ),
    uniqueIndex('idx_article_revisions_article_hash').on(table.articleId, table.contentHash),
    uniqueIndex('idx_article_revisions_article_id_id').on(table.articleId, table.id),
    uniqueIndex('idx_article_revisions_article_id_id_hash').on(
      table.articleId,
      table.id,
      table.contentHash,
    ),
    index('idx_article_revisions_created_by').on(table.createdBy),
    index('idx_article_revisions_source_event').on(table.sourceEventId),
  ],
);

// Every publish, unpublish, and legacy migration is an immutable audit event.
// Explicit approval text is stored only for a publish event and is bound to
// the exact revision/hash pair that Brad approved.
export const articlePublicationEvents = pgTable(
  'article_publication_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    revisionId: uuid('revision_id')
      .notNull()
      .references(() => articleRevisions.id, { onDelete: 'restrict' }),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    action: varchar('action', { length: 24 }).notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    actorLabel: varchar('actor_label', { length: 160 }).notNull(),
    exactConfirmation: text('exact_confirmation').notNull().default(''),
    rationale: text('rationale').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_article_publication_events_article_time').on(table.articleId, table.createdAt),
    index('idx_article_publication_events_revision').on(table.revisionId),
    index('idx_article_publication_events_actor').on(table.actorUserId),
    uniqueIndex('idx_article_publication_events_legacy_once')
      .on(table.articleId)
      .where(sql`${table.action} = 'legacy_backfill'`),
  ],
);

// A newsroom event can seed a draft, but never publishes it. The source link
// captures which immutable revision was generated from which verified event.
export const newsEventArticles = pgTable(
  'news_event_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => newsEvents.id, { onDelete: 'restrict' }),
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    revisionId: uuid('revision_id')
      .notNull()
      .references(() => articleRevisions.id, { onDelete: 'restrict' }),
    relation: varchar('relation', { length: 24 }).notNull().default('source'),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    actorLabel: varchar('actor_label', { length: 160 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_news_event_articles_event_relation').on(table.eventId, table.relation),
    uniqueIndex('idx_news_event_articles_article_event').on(table.articleId, table.eventId),
    index('idx_news_event_articles_article').on(table.articleId),
    index('idx_news_event_articles_revision').on(table.revisionId),
    index('idx_news_event_articles_actor').on(table.actorUserId),
  ],
);

// ---------- sports encyclopedia (first-party public franchise identity) ----------
// Public organizational facts only. Not a licensed stats feed and not a scrape
// of third-party encyclopedias. Every seed row carries source citation fields.
export const sportsLeagues = pgTable(
  'sports_leagues',
  {
    leagueKey: varchar('league_key', { length: 16 }).primaryKey(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    shortName: varchar('short_name', { length: 16 }).notNull(),
    sport: varchar('sport', { length: 64 }).notNull(),
    governingBody: varchar('governing_body', { length: 160 }).notNull(),
    officialUrl: text('official_url').notNull(),
    teamCount: integer('team_count').notNull(),
    dataSource: text('data_source').notNull(),
    dataSourceUrl: text('data_source_url').notNull(),
    dataVerifiedDate: timestamp('data_verified_date', { withTimezone: true }).notNull(),
    dataConfidence: varchar('data_confidence', { length: 24 }).notNull().default('VERIFIED'),
    dataNotes: text('data_notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_sports_leagues_short').on(table.shortName)],
);

export const sportsTeams = pgTable(
  'sports_teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueKey: varchar('league_key', { length: 16 })
      .notNull()
      .references(() => sportsLeagues.leagueKey, { onDelete: 'restrict' }),
    teamKey: varchar('team_key', { length: 80 }).notNull(),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    city: varchar('city', { length: 80 }).notNull(),
    nickname: varchar('nickname', { length: 80 }).notNull(),
    abbreviation: varchar('abbreviation', { length: 8 }).notNull(),
    conference: varchar('conference', { length: 40 }),
    division: varchar('division', { length: 40 }),
    foundedYear: integer('founded_year'),
    officialUrl: text('official_url').notNull(),
    rankingsId: varchar('rankings_id', { length: 40 }),
    dataSource: text('data_source').notNull(),
    dataSourceUrl: text('data_source_url').notNull(),
    dataVerifiedDate: timestamp('data_verified_date', { withTimezone: true }).notNull(),
    dataConfidence: varchar('data_confidence', { length: 24 }).notNull().default('VERIFIED'),
    dataNotes: text('data_notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_sports_teams_league_key').on(table.leagueKey, table.teamKey),
    uniqueIndex('idx_sports_teams_league_abbr').on(table.leagueKey, table.abbreviation),
    index('idx_sports_teams_rankings').on(table.rankingsId),
    index('idx_sports_teams_city').on(table.city),
  ],
);

export const sportsPeople = pgTable(
  'sports_people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personKey: varchar('person_key', { length: 120 }).notNull().unique(),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    commonName: varchar('common_name', { length: 120 }).notNull(),
    role: varchar('role', { length: 32 }).notNull(),
    leagueKey: varchar('league_key', { length: 16 })
      .notNull()
      .references(() => sportsLeagues.leagueKey, { onDelete: 'restrict' }),
    teamKey: varchar('team_key', { length: 80 }).notNull(),
    positionOrTitle: varchar('position_or_title', { length: 80 }).notNull().default(''),
    summary: text('summary').notNull().default(''),
    officialUrl: text('official_url'),
    dataSource: text('data_source').notNull(),
    dataSourceUrl: text('data_source_url').notNull(),
    dataVerifiedDate: timestamp('data_verified_date', { withTimezone: true }).notNull(),
    dataConfidence: varchar('data_confidence', { length: 24 }).notNull().default('CROSS_REFERENCED'),
    dataNotes: text('data_notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_sports_people_league_team').on(table.leagueKey, table.teamKey),
    index('idx_sports_people_role').on(table.role),
    index('idx_sports_people_name').on(table.commonName),
  ],
);

// ---------- type exports ----------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type PublicationRuntimeControl = typeof publicationRuntimeControls.$inferSelect;
export type SiteConfigRow = typeof siteConfig.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AuthAttempt = typeof authAttempts.$inferSelect;
export type EditorialFinding = typeof editorialFindings.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type DonationIntent = typeof donationIntents.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewsSource = typeof newsSources.$inferSelect;
export type NewNewsSource = typeof newsSources.$inferInsert;
export type NewsSignal = typeof newsSignals.$inferSelect;
export type NewNewsSignal = typeof newsSignals.$inferInsert;
export type NewsEvent = typeof newsEvents.$inferSelect;
export type NewNewsEvent = typeof newsEvents.$inferInsert;
export type NewsEventSignal = typeof newsEventSignals.$inferSelect;
export type NewsEvidence = typeof newsEvidence.$inferSelect;
export type NewNewsEvidence = typeof newsEvidence.$inferInsert;
export type NewsVerificationReview = typeof newsVerificationReviews.$inferSelect;
export type NewsroomActivity = typeof newsroomActivity.$inferSelect;
export type NewsProvider = typeof newsProviders.$inferSelect;
export type NewNewsProvider = typeof newsProviders.$inferInsert;
export type NewsProviderLease = typeof newsProviderLeases.$inferSelect;
export type NewsProviderCheckpoint = typeof newsProviderCheckpoints.$inferSelect;
export type NewsProviderIngestAttempt = typeof newsProviderIngestAttempts.$inferSelect;
export type NewsProviderDeadLetter = typeof newsProviderDeadLetters.$inferSelect;
export type ArticleRevision = typeof articleRevisions.$inferSelect;
export type NewArticleRevision = typeof articleRevisions.$inferInsert;
export type ArticlePublicationEvent = typeof articlePublicationEvents.$inferSelect;
export type NewsEventArticle = typeof newsEventArticles.$inferSelect;
export type SportsLeague = typeof sportsLeagues.$inferSelect;
export type SportsTeam = typeof sportsTeams.$inferSelect;
export type SportsPerson = typeof sportsPeople.$inferSelect;
