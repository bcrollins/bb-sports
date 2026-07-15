/**
 * Provider ingestion contract — pure normalization and validation.
 *
 * External signals may become newsroom signals and activity only. This module
 * never opens a network connection, never marks events verified, and never
 * publishes articles. Restricted provider bodies stay out of append-only
 * provenance; only bounded alert fields and identity metadata are accepted.
 */

import { z } from 'zod';
import {
  createExactContentHash,
  createExactUrlHash,
  normalizeExactNewsUrl,
} from './newsroom-clustering';
import {
  createProviderExternalIdentity,
  createProviderPayloadHash,
  isNewsroomProviderKey,
  NEWSROOM_PROVIDER_KEYS,
  type NewsroomProviderKey,
} from './newsroom-providers';
import type { XPostLeadAction } from './newsroom-connectors/x-filtered-stream';

export const PROVIDER_INTAKE_SOURCE_PREFIX = 'provider-intake:' as const;
export const MAX_PROVIDER_HEADLINE_CHARS = 320;
export const MAX_PROVIDER_SUMMARY_CHARS = 500;
export const MAX_PROVIDER_PROVENANCE_KEYS = 32;
export const MAX_PROVIDER_PROVENANCE_JSON_BYTES = 4_096;
export const MAX_PROVIDER_EXTERNAL_ID_CHARS = 320;

const SECRET_KEY_PATTERN = /token|secret|password|authorization|bearer|cookie|api[_-]?key/i;

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2_048)
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Only HTTPS source URLs are accepted');

const boundedText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value),
      'Control characters are not allowed',
    );

/**
 * Bounded, non-secret provenance only. Rejects secret-looking keys and oversized
 * payloads so restricted provider bodies cannot sneak into durable storage.
 */
export const providerProvenanceSchema = z
  .record(z.string().max(64), z.union([z.string().max(2_000), z.number(), z.boolean(), z.null()]))
  .superRefine((value, context) => {
    const keys = Object.keys(value);
    if (keys.length > MAX_PROVIDER_PROVENANCE_KEYS) {
      context.addIssue({
        code: 'custom',
        message: `Provenance may include at most ${MAX_PROVIDER_PROVENANCE_KEYS} keys`,
      });
    }
    for (const key of keys) {
      if (SECRET_KEY_PATTERN.test(key)) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'Provenance must not include secret-bearing keys',
        });
      }
    }
    const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (bytes > MAX_PROVIDER_PROVENANCE_JSON_BYTES) {
      context.addIssue({
        code: 'custom',
        message: `Provenance exceeds ${MAX_PROVIDER_PROVENANCE_JSON_BYTES} bytes`,
      });
    }
  });

export const providerIngestCandidateSchema = z.object({
  providerKey: z.enum(NEWSROOM_PROVIDER_KEYS),
  externalId: boundedText(MAX_PROVIDER_EXTERNAL_ID_CHARS),
  ownerKey: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .transform((value) => value.toLocaleLowerCase('en-US')),
  ownerIdentity: boundedText(240),
  headline: boundedText(MAX_PROVIDER_HEADLINE_CHARS),
  summary: z
    .string()
    .trim()
    .max(MAX_PROVIDER_SUMMARY_CHARS)
    .default('')
    .transform((value) => value.slice(0, MAX_PROVIDER_SUMMARY_CHARS)),
  canonicalUrl: httpsUrlSchema.optional(),
  sourcePublishedAt: z.coerce.date().optional(),
  observedAt: z.coerce.date().optional(),
  sport: z.string().trim().min(1).max(40).default('General'),
  urgency: z.enum(['routine', 'watch', 'breaking']).default('routine'),
  provenance: providerProvenanceSchema.default({}),
  /** Optional precomputed hash; recomputed and compared when present. */
  payloadHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  /**
   * Optional registered news_sources.source_key. Defaults to the seeded
   * provider-intake row for this provider.
   */
  sourceKey: z.string().trim().min(3).max(120).optional(),
});

export type ProviderIngestCandidateInput = z.input<typeof providerIngestCandidateSchema>;
export type ProviderIngestCandidate = z.output<typeof providerIngestCandidateSchema>;

export type NormalizedProviderIngest = Readonly<{
  providerKey: NewsroomProviderKey;
  externalId: string;
  externalIdentity: string;
  ownerKey: string;
  ownerIdentity: string;
  headline: string;
  summary: string;
  sport: string;
  urgency: 'routine' | 'watch' | 'breaking';
  canonicalUrl: string | null;
  exactUrlHash: string | null;
  exactContentHash: string;
  payloadHash: string;
  sourcePublishedAt: Date | null;
  observedAt: Date;
  sourceKey: string;
  provenance: Readonly<Record<string, string | number | boolean | null>>;
  rawPayload: Readonly<Record<string, unknown>>;
}>;

export function providerIntakeSourceKey(providerKey: NewsroomProviderKey): string {
  return `${PROVIDER_INTAKE_SOURCE_PREFIX}${providerKey}`;
}

export function normalizeProviderIngestCandidate(
  input: ProviderIngestCandidateInput,
): NormalizedProviderIngest {
  const parsed = providerIngestCandidateSchema.parse(input);
  const canonicalUrl = parsed.canonicalUrl
    ? normalizeExactNewsUrl(parsed.canonicalUrl)
    : null;
  const exactUrlHash = createExactUrlHash(canonicalUrl);
  const exactContentHash = createExactContentHash(parsed.headline, parsed.summary);
  const payloadHash = createProviderPayloadHash(parsed.providerKey, parsed.externalId, {
    ownerKey: parsed.ownerKey,
    ownerIdentity: parsed.ownerIdentity,
    headline: parsed.headline,
    summary: parsed.summary,
    canonicalUrl: canonicalUrl ?? '',
    sourcePublishedAt: parsed.sourcePublishedAt?.toISOString() ?? '',
  });

  if (parsed.payloadHash && parsed.payloadHash !== payloadHash) {
    throw new TypeError('Provided payloadHash does not match the canonical provider payload.');
  }

  const observedAt = parsed.observedAt ?? new Date();
  const sourceKey = parsed.sourceKey ?? providerIntakeSourceKey(parsed.providerKey);
  const provenance = Object.freeze({ ...parsed.provenance });

  // Durable raw payload is identity + hashes only. Full restricted bodies are
  // intentionally excluded even when the candidate headline was derived from them.
  const rawPayload = Object.freeze({
    intake: 'provider',
    providerKey: parsed.providerKey,
    externalId: parsed.externalId,
    externalIdentity: createProviderExternalIdentity(parsed.providerKey, parsed.externalId),
    ownerKey: parsed.ownerKey,
    ownerIdentity: parsed.ownerIdentity,
    payloadHash,
    exactContentHash,
    exactUrlHash,
    sourcePublishedAt: parsed.sourcePublishedAt?.toISOString() ?? null,
    provenance,
  });

  return Object.freeze({
    providerKey: parsed.providerKey,
    externalId: parsed.externalId,
    externalIdentity: createProviderExternalIdentity(parsed.providerKey, parsed.externalId),
    ownerKey: parsed.ownerKey,
    ownerIdentity: parsed.ownerIdentity,
    headline: parsed.headline,
    summary: parsed.summary,
    sport: parsed.sport,
    urgency: parsed.urgency,
    canonicalUrl,
    exactUrlHash,
    exactContentHash,
    payloadHash,
    sourcePublishedAt: parsed.sourcePublishedAt ?? null,
    observedAt,
    sourceKey,
    provenance,
    rawPayload,
  });
}

function truncateAlertText(value: string, max: number): string {
  const normalized = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Map an official X Filtered Stream lead into a bounded ingest candidate.
 * Transport remains disabled elsewhere; this is a pure mapping only.
 */
export function xPostLeadToIngestCandidate(
  lead: XPostLeadAction,
): ProviderIngestCandidateInput {
  const text = typeof lead.text === 'string' ? lead.text : '';
  const headline = truncateAlertText(text || `X post ${lead.postId}`, MAX_PROVIDER_HEADLINE_CHARS);
  const summary = truncateAlertText(text, MAX_PROVIDER_SUMMARY_CHARS);
  const ownerHandle = (lead.authorUsername ?? lead.watchedHandle ?? lead.authorId ?? 'unknown')
    .toString()
    .toLocaleLowerCase('en-US');

  return {
    providerKey: 'x_filtered_stream',
    externalId: lead.externalId,
    ownerKey: `x:${ownerHandle}`,
    ownerIdentity: lead.authorId ? `x:user:${lead.authorId}` : `x:handle:${ownerHandle}`,
    headline,
    summary,
    canonicalUrl: lead.sourceUrl,
    sourcePublishedAt: new Date(lead.sourceCreatedAt),
    sport: 'General',
    urgency: 'routine',
    provenance: {
      postId: lead.postId,
      authorId: lead.authorId,
      authorUsername: lead.authorUsername,
      watchedHandle: lead.watchedHandle,
      isEdit: lead.editLineage.isEdit,
      rootPostId: lead.editLineage.rootPostId,
      trust: lead.trust,
      reviewRequired: lead.reviewRequired,
    },
  };
}

type BlueskyPostLeadLike = Readonly<{
  provider: 'bluesky-jetstream';
  type: 'post_lead' | string;
  did: string;
  rkey?: string;
  externalId?: string;
  sourceUrl?: string;
  text?: string;
  sourceCreatedAt?: string;
  accountKey?: string;
  handle?: string | null;
  trust?: string;
  reviewRequired?: boolean;
}>;

/**
 * Map a Bluesky Jetstream post lead into a bounded ingest candidate.
 * Identity is DID-first; display handles are never treated as stable identity.
 */
export function blueskyPostLeadToIngestCandidate(
  lead: BlueskyPostLeadLike,
): ProviderIngestCandidateInput {
  if (!lead.did.startsWith('did:plc:')) {
    throw new TypeError('Bluesky ingest requires a did:plc identity.');
  }
  const rkey = lead.rkey ?? lead.externalId?.split('/').pop() ?? 'unknown';
  const externalId = lead.externalId ?? `at://${lead.did}/app.bsky.feed.post/${rkey}`;
  const text = typeof lead.text === 'string' ? lead.text : '';
  const headline = truncateAlertText(
    text || `Bluesky post ${rkey}`,
    MAX_PROVIDER_HEADLINE_CHARS,
  );
  const summary = truncateAlertText(text, MAX_PROVIDER_SUMMARY_CHARS);
  const sourceUrl =
    lead.sourceUrl ??
    `https://bsky.app/profile/${encodeURIComponent(lead.did)}/post/${encodeURIComponent(rkey)}`;

  return {
    providerKey: 'bluesky_jetstream',
    externalId,
    ownerKey: `bluesky:${lead.did.toLocaleLowerCase('en-US')}`,
    ownerIdentity: lead.did,
    headline,
    summary,
    canonicalUrl: sourceUrl.startsWith('https://') ? sourceUrl : undefined,
    sourcePublishedAt: lead.sourceCreatedAt ? new Date(lead.sourceCreatedAt) : undefined,
    sport: 'General',
    urgency: 'routine',
    provenance: {
      did: lead.did,
      rkey,
      handle: lead.handle ?? null,
      accountKey: lead.accountKey ?? `bluesky:${lead.did}`,
      trust: lead.trust ?? 'untrusted',
      reviewRequired: lead.reviewRequired ?? true,
      identityBasis: 'did',
    },
  };
}

export type ProviderIngestGateDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      reason:
        | 'provider_missing'
        | 'provider_prohibited'
        | 'provider_disabled'
        | 'commercial_not_approved'
        | 'source_missing'
        | 'source_disabled'
        | 'source_owner_mismatch'
        | 'source_commercial_blocked';
    }>;

/**
 * Fail-closed gate for the durable ingest transaction. Transport activation is
 * a separate concern; this only decides whether a normalized candidate may be
 * written into the newsroom signal ledger.
 */
export function decideProviderIngestGate(options: Readonly<{
  provider: {
    providerKey: string;
    configEnabled: boolean;
    commercialStatus: string;
  } | null;
  source: {
    sourceKey: string;
    enabled: boolean;
    ownerKey: string;
    commercialStatus: string;
  } | null;
  candidateOwnerKey: string;
}>): ProviderIngestGateDecision {
  if (!options.provider) {
    return Object.freeze({ allowed: false, reason: 'provider_missing' });
  }
  if (!isNewsroomProviderKey(options.provider.providerKey)) {
    return Object.freeze({ allowed: false, reason: 'provider_missing' });
  }
  if (options.provider.commercialStatus === 'prohibited') {
    return Object.freeze({ allowed: false, reason: 'provider_prohibited' });
  }
  if (options.provider.commercialStatus === 'enterprise') {
    return Object.freeze({ allowed: false, reason: 'commercial_not_approved' });
  }
  if (!options.provider.configEnabled) {
    return Object.freeze({ allowed: false, reason: 'provider_disabled' });
  }
  if (options.provider.commercialStatus !== 'approved') {
    return Object.freeze({ allowed: false, reason: 'commercial_not_approved' });
  }
  if (!options.source) {
    return Object.freeze({ allowed: false, reason: 'source_missing' });
  }
  if (!options.source.enabled) {
    return Object.freeze({ allowed: false, reason: 'source_disabled' });
  }
  if (options.source.commercialStatus === 'prohibited') {
    return Object.freeze({ allowed: false, reason: 'source_commercial_blocked' });
  }
  // Provider intake sources may use a synthetic owner; account-scoped sources
  // must match the candidate owner key exactly.
  if (
    !options.source.sourceKey.startsWith(PROVIDER_INTAKE_SOURCE_PREFIX) &&
    options.source.ownerKey !== options.candidateOwnerKey
  ) {
    return Object.freeze({ allowed: false, reason: 'source_owner_mismatch' });
  }
  return Object.freeze({ allowed: true });
}

/** Editorial mutation paths that must never be reachable from provider ingest. */
export const PROVIDER_INGEST_FORBIDDEN_ACTIONS = Object.freeze([
  'event.verified',
  'event.verification_failed',
  'article.published',
  'article.unpublished',
  'publish',
] as const);
