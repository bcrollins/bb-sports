import { createHash } from 'node:crypto';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db/client';
import { analyticsEvents, type AnalyticsEvent } from './db/schema';
import { ensureBootstrapped } from './db/bootstrap';

export const ANALYTICS_EVENT_NAMES = [
  'page_view',
  'article_view',
  'search_performed',
  'newsletter_signup',
  'newsletter_unsubscribe',
  'donation_interest_created',
  'contact_message_created',
  'comment_submitted',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

const primitiveProperty = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const analyticsPayloadSchema = z.object({
  eventName: z.enum(ANALYTICS_EVENT_NAMES),
  path: z.string().trim().min(1).max(320).optional(),
  referrer: z.string().trim().max(500).optional(),
  source: z.string().trim().max(80).optional(),
  anonId: z.string().trim().max(96).optional(),
  properties: z.record(z.string(), primitiveProperty).optional(),
});

export type AnalyticsPayload = z.infer<typeof analyticsPayloadSchema>;

type RequestFingerprint = {
  ip?: string | null;
  userAgent?: string | null;
};

const FORBIDDEN_PROPERTY_KEY = /(email|e-mail|name|message|body|token|password|secret|phone|ip|user.?agent)/i;

export function sanitizeAnalyticsProperties(
  properties: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number | boolean | null> {
  if (!properties) return {};
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(properties).slice(0, 24)) {
    const normalizedKey = key.trim().replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64);
    if (!normalizedKey || FORBIDDEN_PROPERTY_KEY.test(normalizedKey)) continue;
    if (typeof value === 'string') {
      clean[normalizedKey] = value.trim().slice(0, 160);
    } else if (typeof value === 'number') {
      clean[normalizedKey] = Number.isFinite(value) ? value : null;
    } else {
      clean[normalizedKey] = value;
    }
  }
  return clean;
}

export function hashAnalyticsValue(value: string | null | undefined): string | null {
  if (!value || value === 'unknown') return null;
  const salt = process.env.ANALYTICS_HASH_SALT || process.env.JWT_SECRET || 'bb-sports-analytics-v1';
  return createHash('sha256').update(`${salt}:${value}`).digest('hex').slice(0, 64);
}

export async function recordAnalyticsEvent(
  payload: AnalyticsPayload,
  fingerprint: RequestFingerprint = {},
): Promise<AnalyticsEvent | null> {
  if (!db) return null;
  await ensureBootstrapped();
  const parsed = analyticsPayloadSchema.parse(payload);
  const rows = await db
    .insert(analyticsEvents)
    .values({
      eventName: parsed.eventName,
      path: normalizeAnalyticsPath(parsed.path),
      referrer: parsed.referrer ? parsed.referrer.slice(0, 500) : '',
      source: parsed.source || 'site',
      anonId: parsed.anonId || null,
      properties: sanitizeAnalyticsProperties(parsed.properties),
      ipHash: hashAnalyticsValue(fingerprint.ip),
      userAgentHash: hashAnalyticsValue(fingerprint.userAgent),
    })
    .returning();
  return rows[0] ?? null;
}

export async function recordAnalyticsEventSafe(
  payload: AnalyticsPayload,
  fingerprint: RequestFingerprint = {},
): Promise<void> {
  try {
    await recordAnalyticsEvent(payload, fingerprint);
  } catch {
    // Analytics must never block editorial, donation, comment, or newsletter flows.
  }
}

export async function getAnalyticsSnapshot(): Promise<{
  counts: {
    events7d: number;
    pageViews7d: number;
    articleViews7d: number;
    searches7d: number;
    donationInterest7d: number;
    newsletterSignups7d: number;
  };
  topEvents: { eventName: string; count: number }[];
  topPaths: { path: string; count: number }[];
  recentEvents: AnalyticsEvent[];
}> {
  if (!db) {
    return {
      counts: {
        events7d: 0,
        pageViews7d: 0,
        articleViews7d: 0,
        searches7d: 0,
        donationInterest7d: 0,
        newsletterSignups7d: 0,
      },
      topEvents: [],
      topPaths: [],
      recentEvents: [],
    };
  }
  await ensureBootstrapped();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [countRows, topEvents, topPaths, recentEvents] = await Promise.all([
    db.execute(sql`
      SELECT
        count(*)::int AS events_7d,
        count(*) FILTER (WHERE event_name = 'page_view')::int AS page_views_7d,
        count(*) FILTER (WHERE event_name = 'article_view')::int AS article_views_7d,
        count(*) FILTER (WHERE event_name = 'search_performed')::int AS searches_7d,
        count(*) FILTER (WHERE event_name = 'donation_interest_created')::int AS donation_interest_7d,
        count(*) FILTER (WHERE event_name = 'newsletter_signup')::int AS newsletter_signups_7d
      FROM analytics_events
      WHERE created_at >= ${since}
    `),
    db
      .select({ eventName: analyticsEvents.eventName, count: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, since))
      .groupBy(analyticsEvents.eventName)
      .orderBy(desc(sql<number>`count(*)::int`))
      .limit(8),
    db
      .select({ path: analyticsEvents.path, count: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.eventName, 'page_view'), gte(analyticsEvents.createdAt, since)))
      .groupBy(analyticsEvents.path)
      .orderBy(desc(sql<number>`count(*)::int`))
      .limit(8),
    db.select().from(analyticsEvents).orderBy(desc(analyticsEvents.createdAt)).limit(12),
  ]);
  const counts = (countRows as unknown as Array<{
    events_7d: number;
    page_views_7d: number;
    article_views_7d: number;
    searches_7d: number;
    donation_interest_7d: number;
    newsletter_signups_7d: number;
  }>)[0];
  return {
    counts: {
      events7d: counts?.events_7d ?? 0,
      pageViews7d: counts?.page_views_7d ?? 0,
      articleViews7d: counts?.article_views_7d ?? 0,
      searches7d: counts?.searches_7d ?? 0,
      donationInterest7d: counts?.donation_interest_7d ?? 0,
      newsletterSignups7d: counts?.newsletter_signups_7d ?? 0,
    },
    topEvents,
    topPaths,
    recentEvents,
  };
}

function normalizeAnalyticsPath(path: string | undefined): string {
  if (!path) return '/';
  if (!path.startsWith('/')) return '/';
  return path.split('?')[0].slice(0, 320) || '/';
}
