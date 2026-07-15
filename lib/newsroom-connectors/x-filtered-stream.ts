import { z } from 'zod';

export const X_API_ORIGIN = 'https://api.x.com' as const;
export const X_FILTERED_STREAM_ENDPOINT =
  'https://api.x.com/2/tweets/search/stream' as const;
export const X_FILTERED_STREAM_RULES_ENDPOINT =
  'https://api.x.com/2/tweets/search/stream/rules' as const;
export const X_RULE_TAG_PREFIX = 'bbsports:x-watch:' as const;

// Current pay-per-use projects support at most 1,000 persistent stream rules.
export const MAX_X_FILTER_RULES = 1_000;
export const MAX_X_WATCH_HANDLES = MAX_X_FILTER_RULES;
export const MAX_X_WATCH_HANDLE_ENV_BYTES = 32 * 1_024;
export const MAX_X_STREAM_LINE_BYTES = 64 * 1_024;
export const MAX_X_POST_TEXT_CHARS = 25_000;
export const MAX_X_EDIT_HISTORY_IDS = 100;
export const MAX_X_PROVIDER_PROBLEMS = 20;

/**
 * The eventual transport must count raw NDJSON bytes while buffering and abort
 * before a line can grow beyond this boundary. The parser's limit is a second
 * line of defense; receiving an already-unbounded string is not sufficient.
 */
export const X_FILTERED_STREAM_TRANSPORT_CONTRACT = Object.freeze({
  framing: 'ndjson' as const,
  parserMaxLineBytes: MAX_X_STREAM_LINE_BYTES,
  transportMaxPrebufferBytes: MAX_X_STREAM_LINE_BYTES,
  overflowDisposition: 'abort_connection_before_parse' as const,
});

export const X_KEEPALIVE_TIMEOUT_MS = 20_000;
export const X_FILTERED_STREAM_ID_RESUME_SUPPORTED = false as const;
export const MAX_X_NETWORK_BACKOFF_MS = 16_000;
export const MAX_X_HTTP_BACKOFF_MS = 320_000;
export const MAX_X_RATE_LIMIT_BACKOFF_MS = 15 * 60_000;
export const MAX_X_RETRY_AFTER_MS = MAX_X_RATE_LIMIT_BACKOFF_MS;

const X_USERNAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
const X_ID_PATTERN = /^[1-9][0-9]{0,19}$/;
const X_RULE_ID_PATTERN = /^[1-9][0-9]{0,19}$/;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const HTTP_DATE_PATTERN =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

const xIdSchema = z.string().max(20).regex(X_ID_PATTERN);
const xRuleIdSchema = z.string().max(20).regex(X_RULE_ID_PATTERN);
const xUsernameSchema = z.string().max(15).regex(X_USERNAME_PATTERN);

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

const timestampSchema = z
  .string()
  .max(64)
  .refine(validRfc3339Timestamp);

const postSchema = z.object({
  id: xIdSchema,
  text: z.string().max(MAX_X_POST_TEXT_CHARS),
  author_id: xIdSchema.optional(),
  created_at: timestampSchema,
  edit_history_tweet_ids: z.array(xIdSchema).min(1).max(MAX_X_EDIT_HISTORY_IDS),
});

const matchingRuleSchema = z.object({
  id: xRuleIdSchema,
  tag: z.string().min(1).max(128),
});

const includedUserSchema = z.object({
  id: xIdSchema,
  username: xUsernameSchema,
});

const providerProblemSchema = z
  .object({
    title: z.string().max(256).optional(),
    type: z.string().max(512).optional(),
    detail: z.string().max(2_000).optional(),
    status: z.number().int().min(100).max(599).optional(),
    disconnect_type: z.string().max(128).optional(),
    connection_issue: z.string().max(128).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.type !== undefined ||
      value.status !== undefined ||
      value.disconnect_type !== undefined ||
      value.connection_issue !== undefined,
  );

type ConnectorEnvironment = Readonly<Record<string, string | undefined>>;

export type XFilteredStreamDisabledReason =
  | 'global_disabled'
  | 'connector_disabled'
  | 'approval_missing'
  | 'credential_missing'
  | 'credential_invalid'
  | 'allowlist_missing'
  | 'allowlist_invalid';

export const X_DELETION_COMPLIANCE_READINESS = Object.freeze({
  ready: false as const,
  blocker: 'dedicated_deletion_compliance_channel_not_implemented' as const,
  normalFilteredStreamProvidesDeletionEvents: false as const,
});

export type XFilteredStreamRule = Readonly<{
  value: `from:${string} -is:retweet`;
  tag: `${typeof X_RULE_TAG_PREFIX}${string}`;
}>;

export type XFilteredStreamStaticPreflight =
  | Readonly<{
      passed: false;
      connectionAllowed: false;
      reason: XFilteredStreamDisabledReason;
    }>
  | Readonly<{
      passed: true;
      connectionAllowed: false;
      activationBlocker: typeof X_DELETION_COMPLIANCE_READINESS.blocker;
      streamEndpoint: typeof X_FILTERED_STREAM_ENDPOINT;
      rulesEndpoint: typeof X_FILTERED_STREAM_RULES_ENDPOINT;
      watchHandles: readonly string[];
      rules: readonly XFilteredStreamRule[];
      keepaliveTimeoutMs: typeof X_KEEPALIVE_TIMEOUT_MS;
      idResumeSupported: typeof X_FILTERED_STREAM_ID_RESUME_SUPPORTED;
    }>;

export type XPostIdCheckpoint = Readonly<{
  lastSeenPostId: string;
  idResumeSupported: typeof X_FILTERED_STREAM_ID_RESUME_SUPPORTED;
}>;

type XLeadBase = Readonly<{
  provider: 'x-filtered-stream';
  type: 'post_lead';
  trust: 'untrusted';
  reviewRequired: true;
  postId: string;
  externalId: `x:post:${string}`;
  authorId: string | null;
  authorUsername: string | null;
  watchedHandle: string;
  sourceCreatedAt: string;
  sourceUrl: string;
  text: string;
  matchingRuleIds: readonly string[];
  providerProblemCategories: readonly XProviderProblemCategory[];
}>;

export type XPostLeadAction = XLeadBase &
  Readonly<{
    editLineage: Readonly<{
      rootPostId: string;
      currentPostId: string;
      previousPostIds: readonly string[];
      isEdit: boolean;
    }>;
  }>;

export type XProviderProblemCategory =
  | 'authorization'
  | 'rate_limited'
  | 'operational_disconnect'
  | 'connection_limit'
  | 'invalid_request'
  | 'server_fault'
  | 'provider_fault';

export type XStreamControlAction = Readonly<{
  provider: 'x-filtered-stream';
  type: 'disconnect' | 'provider_problem';
  categories: readonly XProviderProblemCategory[];
  statuses: readonly number[];
  disposition: 'reconnect' | 'halt';
}>;

export type XFilteredStreamParseResult =
  | Readonly<{ status: 'lead'; action: XPostLeadAction }>
  | Readonly<{ status: 'control'; action: XStreamControlAction }>
  | Readonly<{ status: 'ignored'; reason: 'keepalive' | 'rule_not_requested' }>
  | Readonly<{
      status: 'rejected';
      reason:
        | 'invalid_allowlist'
        | 'invalid_payload_type'
        | 'payload_too_large'
        | 'invalid_utf8'
        | 'invalid_json'
        | 'invalid_envelope'
        | 'invalid_data'
        | 'invalid_matching_rules'
        | 'ambiguous_rule_match'
        | 'invalid_author'
        | 'invalid_edit_lineage'
        | 'invalid_control'
        | 'unsupported_compliance_envelope';
    }>;

export type XReconnectKind = 'immediate' | 'network' | 'http' | 'rate_limit';

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function compareAscii(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function validBearerToken(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 4_096 &&
    value === value.trim() &&
    /^[\x21-\x7e]+$/.test(value)
  );
}

function normalizeHandleValues(values: readonly string[]): readonly string[] | null {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_X_WATCH_HANDLES) {
    return null;
  }

  const normalized: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string' || !X_USERNAME_PATTERN.test(value)) return null;
    normalized.push(value.toLowerCase());
  }

  const unique = [...new Set(normalized)].sort(compareAscii);
  if (unique.length === 0 || unique.length > MAX_X_FILTER_RULES) return null;
  return unique;
}

function parseWatchHandles(raw: string): readonly string[] | null {
  if (byteLength(raw) > MAX_X_WATCH_HANDLE_ENV_BYTES) return null;
  const values = raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  return normalizeHandleValues(values);
}

export function normalizeXWatchHandles(handles: readonly string[]): readonly string[] {
  const normalized = normalizeHandleValues(handles);
  if (!normalized) throw new TypeError('A valid, nonempty curated X handle allowlist is required');
  return normalized;
}

export function buildXFilteredStreamRules(
  handles: readonly string[],
): readonly XFilteredStreamRule[] {
  const normalized = normalizeXWatchHandles(handles);
  return normalized.map((handle) => {
    const value = `from:${handle} -is:retweet` as const;
    const tag = `${X_RULE_TAG_PREFIX}${handle}` as const;
    if (value.length > 1_024 || tag.length > 128) {
      throw new TypeError('The curated X rule set is invalid');
    }
    return Object.freeze({ value, tag });
  });
}

/**
 * Performs static input checks only. Passing this preflight is never an
 * activation claim: connections remain blocked until a separate, dedicated X
 * deletion-compliance channel exists. The credential is validated but never
 * returned or retained because no request may be built while that blocker exists.
 */
export function readXFilteredStreamStaticPreflight(
  environment: ConnectorEnvironment = process.env,
): XFilteredStreamStaticPreflight {
  if (environment.BBSPORTS_REALTIME_NEWSROOM_ENABLED !== 'true') {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'global_disabled' });
  }
  if (environment.BBSPORTS_NEWSROOM_X_ENABLED !== 'true') {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'connector_disabled' });
  }
  if (environment.BBSPORTS_APPROVED_X_API !== 'true') {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'approval_missing' });
  }

  const bearerToken = environment.X_BEARER_TOKEN;
  if (!bearerToken) {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'credential_missing' });
  }
  if (!validBearerToken(bearerToken)) {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'credential_invalid' });
  }

  const rawHandles = environment.BBSPORTS_X_WATCH_HANDLES;
  if (!rawHandles?.trim()) {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'allowlist_missing' });
  }
  const watchHandles = parseWatchHandles(rawHandles);
  if (!watchHandles) {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'allowlist_invalid' });
  }

  const config = Object.freeze({
    passed: true as const,
    connectionAllowed: false as const,
    activationBlocker: X_DELETION_COMPLIANCE_READINESS.blocker,
    streamEndpoint: X_FILTERED_STREAM_ENDPOINT,
    rulesEndpoint: X_FILTERED_STREAM_RULES_ENDPOINT,
    watchHandles: Object.freeze([...watchHandles]),
    rules: Object.freeze([...buildXFilteredStreamRules(watchHandles)]),
    keepaliveTimeoutMs: X_KEEPALIVE_TIMEOUT_MS,
    idResumeSupported: X_FILTERED_STREAM_ID_RESUME_SUPPORTED,
  });
  return config;
}

export function buildXFilteredStreamUrl(): string {
  const url = new URL(X_FILTERED_STREAM_ENDPOINT);
  url.searchParams.set('tweet.fields', 'author_id,created_at,edit_history_tweet_ids');
  url.searchParams.set('expansions', 'author_id');
  url.searchParams.set('user.fields', 'username');
  return url.toString();
}

export function buildXPostUrl(postId: string, username?: string | null): string {
  if (!xIdSchema.safeParse(postId).success) throw new TypeError('Invalid X post ID');
  if (
    username !== undefined &&
    username !== null &&
    (typeof username !== 'string' || !X_USERNAME_PATTERN.test(username))
  ) {
    throw new TypeError('Invalid X username');
  }
  if (!username) return `https://x.com/i/web/status/${encodeURIComponent(postId)}`;
  return `https://x.com/${encodeURIComponent(username.toLowerCase())}/status/${encodeURIComponent(postId)}`;
}

export function buildXAddRulesBody(
  handles: readonly string[],
): Readonly<{ add: readonly XFilteredStreamRule[] }> {
  return Object.freeze({ add: Object.freeze([...buildXFilteredStreamRules(handles)]) });
}

export function buildXDeleteRulesBody(
  ruleIds: readonly string[],
): Readonly<{ delete: Readonly<{ ids: readonly string[] }> }> {
  if (ruleIds.length === 0 || ruleIds.length > MAX_X_FILTER_RULES) {
    throw new TypeError('A bounded, nonempty X rule ID list is required');
  }
  if (ruleIds.some((ruleId) => !xRuleIdSchema.safeParse(ruleId).success)) {
    throw new TypeError('A bounded, nonempty X rule ID list is required');
  }
  const ids = [...new Set(ruleIds)].sort(compareAscii);
  return Object.freeze({ delete: Object.freeze({ ids: Object.freeze(ids) }) });
}

export function checkpointXPostId(postId: string): XPostIdCheckpoint {
  if (!xIdSchema.safeParse(postId).success) throw new TypeError('Invalid X post ID');
  return Object.freeze({
    lastSeenPostId: postId,
    idResumeSupported: X_FILTERED_STREAM_ID_RESUME_SUPPORTED,
  });
}

/**
 * A last-seen ID can detect only an exact immediate replay. It is not a stream
 * cursor and must not be used to discard lower or out-of-order IDs.
 */
export function isExactXPostIdReplay(
  checkpoint: XPostIdCheckpoint | null | undefined,
  postId: string,
): boolean {
  if (!xIdSchema.safeParse(postId).success) throw new TypeError('Invalid X post ID');
  if (!checkpoint) return false;
  if (
    checkpoint.idResumeSupported !== X_FILTERED_STREAM_ID_RESUME_SUPPORTED ||
    !xIdSchema.safeParse(checkpoint.lastSeenPostId).success
  ) {
    throw new TypeError('Invalid X post checkpoint');
  }
  return checkpoint.lastSeenPostId === postId;
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

function decodeStreamLine(payload: string | Uint8Array | unknown):
  | Readonly<{ ok: true; keepalive: true }>
  | Readonly<{ ok: true; keepalive: false; value: unknown }>
  | Readonly<{
      ok: false;
      reason:
        | 'invalid_payload_type'
        | 'payload_too_large'
        | 'invalid_utf8'
        | 'invalid_json';
    }> {
  let serialized: string;
  if (typeof payload === 'string') {
    if (hasUnpairedSurrogate(payload)) return { ok: false, reason: 'invalid_utf8' };
    serialized = payload;
  } else if (payload instanceof Uint8Array) {
    if (payload.byteLength > MAX_X_STREAM_LINE_BYTES) {
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

  if (byteLength(serialized) > MAX_X_STREAM_LINE_BYTES) {
    return { ok: false, reason: 'payload_too_large' };
  }
  if (serialized.trim().length === 0) return { ok: true, keepalive: true };

  try {
    return { ok: true, keepalive: false, value: JSON.parse(serialized) as unknown };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTimestamp(value: string): string {
  return new Date(value).toISOString();
}

function classifyProblem(value: z.infer<typeof providerProblemSchema>): XProviderProblemCategory {
  const type = value.type?.toLowerCase() ?? '';
  const disconnectType = value.disconnect_type?.toLowerCase() ?? '';
  const connectionIssue = value.connection_issue?.toLowerCase() ?? '';

  if (value.status === 401 || value.status === 403) return 'authorization';
  if (value.status === 429) return 'rate_limited';
  if (connectionIssue === 'toomanyconnections') return 'connection_limit';
  if (type.includes('operational-disconnect') || disconnectType.length > 0) {
    return 'operational_disconnect';
  }
  if (value.status !== undefined && value.status >= 500) return 'server_fault';
  if (value.status !== undefined && value.status >= 400) return 'invalid_request';
  return 'provider_fault';
}

function parseProviderProblems(
  value: unknown,
): readonly z.infer<typeof providerProblemSchema>[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_X_PROVIDER_PROBLEMS) {
    return null;
  }
  const parsed = z.array(providerProblemSchema).safeParse(value);
  return parsed.success ? parsed.data : null;
}

function summarizeProblems(problems: readonly z.infer<typeof providerProblemSchema>[]) {
  const categories = [...new Set(problems.map(classifyProblem))].sort(compareAscii);
  const statuses = [
    ...new Set(
      problems
        .map((problem) => problem.status)
        .filter((status): status is number => status !== undefined),
    ),
  ].sort((left, right) => left - right);
  return { categories, statuses };
}

function parseControlEnvelope(value: Record<string, unknown>): XFilteredStreamParseResult | null {
  let problems: readonly z.infer<typeof providerProblemSchema>[] | null = null;
  if ('errors' in value) {
    problems = parseProviderProblems(value.errors);
    if (!problems) return { status: 'rejected', reason: 'invalid_control' };
  } else if (
    'title' in value ||
    'type' in value ||
    'status' in value ||
    'disconnect_type' in value ||
    'connection_issue' in value
  ) {
    const parsed = providerProblemSchema.safeParse(value);
    if (!parsed.success) return { status: 'rejected', reason: 'invalid_control' };
    problems = [parsed.data];
  }

  if (!problems) return null;
  const { categories, statuses } = summarizeProblems(problems);
  const disconnect = categories.some(
    (category) => category === 'operational_disconnect' || category === 'connection_limit',
  );
  const terminal = categories.some(
    (category) =>
      category === 'authorization' ||
      category === 'invalid_request' ||
      category === 'connection_limit',
  );
  return {
    status: 'control',
    action: {
      provider: 'x-filtered-stream',
      type: disconnect ? 'disconnect' : 'provider_problem',
      categories,
      statuses,
      disposition: terminal ? 'halt' : 'reconnect',
    },
  };
}

function handleFromTag(tag: string): string | null | false {
  if (!tag.startsWith(X_RULE_TAG_PREFIX)) return null;
  const handle = tag.slice(X_RULE_TAG_PREFIX.length);
  if (!X_USERNAME_PATTERN.test(handle) || handle !== handle.toLowerCase()) return false;
  return handle;
}

function validateEditLineage(postId: string, ids: readonly string[]) {
  if (ids[ids.length - 1] !== postId || new Set(ids).size !== ids.length) return null;
  for (let index = 1; index < ids.length; index += 1) {
    if (BigInt(ids[index]) <= BigInt(ids[index - 1])) return null;
  }
  return {
    rootPostId: ids[0],
    currentPostId: postId,
    previousPostIds: ids.slice(0, -1),
    isEdit: ids.length > 1,
  } as const;
}

function findAuthorUsername(
  includesValue: unknown,
  authorId: string | undefined,
): string | null | false {
  if (includesValue === undefined) return null;
  const parsedIncludes = z
    .object({ users: z.array(includedUserSchema).max(100).optional() })
    .safeParse(includesValue);
  if (!parsedIncludes.success) return false;
  if (!authorId || !parsedIncludes.data.users) return null;

  const matches = parsedIncludes.data.users.filter((user) => user.id === authorId);
  if (matches.length === 0) return null;
  const usernames = [...new Set(matches.map((user) => user.username.toLowerCase()))];
  return usernames.length === 1 ? usernames[0] : false;
}

function parseLeadEnvelope(
  value: Record<string, unknown>,
  approvedHandles: readonly string[],
): XFilteredStreamParseResult {
  const parsedPost = postSchema.safeParse(value.data);
  if (!parsedPost.success) return { status: 'rejected', reason: 'invalid_data' };

  const parsedRules = z
    .array(matchingRuleSchema)
    .min(1)
    .max(MAX_X_FILTER_RULES)
    .safeParse(value.matching_rules);
  if (!parsedRules.success) return { status: 'rejected', reason: 'invalid_matching_rules' };

  const ownRuleMatches: Array<{ id: string; handle: string }> = [];
  for (const rule of parsedRules.data) {
    const handle = handleFromTag(rule.tag);
    if (handle === false) return { status: 'rejected', reason: 'invalid_matching_rules' };
    if (handle && approvedHandles.includes(handle)) {
      ownRuleMatches.push({ id: rule.id, handle });
    }
  }
  if (ownRuleMatches.length === 0) return { status: 'ignored', reason: 'rule_not_requested' };

  const handles = [...new Set(ownRuleMatches.map((rule) => rule.handle))];
  if (handles.length !== 1) return { status: 'rejected', reason: 'ambiguous_rule_match' };
  const watchedHandle = handles[0];

  const post = parsedPost.data;
  if (hasUnpairedSurrogate(post.text)) return { status: 'rejected', reason: 'invalid_data' };
  const text = post.text.normalize('NFC').replace(/\r\n?/g, '\n');
  if (
    text.trim().length === 0 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text)
  ) {
    return { status: 'rejected', reason: 'invalid_data' };
  }

  const authorUsername = findAuthorUsername(value.includes, post.author_id);
  if (authorUsername === false || (authorUsername !== null && authorUsername !== watchedHandle)) {
    return { status: 'rejected', reason: 'invalid_author' };
  }

  const editLineage = validateEditLineage(post.id, post.edit_history_tweet_ids);
  if (!editLineage) return { status: 'rejected', reason: 'invalid_edit_lineage' };

  let providerProblemCategories: readonly XProviderProblemCategory[] = [];
  if (value.errors !== undefined) {
    const problems = parseProviderProblems(value.errors);
    if (!problems) return { status: 'rejected', reason: 'invalid_control' };
    providerProblemCategories = summarizeProblems(problems).categories;
  }

  return {
    status: 'lead',
    action: {
      provider: 'x-filtered-stream',
      type: 'post_lead',
      trust: 'untrusted',
      reviewRequired: true,
      postId: post.id,
      externalId: `x:post:${post.id}`,
      authorId: post.author_id ?? null,
      authorUsername,
      watchedHandle,
      sourceCreatedAt: normalizeTimestamp(post.created_at),
      sourceUrl: buildXPostUrl(post.id, authorUsername ?? watchedHandle),
      text,
      editLineage,
      matchingRuleIds: [...new Set(ownRuleMatches.map((rule) => rule.id))].sort(compareAscii),
      providerProblemCategories,
    },
  };
}

/** Converts exactly one bounded Filtered Stream NDJSON line into safe metadata. */
export function parseXFilteredStreamLine(
  payload: string | Uint8Array | unknown,
  watchHandles: readonly string[],
): XFilteredStreamParseResult {
  const approvedHandles = normalizeHandleValues(watchHandles);
  if (!approvedHandles) return { status: 'rejected', reason: 'invalid_allowlist' };

  const decoded = decodeStreamLine(payload);
  if (!decoded.ok) return { status: 'rejected', reason: decoded.reason };
  if (decoded.keepalive) return { status: 'ignored', reason: 'keepalive' };
  if (!isRecord(decoded.value)) return { status: 'rejected', reason: 'invalid_envelope' };

  const value = decoded.value;
  if ('data' in value) {
    if (!isRecord(value.data)) return { status: 'rejected', reason: 'invalid_data' };
    if ('delete' in value.data) {
      return { status: 'rejected', reason: 'unsupported_compliance_envelope' };
    }
    return parseLeadEnvelope(value, approvedHandles);
  }

  const control = parseControlEnvelope(value);
  return control ?? { status: 'rejected', reason: 'invalid_envelope' };
}

function requireAttempt(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt > 1_000) {
    throw new TypeError('Reconnect attempt must be an integer between 0 and 1000');
  }
  return attempt;
}

function requireNow(nowMs: number): number {
  if (!Number.isFinite(nowMs) || nowMs < 0 || nowMs > Number.MAX_SAFE_INTEGER) {
    throw new TypeError('nowMs must be a nonnegative safe timestamp');
  }
  return nowMs;
}

export function parseXRetryAfterMs(
  value: string | null | undefined,
  options: Readonly<{ nowMs?: number; capMs?: number }> = {},
): number | null {
  if (value === null || value === undefined || value.length === 0 || value !== value.trim()) {
    return null;
  }
  const nowMs = requireNow(options.nowMs ?? Date.now());
  const capMs = options.capMs ?? MAX_X_RETRY_AFTER_MS;
  if (!Number.isSafeInteger(capMs) || capMs < 0 || capMs > MAX_X_RETRY_AFTER_MS) {
    throw new TypeError('capMs must be a bounded nonnegative safe integer');
  }

  let delayMs: number;
  if (/^[0-9]+$/.test(value)) {
    const seconds = Number(value);
    if (!Number.isSafeInteger(seconds)) return capMs;
    delayMs = seconds * 1_000;
  } else {
    if (!HTTP_DATE_PATTERN.test(value)) return null;
    const at = Date.parse(value);
    if (!Number.isFinite(at)) return null;
    if (new Date(at).toUTCString() !== value) return null;
    delayMs = Math.max(0, at - nowMs);
  }
  if (!Number.isFinite(delayMs)) return capMs;
  return Math.min(Math.max(0, Math.ceil(delayMs)), capMs);
}

export function calculateXReconnectDelayMs(options: Readonly<{
  kind: XReconnectKind;
  attempt: number;
  retryAfter?: string | null;
  nowMs?: number;
  jitter?: () => number;
}>): number {
  const attempt = requireAttempt(options.attempt);
  if (options.kind === 'immediate') return 0;

  let baseMs: number;
  let capMs: number;
  switch (options.kind) {
    case 'network':
      baseMs = 250 * Math.max(1, attempt + 1);
      capMs = MAX_X_NETWORK_BACKOFF_MS;
      break;
    case 'http':
      baseMs = 5_000 * 2 ** Math.min(attempt, 16);
      capMs = MAX_X_HTTP_BACKOFF_MS;
      break;
    case 'rate_limit':
      baseMs = 60_000 * 2 ** Math.min(attempt, 16);
      capMs = MAX_X_RATE_LIMIT_BACKOFF_MS;
      break;
  }

  const retryAfterMs = parseXRetryAfterMs(options.retryAfter, {
    nowMs: options.nowMs,
    capMs: Math.min(capMs, MAX_X_RETRY_AFTER_MS),
  });
  const requiredMs = Math.min(Math.max(baseMs, retryAfterMs ?? 0), capMs);
  const jitterSample = options.jitter?.() ?? 0;
  if (!Number.isFinite(jitterSample) || jitterSample < 0 || jitterSample > 1) {
    throw new TypeError('Jitter must return a finite value between 0 and 1');
  }
  const jitterMs = Math.floor(requiredMs * 0.1 * jitterSample);
  return Math.min(requiredMs + jitterMs, capMs);
}
