import { z } from 'zod';

export const BLUESKY_POST_COLLECTION = 'app.bsky.feed.post' as const;
export const BLUESKY_JETSTREAM_ENDPOINTS = Object.freeze([
  'wss://jetstream2.us-east.bsky.network/subscribe',
  'wss://jetstream1.us-east.bsky.network/subscribe',
  'wss://jetstream2.us-west.bsky.network/subscribe',
  'wss://jetstream1.us-west.bsky.network/subscribe',
] as const);
export type BlueskyJetstreamEndpoint = (typeof BLUESKY_JETSTREAM_ENDPOINTS)[number];
export const BLUESKY_JETSTREAM_ENDPOINT = BLUESKY_JETSTREAM_ENDPOINTS[0];

export const MAX_JETSTREAM_PAYLOAD_BYTES = 64 * 1_024;
export const MAX_BLUESKY_POST_TEXT_CHARS = 1_000;
export const MAX_BLUESKY_WANTED_DIDS = 100;
export const DEFAULT_JETSTREAM_REWIND_US = 5_000_000;
export const MAX_JETSTREAM_REWIND_US = 60_000_000;
export const MAX_JETSTREAM_LOOKBACK_US = 24 * 60 * 60 * 1_000_000;

/**
 * WebSocket transport code must enforce this raw-message boundary before
 * decoding or concatenating a payload. Jetstream receives the same cap in its
 * subscription URL, while this local prebuffer limit remains authoritative.
 */
export const BLUESKY_JETSTREAM_TRANSPORT_CONTRACT = Object.freeze({
  framing: 'websocket_message' as const,
  parserMaxPayloadBytes: MAX_JETSTREAM_PAYLOAD_BYTES,
  transportMaxPrebufferBytes: MAX_JETSTREAM_PAYLOAD_BYTES,
  overflowDisposition: 'terminate_connection_before_parse' as const,
});

const PLC_DID_PATTERN = /^did:plc:[a-z2-7]{24}$/;
const RECORD_KEY_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9._~:-]{1,512}$/;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function validRfc3339Timestamp(value: string): boolean {
  if (!RFC3339_PATTERN.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const second = Number(value.slice(17, 19));
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > maxDay) return false;
  if (!value.endsWith('Z')) {
    const offsetHour = Number(value.slice(-5, -3));
    const offsetMinute = Number(value.slice(-2));
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isFinite(next) || next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function normalizeSafeText(value: string): string | null {
  if (hasUnpairedSurrogate(value)) return null;
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n');
  if (
    normalized.trim().length === 0 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

const blueskyDidSchema = z
  .string()
  .max(32)
  .regex(PLC_DID_PATTERN, 'Expected a valid did:plc identifier');
const cursorSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const recordKeySchema = z.string().max(512).regex(RECORD_KEY_PATTERN);
const cidSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9]+$/);
const timestampSchema = z
  .string()
  .max(64)
  .refine(validRfc3339Timestamp, 'Expected a strict RFC 3339 timestamp');

const envelopeSchema = z.object({
  did: blueskyDidSchema,
  time_us: cursorSchema,
  kind: z.string().min(1).max(32),
});

const commitSchema = z.object({
  operation: z.enum(['create', 'update', 'delete']),
  collection: z.string().min(1).max(128),
  rkey: z.string().min(1).max(512),
  cid: cidSchema.optional(),
  record: z.unknown().optional(),
});

const postRecordSchema = z.object({
  $type: z.literal(BLUESKY_POST_COLLECTION),
  text: z.string().max(MAX_BLUESKY_POST_TEXT_CHARS),
  createdAt: timestampSchema,
});

const identitySchema = z.object({
  did: blueskyDidSchema.optional(),
  handle: z
    .string()
    .min(1)
    .max(253)
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/)
    .optional()
    .nullable(),
});

const accountSchema = z.object({
  did: blueskyDidSchema.optional(),
  active: z.boolean(),
  status: z.string().min(1).max(64).optional().nullable(),
});

export type BlueskyPlcDid = `did:plc:${string}`;

export type BlueskyJetstreamDisabledReason =
  | 'global_disabled'
  | 'connector_disabled'
  | 'approval_missing'
  | 'allowlist_missing'
  | 'allowlist_invalid';

export type BlueskyJetstreamStaticPreflight =
  | Readonly<{
      passed: false;
      connectionAllowed: false;
      reason: BlueskyJetstreamDisabledReason;
    }>
  | Readonly<{
      passed: true;
      connectionAllowed: false;
      activationBlocker: 'runtime_transport_not_implemented';
      endpoints: readonly BlueskyJetstreamEndpoint[];
      collection: typeof BLUESKY_POST_COLLECTION;
      wantedDids: readonly BlueskyPlcDid[];
    }>;

type ConnectorEnvironment = Readonly<Record<string, string | undefined>>;

export type JetstreamCursorCheckpoint = Readonly<{
  timeUs: number;
}>;

export type JetstreamReplayCursorPlan = Readonly<{
  cursorUs: number;
  retentionGap: boolean;
  rewindClamped: boolean;
}>;

export type BlueskyJetstreamSubscriptionPlan = Readonly<{
  endpoint: BlueskyJetstreamEndpoint;
  url: string;
  cursor: JetstreamReplayCursorPlan | null;
  retentionGap: boolean;
}>;

type JetstreamActionBase = Readonly<{
  provider: 'bluesky-jetstream';
  did: BlueskyPlcDid;
  accountKey: `bluesky:${BlueskyPlcDid}`;
  trust: 'untrusted';
  reviewRequired: true;
  eventTimeUs: number;
  eventTime: string;
  externalId: string;
}>;

export type BlueskyPostUpsertAction = JetstreamActionBase &
  Readonly<{
    type: 'post_upsert';
    operation: 'create' | 'update';
    collection: typeof BLUESKY_POST_COLLECTION;
    rkey: string;
    cid: string | null;
    sourceUrl: string;
    sourceCreatedAt: string;
    text: string;
  }>;

export type BlueskyPostDeleteAction = JetstreamActionBase &
  Readonly<{
    type: 'post_delete';
    operation: 'delete';
    collection: typeof BLUESKY_POST_COLLECTION;
    rkey: string;
    sourceUrl: string;
  }>;

export type BlueskyIdentityAction = JetstreamActionBase &
  Readonly<{
    type: 'identity';
    handle: string | null;
  }>;

export type BlueskyAccountAction = JetstreamActionBase &
  Readonly<{
    type: 'account';
    active: boolean;
    status: string | null;
  }>;

export type BlueskyAccountTakedownAction = JetstreamActionBase &
  Readonly<{
    type: 'account_takedown';
    active: false;
    status: 'takendown';
  }>;

export type BlueskyJetstreamAction =
  | BlueskyPostUpsertAction
  | BlueskyPostDeleteAction
  | BlueskyIdentityAction
  | BlueskyAccountAction
  | BlueskyAccountTakedownAction;

export type BlueskyJetstreamParseResult =
  | Readonly<{ status: 'action'; action: BlueskyJetstreamAction }>
  | Readonly<{
      status: 'ignored';
      reason: 'not_allowlisted' | 'collection_not_requested' | 'unsupported_kind';
    }>
  | Readonly<{
      status: 'rejected';
      reason:
        | 'invalid_allowlist'
        | 'invalid_payload_type'
        | 'payload_too_large'
        | 'invalid_utf8'
        | 'invalid_json'
        | 'invalid_envelope'
        | 'invalid_commit'
        | 'invalid_record'
        | 'invalid_identity'
        | 'invalid_account';
    }>;

function parseWantedDids(raw: string): readonly BlueskyPlcDid[] | null {
  const values = raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0 || values.length > MAX_BLUESKY_WANTED_DIDS) return null;
  if (values.some((value) => !PLC_DID_PATTERN.test(value))) return null;

  return [...new Set(values)].sort() as BlueskyPlcDid[];
}

function validateWantedDids(wantedDids: readonly string[]): readonly BlueskyPlcDid[] | null {
  if (wantedDids.length === 0 || wantedDids.length > MAX_BLUESKY_WANTED_DIDS) return null;
  if (wantedDids.some((did) => !PLC_DID_PATTERN.test(did))) return null;
  return [...new Set(wantedDids)].sort() as BlueskyPlcDid[];
}

/**
 * Performs static input checks only. Passing does not activate a connection;
 * the runtime transport and its prebuffer enforcement are a separate interval.
 * Every gate, including the global gate, requires the exact value `true`.
 */
export function readBlueskyJetstreamStaticPreflight(
  environment: ConnectorEnvironment = process.env,
): BlueskyJetstreamStaticPreflight {
  if (environment.BBSPORTS_REALTIME_NEWSROOM_ENABLED !== 'true') {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'global_disabled' });
  }
  if (environment.BBSPORTS_NEWSROOM_BLUESKY_ENABLED !== 'true') {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'connector_disabled' });
  }
  if (environment.BBSPORTS_APPROVED_BLUESKY_JETSTREAM !== 'true') {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'approval_missing' });
  }

  const rawWantedDids = environment.BBSPORTS_BLUESKY_WANTED_DIDS;
  if (!rawWantedDids?.trim()) {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'allowlist_missing' });
  }

  const wantedDids = parseWantedDids(rawWantedDids);
  if (!wantedDids) {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'allowlist_invalid' });
  }

  return Object.freeze({
    passed: true,
    connectionAllowed: false,
    activationBlocker: 'runtime_transport_not_implemented',
    endpoints: BLUESKY_JETSTREAM_ENDPOINTS,
    collection: BLUESKY_POST_COLLECTION,
    wantedDids: Object.freeze([...wantedDids]),
  });
}

function requireCursor(value: unknown, label: string): number {
  const parsed = cursorSchema.safeParse(value);
  if (!parsed.success) throw new TypeError(`${label} must be a nonnegative safe integer`);
  return parsed.data;
}

export function checkpointJetstreamCursor(
  current: JetstreamCursorCheckpoint | null | undefined,
  eventTimeUs: number,
): JetstreamCursorCheckpoint {
  const next = requireCursor(eventTimeUs, 'eventTimeUs');
  if (!current) return Object.freeze({ timeUs: next });
  return Object.freeze({
    timeUs: Math.max(requireCursor(current.timeUs, 'checkpoint.timeUs'), next),
  });
}

export function calculateJetstreamReplayCursor(
  checkpoint: JetstreamCursorCheckpoint,
  options: Readonly<{
    nowUs?: number;
    rewindUs?: number;
  }> = {},
): JetstreamReplayCursorPlan {
  const checkpointUs = requireCursor(checkpoint.timeUs, 'checkpoint.timeUs');
  const nowUs = requireCursor(options.nowUs ?? Date.now() * 1_000, 'nowUs');
  const requestedRewind = requireCursor(
    options.rewindUs ?? DEFAULT_JETSTREAM_REWIND_US,
    'rewindUs',
  );
  const rewindUs = Math.min(requestedRewind, MAX_JETSTREAM_REWIND_US);
  const newestAllowed = Math.min(checkpointUs, nowUs);
  const oldestAllowed = Math.max(0, nowUs - MAX_JETSTREAM_LOOKBACK_US);
  const requestedCursorUs = Math.max(newestAllowed - rewindUs, 0);
  const cursorUs = Math.max(oldestAllowed, requestedCursorUs);
  return Object.freeze({
    cursorUs,
    retentionGap: requestedCursorUs < oldestAllowed,
    rewindClamped: requestedRewind > MAX_JETSTREAM_REWIND_US,
  });
}

export function buildBlueskyPostUrl(did: string, rkey: string): string {
  if (!blueskyDidSchema.safeParse(did).success) throw new TypeError('Invalid Bluesky DID');
  if (!recordKeySchema.safeParse(rkey).success) throw new TypeError('Invalid Bluesky record key');
  return `https://bsky.app/profile/${encodeURIComponent(did)}/post/${encodeURIComponent(rkey)}`;
}

export function selectBlueskyJetstreamEndpoint(failoverAttempt = 0): BlueskyJetstreamEndpoint {
  if (!Number.isSafeInteger(failoverAttempt) || failoverAttempt < 0 || failoverAttempt > 1_000) {
    throw new TypeError('failoverAttempt must be an integer between 0 and 1000');
  }
  return BLUESKY_JETSTREAM_ENDPOINTS[failoverAttempt % BLUESKY_JETSTREAM_ENDPOINTS.length];
}

export function buildBlueskyJetstreamSubscriptionPlan(options: Readonly<{
  wantedDids: readonly string[];
  checkpoint?: JetstreamCursorCheckpoint;
  nowUs?: number;
  rewindUs?: number;
  failoverAttempt?: number;
}>): BlueskyJetstreamSubscriptionPlan {
  const wantedDids = validateWantedDids(options.wantedDids);
  if (!wantedDids) throw new TypeError('A valid, nonempty curated Bluesky DID allowlist is required');

  const endpoint = selectBlueskyJetstreamEndpoint(options.failoverAttempt);
  const url = new URL(endpoint);
  url.searchParams.append('wantedCollections', BLUESKY_POST_COLLECTION);
  for (const did of wantedDids) url.searchParams.append('wantedDids', did);
  url.searchParams.set('maxMessageSizeBytes', String(MAX_JETSTREAM_PAYLOAD_BYTES));
  let cursor: JetstreamReplayCursorPlan | null = null;
  if (options.checkpoint) {
    cursor = calculateJetstreamReplayCursor(options.checkpoint, {
      nowUs: options.nowUs,
      rewindUs: options.rewindUs,
    });
    url.searchParams.append('cursor', String(cursor.cursorUs));
  }
  return Object.freeze({
    endpoint,
    url: url.toString(),
    cursor,
    retentionGap: cursor?.retentionGap ?? false,
  });
}

export function buildBlueskyJetstreamUrl(
  options: Parameters<typeof buildBlueskyJetstreamSubscriptionPlan>[0],
): string {
  return buildBlueskyJetstreamSubscriptionPlan(options).url;
}

function decodePayload(payload: string | Uint8Array | unknown):
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{
      ok: false;
      reason: 'invalid_payload_type' | 'payload_too_large' | 'invalid_utf8' | 'invalid_json';
    }> {
  let serialized: string;

  if (typeof payload === 'string') {
    if (hasUnpairedSurrogate(payload)) return { ok: false, reason: 'invalid_utf8' };
    serialized = payload;
  } else if (payload instanceof Uint8Array) {
    if (payload.byteLength > MAX_JETSTREAM_PAYLOAD_BYTES) {
      return { ok: false, reason: 'payload_too_large' };
    }
    try {
      serialized = new TextDecoder('utf-8', { fatal: true }).decode(payload);
    } catch {
      return { ok: false, reason: 'invalid_utf8' };
    }
  } else {
    return { ok: false, reason: 'invalid_payload_type' };
  }

  if (new TextEncoder().encode(serialized).byteLength > MAX_JETSTREAM_PAYLOAD_BYTES) {
    return { ok: false, reason: 'payload_too_large' };
  }

  try {
    return { ok: true, value: JSON.parse(serialized) as unknown };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}

function baseAction(did: BlueskyPlcDid, timeUs: number, externalId: string): JetstreamActionBase {
  return {
    provider: 'bluesky-jetstream',
    did,
    accountKey: `bluesky:${did}`,
    trust: 'untrusted',
    reviewRequired: true,
    eventTimeUs: timeUs,
    eventTime: new Date(Math.floor(timeUs / 1_000)).toISOString(),
    externalId,
  };
}

function recordExternalId(did: BlueskyPlcDid, rkey: string): string {
  return `at://${did}/${BLUESKY_POST_COLLECTION}/${rkey}`;
}

function parseCommit(
  value: Record<string, unknown>,
  did: BlueskyPlcDid,
  timeUs: number,
): BlueskyJetstreamParseResult {
  const parsedCommit = commitSchema.safeParse(value.commit);
  if (!parsedCommit.success) return { status: 'rejected', reason: 'invalid_commit' };
  const commit = parsedCommit.data;
  if (commit.collection !== BLUESKY_POST_COLLECTION) {
    return { status: 'ignored', reason: 'collection_not_requested' };
  }

  const parsedRkey = recordKeySchema.safeParse(commit.rkey);
  if (!parsedRkey.success) return { status: 'rejected', reason: 'invalid_commit' };
  const rkey = parsedRkey.data;
  const externalId = recordExternalId(did, rkey);
  const sourceUrl = buildBlueskyPostUrl(did, rkey);

  if (commit.operation === 'delete') {
    return {
      status: 'action',
      action: {
        ...baseAction(did, timeUs, externalId),
        type: 'post_delete',
        operation: 'delete',
        collection: BLUESKY_POST_COLLECTION,
        rkey,
        sourceUrl,
      },
    };
  }

  const parsedRecord = postRecordSchema.safeParse(commit.record);
  if (!parsedRecord.success) return { status: 'rejected', reason: 'invalid_record' };
  const text = normalizeSafeText(parsedRecord.data.text);
  if (!text) return { status: 'rejected', reason: 'invalid_record' };

  return {
    status: 'action',
    action: {
      ...baseAction(did, timeUs, externalId),
      type: 'post_upsert',
      operation: commit.operation,
      collection: BLUESKY_POST_COLLECTION,
      rkey,
      cid: commit.cid ?? null,
      sourceUrl,
      sourceCreatedAt: new Date(parsedRecord.data.createdAt).toISOString(),
      text,
    },
  };
}

function parseIdentity(
  value: Record<string, unknown>,
  did: BlueskyPlcDid,
  timeUs: number,
): BlueskyJetstreamParseResult {
  const parsed = identitySchema.safeParse(value.identity);
  if (!parsed.success || (parsed.data.did !== undefined && parsed.data.did !== did)) {
    return { status: 'rejected', reason: 'invalid_identity' };
  }
  return {
    status: 'action',
    action: {
      ...baseAction(did, timeUs, `bluesky:identity:${did}`),
      type: 'identity',
      handle: parsed.data.handle?.toLocaleLowerCase('en-US') ?? null,
    },
  };
}

function parseAccount(
  value: Record<string, unknown>,
  did: BlueskyPlcDid,
  timeUs: number,
): BlueskyJetstreamParseResult {
  const parsed = accountSchema.safeParse(value.account);
  if (!parsed.success || (parsed.data.did !== undefined && parsed.data.did !== did)) {
    return { status: 'rejected', reason: 'invalid_account' };
  }
  const rawStatus = parsed.data.status ?? null;
  const normalizedStatus = rawStatus === null ? null : normalizeSafeText(rawStatus);
  if (rawStatus !== null && (normalizedStatus === null || rawStatus !== rawStatus.trim())) {
    return { status: 'rejected', reason: 'invalid_account' };
  }
  const status = normalizedStatus?.toLocaleLowerCase('en-US') ?? null;
  if (!parsed.data.active && status === 'takendown') {
    return {
      status: 'action',
      action: {
        ...baseAction(did, timeUs, `bluesky:account:${did}`),
        type: 'account_takedown',
        active: false,
        status: 'takendown',
      },
    };
  }
  return {
    status: 'action',
    action: {
      ...baseAction(did, timeUs, `bluesky:account:${did}`),
      type: 'account',
      active: parsed.data.active,
      status,
    },
  };
}

/**
 * Converts one bounded Jetstream envelope into lifecycle metadata. It never
 * emits data for an unapproved DID or another collection, and intentionally
 * drops embeds, facets, and every other provider-body field.
 */
export function parseBlueskyJetstreamMessage(
  payload: string | Uint8Array | unknown,
  wantedDids: readonly string[],
): BlueskyJetstreamParseResult {
  const approvedDids = validateWantedDids(wantedDids);
  if (!approvedDids) return { status: 'rejected', reason: 'invalid_allowlist' };

  const decoded = decodePayload(payload);
  if (!decoded.ok) return { status: 'rejected', reason: decoded.reason };

  const parsedEnvelope = envelopeSchema.safeParse(decoded.value);
  if (!parsedEnvelope.success) return { status: 'rejected', reason: 'invalid_envelope' };
  const envelope = decoded.value as Record<string, unknown>;
  const did = parsedEnvelope.data.did as BlueskyPlcDid;
  if (!approvedDids.includes(did)) return { status: 'ignored', reason: 'not_allowlisted' };

  switch (parsedEnvelope.data.kind) {
    case 'commit':
      return parseCommit(envelope, did, parsedEnvelope.data.time_us);
    case 'identity':
      return parseIdentity(envelope, did, parsedEnvelope.data.time_us);
    case 'account':
      return parseAccount(envelope, did, parsedEnvelope.data.time_us);
    default:
      return { status: 'ignored', reason: 'unsupported_kind' };
  }
}
