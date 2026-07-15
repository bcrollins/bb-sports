/**
 * Newsroom provider governance — catalog, activation gates, credential presence,
 * retention/attribution posture, and operational status labels.
 *
 * This module is pure. It never opens a network connection, never returns a
 * secret value, and never claims a provider is "live" from configuration alone.
 * Transport, worker leases, and successful ingest evidence live elsewhere.
 */

import { createHash } from 'node:crypto';

export const NEWSROOM_PROVIDER_KEYS = [
  'x_filtered_stream',
  'bluesky_jetstream',
  'rss',
  'xai_x_search',
] as const;

export type NewsroomProviderKey = (typeof NEWSROOM_PROVIDER_KEYS)[number];

export const NEWSROOM_PROVIDER_KINDS = [
  'stream',
  'firehose',
  'poll',
  'query',
] as const;

export type NewsroomProviderKind = (typeof NEWSROOM_PROVIDER_KINDS)[number];

export const NEWSROOM_COMMERCIAL_STATUSES = [
  'approved',
  'review_required',
  'prohibited',
  'enterprise',
] as const;

export type NewsroomCommercialStatus = (typeof NEWSROOM_COMMERCIAL_STATUSES)[number];

export const NEWSROOM_CREDENTIAL_PRESENCE = [
  'absent',
  'present',
  'invalid',
] as const;

export type NewsroomCredentialPresence = (typeof NEWSROOM_CREDENTIAL_PRESENCE)[number];

export const NEWSROOM_PROVIDER_OPERATIONAL_LABELS = [
  'inactive',
  'degraded',
  'live',
] as const;

export type NewsroomProviderOperationalLabel =
  (typeof NEWSROOM_PROVIDER_OPERATIONAL_LABELS)[number];

export const NEWSROOM_ALLOWED_USES = [
  'none',
  'alerting_only',
  'internal_display',
  'corroboration_only',
] as const;

export type NewsroomAllowedUse = (typeof NEWSROOM_ALLOWED_USES)[number];

export const NEWSROOM_CURSOR_KINDS = [
  'none',
  'opaque',
  'time_us',
  'rss_etag',
  'x_post_id',
] as const;

export type NewsroomCursorKind = (typeof NEWSROOM_CURSOR_KINDS)[number];

export const NEWSROOM_INGEST_ATTEMPT_KINDS = [
  'connect',
  'poll',
  'parse',
  'persist',
  'checkpoint',
  'reconnect',
  'rate_limit',
  'shutdown',
  'lease',
] as const;

export type NewsroomIngestAttemptKind = (typeof NEWSROOM_INGEST_ATTEMPT_KINDS)[number];

export const NEWSROOM_INGEST_OUTCOMES = [
  'success',
  'failure',
  'rate_limited',
  'skipped',
  'duplicate',
  'dead_lettered',
] as const;

export type NewsroomIngestOutcome = (typeof NEWSROOM_INGEST_OUTCOMES)[number];

export type NewsroomRetentionPosture = Readonly<{
  storeRawPayload: false;
  storeSourceBodies: false;
  keepDisplayFieldsDays: number;
  keepTombstonesMonths: number;
  keepOperationalLogsDays: number;
  keepSecurityAuditDays: number;
  deletionComplianceRequired: boolean;
  notes: string;
}>;

export type NewsroomProviderCatalogEntry = Readonly<{
  providerKey: NewsroomProviderKey;
  displayName: string;
  providerKind: NewsroomProviderKind;
  commercialStatus: NewsroomCommercialStatus;
  commercialNotes: string;
  termsUrl: string | null;
  allowedUse: NewsroomAllowedUse;
  attributionPosture: string;
  retentionPosture: NewsroomRetentionPosture;
  credentialEnvNames: readonly string[];
  approvalEnvName: string;
  enableEnvName: string;
  cursorKind: NewsroomCursorKind;
  /** DB config_enabled always starts false for external providers. */
  configEnabledDefault: false;
}>;

const DEFAULT_RETENTION: NewsroomRetentionPosture = Object.freeze({
  storeRawPayload: false,
  storeSourceBodies: false,
  keepDisplayFieldsDays: 30,
  keepTombstonesMonths: 24,
  keepOperationalLogsDays: 30,
  keepSecurityAuditDays: 90,
  deletionComplianceRequired: true,
  notes:
    'Restricted provider text must not enter append-only ledgers. Tombstones retain IDs/hashes only.',
});

export const NEWSROOM_PROVIDER_CATALOG: Readonly<
  Record<NewsroomProviderKey, NewsroomProviderCatalogEntry>
> = Object.freeze({
  x_filtered_stream: Object.freeze({
    providerKey: 'x_filtered_stream',
    displayName: 'X Filtered Stream',
    providerKind: 'stream',
    commercialStatus: 'review_required',
    commercialNotes:
      'YELLOW. Requires approved X developer use case, prepaid credits, spend ceiling, and a dedicated deletion-compliance channel before transport may connect.',
    termsUrl: 'https://docs.x.com/developer-terms/policy',
    allowedUse: 'alerting_only',
    attributionPosture:
      'Alert operators with post IDs/URLs. Any displayed X content must satisfy X display requirements and stay current under edit/delete policy.',
    retentionPosture: Object.freeze({
      ...DEFAULT_RETENTION,
      notes:
        'X offline content must be updated or removed as soon as reasonably possible after edit/delete/privacy/suspension events. Prefer IDs and hashes over bodies.',
    }),
    credentialEnvNames: Object.freeze(['X_BEARER_TOKEN']),
    approvalEnvName: 'BBSPORTS_APPROVED_X_API',
    enableEnvName: 'BBSPORTS_NEWSROOM_X_ENABLED',
    cursorKind: 'x_post_id',
    configEnabledDefault: false,
  }),
  bluesky_jetstream: Object.freeze({
    providerKey: 'bluesky_jetstream',
    displayName: 'Bluesky Jetstream',
    providerKind: 'firehose',
    commercialStatus: 'review_required',
    commercialNotes:
      'YELLOW. Public Jetstream availability is not commercial approval or an SLA. Curated DIDs only; treat every event as an unverified lead until re-fetched authentically.',
    termsUrl: 'https://bsky.social/about/support/tos',
    allowedUse: 'alerting_only',
    attributionPosture:
      'Identify accounts by DID, not display handle alone. Link to the original post URI when shown to operators.',
    retentionPosture: Object.freeze({
      ...DEFAULT_RETENTION,
      notes:
        'Process deletes, identity changes, deactivation, and takedowns immediately. Clear display text; keep DID/rkey/cursor tombstones only.',
    }),
    credentialEnvNames: Object.freeze([]),
    approvalEnvName: 'BBSPORTS_APPROVED_BLUESKY_JETSTREAM',
    enableEnvName: 'BBSPORTS_NEWSROOM_BLUESKY_ENABLED',
    cursorKind: 'time_us',
    configEnabledDefault: false,
  }),
  rss: Object.freeze({
    providerKey: 'rss',
    displayName: 'Approved RSS feeds',
    providerKind: 'poll',
    commercialStatus: 'review_required',
    commercialNotes:
      'YELLOW/RED per feed. A generic RSS approval is never enough. Each feed needs a GREEN schema-enforced commercial record before enablement.',
    termsUrl: null,
    allowedUse: 'alerting_only',
    attributionPosture:
      'Link to the original source. Never store or republish feed/article bodies. Write original BB Sports copy only after verification.',
    retentionPosture: Object.freeze({
      ...DEFAULT_RETENTION,
      storeSourceBodies: false,
      notes: 'RSS bodies are transient parse-only. Retain feed URL, item GUID/URL, timestamps, and hashes.',
    }),
    credentialEnvNames: Object.freeze([]),
    approvalEnvName: 'BBSPORTS_APPROVED_NEWS_RSS',
    enableEnvName: 'BBSPORTS_NEWSROOM_RSS_ENABLED',
    cursorKind: 'rss_etag',
    configEnabledDefault: false,
  }),
  xai_x_search: Object.freeze({
    providerKey: 'xai_x_search',
    displayName: 'xAI X Search',
    providerKind: 'query',
    commercialStatus: 'review_required',
    commercialNotes:
      'YELLOW. Query-time corroboration only — not a stream and not an independent second owner. Budget and approval required.',
    termsUrl: 'https://docs.x.ai/developers/tools/x-search',
    allowedUse: 'corroboration_only',
    attributionPosture:
      'Persist citations and evaluate underlying sources. Model answers are never evidence.',
    retentionPosture: Object.freeze({
      ...DEFAULT_RETENTION,
      deletionComplianceRequired: true,
      notes: 'Store citations and provenance metadata; do not treat model text as evidence.',
    }),
    credentialEnvNames: Object.freeze(['XAI_API_KEY']),
    approvalEnvName: 'BBSPORTS_APPROVED_XAI',
    enableEnvName: 'BBSPORTS_NEWSROOM_XAI_ENABLED',
    cursorKind: 'none',
    configEnabledDefault: false,
  }),
});

export type ProviderEnvironment = Readonly<Record<string, string | undefined>>;

export type ProviderActivationSnapshot = Readonly<{
  providerKey: NewsroomProviderKey;
  globalEnabled: boolean;
  envEnabled: boolean;
  envApproved: boolean;
  configEnabled: boolean;
  commercialStatus: NewsroomCommercialStatus;
  credentialPresence: NewsroomCredentialPresence;
  credentialEnvNames: readonly string[];
  /** Never true from configuration alone. Worker health is a separate evidence path. */
  transportAllowed: false;
  blockers: readonly string[];
  operationalLabel: NewsroomProviderOperationalLabel;
}>;

export type ProviderRuntimeEvidence = Readonly<{
  /** True only when a worker currently holds an unexpired lease for this provider. */
  leaseHeld: boolean;
  /** True only when a successful ingest attempt is newer than the lag threshold. */
  recentSuccess: boolean;
  /** True when the latest terminal attempt was a rate limit or reconnect storm. */
  degraded: boolean;
}>;

const GLOBAL_ENABLE_ENV = 'BBSPORTS_REALTIME_NEWSROOM_ENABLED';

export function isNewsroomProviderKey(value: string): value is NewsroomProviderKey {
  return (NEWSROOM_PROVIDER_KEYS as readonly string[]).includes(value);
}

export function getNewsroomProviderCatalogEntry(
  providerKey: NewsroomProviderKey,
): NewsroomProviderCatalogEntry {
  return NEWSROOM_PROVIDER_CATALOG[providerKey];
}

/**
 * Reports credential presence without exposing secret material.
 * Whitespace-only values are absent. Nonblank values are present unless a
 * provider-specific shape check rejects them as invalid.
 */
export function readCredentialPresence(
  providerKey: NewsroomProviderKey,
  environment: ProviderEnvironment = process.env,
): NewsroomCredentialPresence {
  const entry = NEWSROOM_PROVIDER_CATALOG[providerKey];
  if (entry.credentialEnvNames.length === 0) {
    return 'present';
  }

  let sawInvalid = false;
  for (const envName of entry.credentialEnvNames) {
    const raw = environment[envName];
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return 'absent';
    }
    if (!credentialShapeLooksValid(providerKey, envName, raw)) {
      sawInvalid = true;
    }
  }
  return sawInvalid ? 'invalid' : 'present';
}

function credentialShapeLooksValid(
  providerKey: NewsroomProviderKey,
  envName: string,
  value: string,
): boolean {
  if (value !== value.trim()) return false;
  if (value.length > 4_096) return false;
  if (!/^[\x21-\x7e]+$/.test(value)) return false;

  if (providerKey === 'x_filtered_stream' && envName === 'X_BEARER_TOKEN') {
    return value.length >= 16;
  }
  if (providerKey === 'xai_x_search' && envName === 'XAI_API_KEY') {
    return value.length >= 16;
  }
  return true;
}

/**
 * Non-secret fingerprint of which credential env names are populated.
 * Useful for config digests; never includes secret bytes.
 */
export function credentialPresenceDigest(
  providerKey: NewsroomProviderKey,
  environment: ProviderEnvironment = process.env,
): string {
  const entry = NEWSROOM_PROVIDER_CATALOG[providerKey];
  const presence = entry.credentialEnvNames
    .map((name) => {
      const raw = environment[name];
      const state =
        typeof raw === 'string' && raw.trim().length > 0 ? 'present' : 'absent';
      return `${name}=${state}`;
    })
    .join(';');
  return createHash('sha256').update(`${providerKey}|${presence}`).digest('hex');
}

export function createProviderPayloadHash(
  providerKey: NewsroomProviderKey,
  externalId: string,
  canonicalFields: Readonly<Record<string, string | number | boolean | null>>,
): string {
  const payload = JSON.stringify({
    providerKey,
    externalId,
    fields: canonicalFields,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function createProviderExternalIdentity(
  providerKey: NewsroomProviderKey,
  externalId: string,
): string {
  const trimmed = externalId.trim();
  if (!trimmed) {
    throw new TypeError('External identity requires a nonblank provider identifier');
  }
  return `${providerKey}:${trimmed}`;
}

/**
 * Evaluates whether configuration would permit a future transport activation.
 * `transportAllowed` is always false here: live transport additionally requires
 * a worker lease, deletion/compliance readiness, and successful runtime evidence.
 */
export function evaluateProviderActivation(options: Readonly<{
  providerKey: NewsroomProviderKey;
  configEnabled: boolean;
  commercialStatus: NewsroomCommercialStatus;
  environment?: ProviderEnvironment;
  runtime?: ProviderRuntimeEvidence;
}>): ProviderActivationSnapshot {
  const entry = NEWSROOM_PROVIDER_CATALOG[options.providerKey];
  const environment = options.environment ?? process.env;
  const globalEnabled = environment[GLOBAL_ENABLE_ENV] !== 'false';
  const envEnabled = environment[entry.enableEnvName] === 'true';
  const envApproved = environment[entry.approvalEnvName] === 'true';
  const credentialPresence = readCredentialPresence(options.providerKey, environment);
  const blockers: string[] = [];

  if (!globalEnabled) blockers.push('global_disabled');
  if (!envEnabled) blockers.push('connector_disabled');
  if (!envApproved) blockers.push('env_approval_missing');
  if (!options.configEnabled) blockers.push('config_disabled');
  if (options.commercialStatus !== 'approved') {
    blockers.push(`commercial_${options.commercialStatus}`);
  }
  if (credentialPresence === 'absent') blockers.push('credential_missing');
  if (credentialPresence === 'invalid') blockers.push('credential_invalid');

  const runtime = options.runtime ?? {
    leaseHeld: false,
    recentSuccess: false,
    degraded: false,
  };

  // Configuration may be complete while transport remains intentionally blocked
  // until a dedicated worker proves connectivity. Never report "live" from
  // env/config alone.
  let operationalLabel: NewsroomProviderOperationalLabel = 'inactive';
  if (runtime.degraded && (runtime.leaseHeld || envEnabled)) {
    operationalLabel = 'degraded';
  } else if (
    blockers.length === 0 &&
    runtime.leaseHeld &&
    runtime.recentSuccess &&
    !runtime.degraded
  ) {
    // Even when all gates are green and a worker is healthy, this pure module
    // still refuses transportAllowed. A later worker status reporter may map
    // this evidence to a desk "live" label only after real ingest success.
    operationalLabel = 'live';
  } else if (blockers.length === 0 && runtime.leaseHeld && !runtime.recentSuccess) {
    operationalLabel = 'degraded';
  }

  return Object.freeze({
    providerKey: options.providerKey,
    globalEnabled,
    envEnabled,
    envApproved,
    configEnabled: options.configEnabled,
    commercialStatus: options.commercialStatus,
    credentialPresence,
    credentialEnvNames: entry.credentialEnvNames,
    transportAllowed: false,
    blockers: Object.freeze([...blockers]),
    operationalLabel,
  });
}

export function summarizeProviderDeskSources(
  activations: readonly ProviderActivationSnapshot[],
): 'Manual only' | 'Monitoring configured' | 'Live monitoring' | 'Degraded monitoring' {
  if (activations.some((item) => item.operationalLabel === 'live')) {
    return 'Live monitoring';
  }
  if (activations.some((item) => item.operationalLabel === 'degraded')) {
    return 'Degraded monitoring';
  }
  if (
    activations.some(
      (item) =>
        item.envEnabled ||
        item.configEnabled ||
        item.commercialStatus === 'approved',
    )
  ) {
    // Env/config/approval crumbs only. A bare credential or a keyless
    // provider catalog entry must never become a "live" or even
    // "configured monitoring" claim on the desk.
    return 'Monitoring configured';
  }
  return 'Manual only';
}

/** Known-harmless Postgres bootstrap notices only. Warnings/errors stay visible. */
export function isHarmlessBootstrapNotice(notice: Readonly<{
  severity?: string | null;
  message?: string | null;
  code?: string | null;
}>): boolean {
  const severity = (notice.severity ?? '').toUpperCase();
  if (severity && severity !== 'NOTICE' && severity !== 'INFO') {
    return false;
  }

  const message = notice.message ?? '';
  // Postgres IF [NOT] EXISTS cold-bootstrap chatter only.
  return (
    /already exists, skipping$/i.test(message) ||
    /does not exist, skipping$/i.test(message) ||
    /^relation ".+" already exists, skipping$/i.test(message) ||
    /^column ".+" of relation ".+" already exists, skipping$/i.test(message) ||
    /^constraint ".+" (?:for relation ".+" )?already exists/i.test(message) ||
    /^constraint ".+" of relation ".+" does not exist, skipping$/i.test(message) ||
    /^index ".+" already exists/i.test(message) ||
    /^trigger ".+" for relation ".+" already exists/i.test(message) ||
    /^trigger ".+" for relation ".+" does not exist, skipping$/i.test(message) ||
    /^schema ".+" already exists/i.test(message) ||
    /^extension ".+" already exists/i.test(message) ||
    /^type ".+" already exists/i.test(message) ||
    /^function ".+" already exists/i.test(message)
  );
}
