import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * Increment this only when the canonical serialization contract changes. A
 * versioned preimage prevents hashes produced by different contracts from
 * being treated as interchangeable.
 */
export const ARTICLE_PUBLICATION_HASH_VERSION = 'bb-sports.article-publication.v1' as const;

export const ARTICLE_PUBLICATION_FIELDS = [
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

export const ARTICLE_PUBLICATION_CONFIRMATION_PHRASE =
  'BRAD APPROVES THIS EXACT ARTICLE FOR PUBLICATION' as const;

export const ARTICLE_PUBLISHER_ROLE = 'super_admin' as const;
export const VERIFIED_DRAFT_SOURCE_LINK_LIMIT = 25 as const;
export const ARTICLE_HERO_REMOTE_HOSTS = [
  'images.unsplash.com',
  'cdn.bbsports.media',
  'pbs.twimg.com',
] as const;
const VERIFIED_DRAFT_SOURCE_LABEL_LIMIT = 180;
const VERIFIED_SOURCE_TIER_ORDER = ['primary', 'official', 'tier_1', 'tier_2'] as const;

function normalizeCanonicalText(value: string): string {
  return value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

function canonicalText(options: { min?: number; max: number }) {
  return z
    .string()
    .transform(normalizeCanonicalText)
    .pipe(z.string().min(options.min ?? 0).max(options.max));
}

const canonicalSlugSchema = z
  .string()
  .transform((value) => normalizeCanonicalText(value).toLocaleLowerCase('en-US'))
  .pipe(
    z
      .string()
      .min(1)
      .max(200)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Slug must use lowercase ASCII words separated by single hyphens.',
      ),
  );

const ARTICLE_HERO_ERROR =
  'Hero must be empty, a safe repository asset, an exact BB Sports media-asset path, or HTTPS on an approved image host.';

const ARTICLE_MEDIA_HERO_PATTERN =
  /^\/api\/media\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/file$/;

/** Return the v4 media id only for the one public asset route shape. */
export function articleHeroMediaAssetId(value: string): string | null {
  return ARTICLE_MEDIA_HERO_PATTERN.exec(value)?.[1] ?? null;
}

function isSafeLocalArticleHero(value: string): boolean {
  if (articleHeroMediaAssetId(value)) return true;
  if (!value.startsWith('/images/') && !value.startsWith('/brand/')) return false;
  if (value.startsWith('//') || value.includes('\\') || value.includes('?') || value.includes('#')) {
    return false;
  }

  // Public repository assets use deliberately boring paths. Disallowing encoded
  // bytes and empty/dot segments prevents path normalization from turning an
  // approved prefix into a different resource at render time.
  if (!/^\/[A-Za-z0-9._/-]+$/.test(value)) return false;
  return value.split('/').slice(1).every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function isSafeRemoteArticleHero(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    url.hash === '' &&
    ARTICLE_HERO_REMOTE_HOSTS.includes(
      url.hostname.toLocaleLowerCase('en-US') as (typeof ARTICLE_HERO_REMOTE_HOSTS)[number],
    )
  );
}

/**
 * Reader-visible hero locations must also be renderable by next/image. Keeping
 * this allowlist beside the immutable publication contract prevents Brad from
 * approving a snapshot that the public article page cannot display.
 */
export const articleHeroSchema = z
  .string()
  .transform(normalizeCanonicalText)
  .pipe(z.string().max(2_000))
  .superRefine((value, context) => {
    if (value === '' || isSafeLocalArticleHero(value) || isSafeRemoteArticleHero(value)) return;
    context.addIssue({ code: 'custom', message: ARTICLE_HERO_ERROR });
  });

/**
 * The complete public article surface covered by an editorial approval. It
 * intentionally excludes timestamps, database identifiers, and workflow
 * state: none of those alter what a reader sees.
 */
export const articlePublicationSnapshotSchema = z
  .object({
    slug: canonicalSlugSchema,
    title: canonicalText({ min: 1, max: 1_000 }),
    dek: canonicalText({ max: 500 }),
    body: canonicalText({ max: 100_000 }),
    sport: canonicalText({ min: 1, max: 24 }),
    hero: articleHeroSchema,
    heroAlt: canonicalText({ max: 500 }),
    heroCredit: canonicalText({ max: 500 }),
    authorName: canonicalText({ min: 1, max: 120 }),
    aiAssisted: z.boolean(),
    bradsTake: canonicalText({ max: 5_000 }),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.hero && !snapshot.heroAlt) {
      context.addIssue({
        code: 'custom',
        path: ['heroAlt'],
        message: 'Hero alt text is required when a hero image is present.',
      });
    }
    if (snapshot.hero && !snapshot.heroCredit) {
      context.addIssue({
        code: 'custom',
        path: ['heroCredit'],
        message: 'Hero credit is required when a hero image is present.',
      });
    }
    if (snapshot.aiAssisted && !snapshot.bradsTake) {
      context.addIssue({
        code: 'custom',
        path: ['bradsTake'],
        message: 'AI-assisted articles require Brad\'s Take before approval.',
      });
    }
  });

export type ArticlePublicationSnapshotInput = z.input<
  typeof articlePublicationSnapshotSchema
>;
export type ArticlePublicationSnapshot = Readonly<
  z.output<typeof articlePublicationSnapshotSchema>
>;

/** Normalize and freeze the exact reader-visible article snapshot. */
export function normalizeArticlePublicationSnapshot(
  input: ArticlePublicationSnapshotInput,
): ArticlePublicationSnapshot {
  return Object.freeze(articlePublicationSnapshotSchema.parse(input));
}

/**
 * Hashes a fixed-order tuple rather than an object. Hashes therefore cannot
 * change with caller key order, JavaScript property enumeration, or time.
 */
export function hashArticlePublicationSnapshot(
  input: ArticlePublicationSnapshotInput,
): string {
  const snapshot = normalizeArticlePublicationSnapshot(input);
  const preimage = JSON.stringify([
    ARTICLE_PUBLICATION_HASH_VERSION,
    snapshot.slug,
    snapshot.title,
    snapshot.dek,
    snapshot.body,
    snapshot.sport,
    snapshot.hero,
    snapshot.heroAlt,
    snapshot.heroCredit,
    snapshot.authorName,
    snapshot.aiAssisted,
    snapshot.bradsTake,
  ]);

  return createHash('sha256').update(preimage, 'utf8').digest('hex');
}

/**
 * Opaque compare-and-swap token for the editable database row. Unlike the
 * publication hash this accepts an incomplete draft and preserves exact
 * stored text, so concurrent editors cannot silently overwrite one another.
 */
export function hashArticleEditableState(
  input: Pick<
    ArticlePublicationSnapshotInput,
    | 'slug'
    | 'title'
    | 'dek'
    | 'body'
    | 'sport'
    | 'hero'
    | 'heroAlt'
    | 'heroCredit'
    | 'authorName'
    | 'aiAssisted'
    | 'bradsTake'
  >,
): string {
  const preimage = JSON.stringify([
    'bb-sports.article-edit-state.v1',
    input.slug,
    input.title,
    input.dek,
    input.body,
    input.sport,
    input.hero,
    input.heroAlt,
    input.heroCredit,
    input.authorName,
    input.aiAssisted,
    input.bradsTake,
  ]);
  return createHash('sha256').update(preimage, 'utf8').digest('hex');
}

const canonicalRationaleSchema = z
  .string()
  .transform(normalizeCanonicalText)
  .pipe(z.string().min(20).max(4_000));

/**
 * A publish request binds Brad's explicit approval to one immutable revision
 * and its exact canonical content hash. Unknown fields are rejected.
 */
export const articlePublishRequestSchema = z
  .object({
    articleId: z.string().uuid(),
    expectedRevisionId: z.string().uuid(),
    expectedContentHash: z.string().regex(/^[a-f0-9]{64}$/),
    confirmation: z.literal(ARTICLE_PUBLICATION_CONFIRMATION_PHRASE),
    rationale: canonicalRationaleSchema,
  })
  .strict();

export type ArticlePublishRequest = z.infer<typeof articlePublishRequestSchema>;

/**
 * Preparing a revision is also compare-and-swap: the server may snapshot only
 * the exact draft hash that the operator's screen most recently reviewed.
 */
export const articleRevisionPrepareRequestSchema = z
  .object({
    expectedDraftHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type ArticleRevisionPrepareRequest = z.infer<
  typeof articleRevisionPrepareRequestSchema
>;

/** Fail closed for null, malformed, future, or merely editorial roles. */
export function canPublishArticle(role: unknown): role is typeof ARTICLE_PUBLISHER_ROLE {
  return role === ARTICLE_PUBLISHER_ROLE;
}

export type ActiveNewsroomEvidenceMetadata = Readonly<{
  stance: 'supporting' | 'contradicting' | 'context';
  label: string;
  url?: string | null;
  evidenceClass?: 'primary' | 'official' | 'reporting' | 'context';
  sourceTier?: 'primary' | 'official' | 'tier_1' | 'tier_2' | 'unverified';
  ownerKey?: string;
  credible?: boolean;
}>;

export type VerifiedNewsroomDraftInput = Readonly<{
  event: Readonly<{
    state: string;
    headline: string;
    summary: string;
    sport: string;
  }>;
  /** The caller must resolve supersession and pass active evidence only. */
  activeEvidence: readonly ActiveNewsroomEvidenceMetadata[];
  authorName?: string;
}>;

export type ArticlePublicationInvariantCode =
  | 'EVENT_NOT_VERIFIED'
  | 'UNRESOLVED_CONTRADICTION'
  | 'NO_CITABLE_SUPPORT';

export class ArticlePublicationInvariantError extends Error {
  constructor(
    readonly code: ArticlePublicationInvariantCode,
    message: string,
  ) {
    super(message);
    this.name = 'ArticlePublicationInvariantError';
  }
}

const verifiedDraftInputSchema = z.object({
  event: z.object({
    state: z.string(),
    headline: canonicalText({ min: 5, max: 320 }),
    summary: canonicalText({ max: 6_000 }),
    sport: canonicalText({ min: 1, max: 40 }),
  }),
  activeEvidence: z
    .array(
      z.object({
        stance: z.enum(['supporting', 'contradicting', 'context']),
        label: canonicalText({ min: 1, max: 500 }),
        url: z.string().trim().max(2_048).nullable().optional(),
        evidenceClass: z
          .enum(['primary', 'official', 'reporting', 'context'])
          .optional(),
        sourceTier: z
          .enum(['primary', 'official', 'tier_1', 'tier_2', 'unverified'])
          .optional(),
        ownerKey: canonicalText({ max: 160 }).optional(),
        credible: z.boolean().optional(),
      }),
    )
    .max(500),
  authorName: canonicalText({ min: 1, max: 120 }).default('Brad Benson'),
});

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Safe lowercase ASCII slug with a deterministic fallback and collision tail. */
export function slugifyArticleTitle(value: string): string {
  const canonical = normalizeCanonicalText(value);
  const digest = sha256(canonical).slice(0, 12);
  const ascii = canonical
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!ascii) return `story-${digest}`;
  if (ascii.length <= 200) return ascii;

  const prefix = ascii.slice(0, 187).replace(/-+$/g, '');
  return `${prefix}-${digest}`;
}

function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.hash = '';
    const normalized = url.toString();
    // URL serialization percent-encodes Unicode and can expand a valid input
    // several-fold. Bound the actual markdown destination, not only the input.
    return normalized.length <= 2_048 ? normalized : null;
  } catch {
    return null;
  }
}

function escapeMarkdownLabel(value: string): string {
  return escapeMarkdownPlainText(value).replace(/\s+/g, ' ').trim();
}

function escapeMarkdownPlainText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_[\]{}()#+.!|~\-])/g, '\\$1');
}

function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  let prefix = value.slice(0, maxLength - 1).trimEnd();
  const finalCodeUnit = prefix.charCodeAt(prefix.length - 1);
  if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) prefix = prefix.slice(0, -1);
  return `${prefix}…`;
}

/**
 * Converts a verified event into a deterministic, unpublished article
 * snapshot. Only event-authored text and evidence labels/URLs are used;
 * evidence excerpts, notes, raw payloads, and provider bodies are stripped by
 * the input parser and can never flow into the draft.
 */
export function createVerifiedNewsroomArticleDraft(
  input: VerifiedNewsroomDraftInput,
): ArticlePublicationSnapshot {
  const parsed = verifiedDraftInputSchema.parse(input);
  if (parsed.event.state !== 'verified') {
    throw new ArticlePublicationInvariantError(
      'EVENT_NOT_VERIFIED',
      'Only a verified newsroom event can become an article draft.',
    );
  }
  if (parsed.activeEvidence.some((item) => item.stance === 'contradicting')) {
    throw new ArticlePublicationInvariantError(
      'UNRESOLVED_CONTRADICTION',
      'Resolve every active contradiction before creating an article draft.',
    );
  }

  const sortedCitableSupport = parsed.activeEvidence
    .filter(
      (item) =>
        item.stance === 'supporting' &&
        item.credible === true &&
        item.sourceTier !== undefined &&
        VERIFIED_SOURCE_TIER_ORDER.includes(
          item.sourceTier as (typeof VERIFIED_SOURCE_TIER_ORDER)[number],
        ),
    )
    .map((item) => ({
      label: item.label,
      url: safeHttpsUrl(item.url),
      sourceTier: item.sourceTier as 'primary' | 'official' | 'tier_1' | 'tier_2',
    }))
    .filter(
      (item): item is {
        label: string;
        url: string;
        sourceTier: 'primary' | 'official' | 'tier_1' | 'tier_2';
      } => Boolean(item.url),
    )
    .sort((left, right) =>
      VERIFIED_SOURCE_TIER_ORDER.indexOf(left.sourceTier) -
        VERIFIED_SOURCE_TIER_ORDER.indexOf(right.sourceTier) ||
      left.url.localeCompare(right.url) ||
      left.label.localeCompare(right.label),
    );
  const seenSourceUrls = new Set<string>();
  const citableSupport = sortedCitableSupport.filter((item) => {
    if (seenSourceUrls.has(item.url)) return false;
    seenSourceUrls.add(item.url);
    return true;
  });

  if (citableSupport.length === 0) {
    throw new ArticlePublicationInvariantError(
      'NO_CITABLE_SUPPORT',
      'A verified article draft requires at least one HTTPS supporting source.',
    );
  }

  const displayedSupport = citableSupport.slice(0, VERIFIED_DRAFT_SOURCE_LINK_LIMIT);
  const sourceLinks = displayedSupport
    .map(
      (item) =>
        `- [${escapeMarkdownLabel(truncateWithEllipsis(item.label, VERIFIED_DRAFT_SOURCE_LABEL_LIMIT))}](<${item.url}>)`,
    )
    .join('\n');
  const omittedSourceNote =
    citableSupport.length > displayedSupport.length
      ? `\n\n_Source trail shows ${displayedSupport.length} of ${citableSupport.length} qualifying sources. The complete evidence ledger remains in the BB Sports Live Desk._`
      : '';
  const summary =
    parsed.event.summary ||
    `BB Sports verified the following development: ${parsed.event.headline}.`;
  const safeSummary = escapeMarkdownPlainText(summary);
  const body = [
    '## What happened',
    '',
    safeSummary,
    '',
    '## Verified source trail',
    '',
    `${sourceLinks}${omittedSourceNote}`,
  ].join('\n');

  return normalizeArticlePublicationSnapshot({
    slug: slugifyArticleTitle(parsed.event.headline),
    title: truncateWithEllipsis(parsed.event.headline, 240),
    dek: truncateWithEllipsis(summary.replace(/\s+/g, ' '), 500),
    body,
    sport: truncateWithEllipsis(parsed.event.sport, 24),
    hero: '',
    heroAlt: '',
    heroCredit: '',
    authorName: parsed.authorName,
    aiAssisted: false,
    bradsTake: '',
  });
}
