import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspect } from 'node:util';
import test from 'node:test';
import {
  MAX_X_FILTER_RULES,
  MAX_X_HTTP_BACKOFF_MS,
  MAX_X_NETWORK_BACKOFF_MS,
  MAX_X_POST_TEXT_CHARS,
  MAX_X_RATE_LIMIT_BACKOFF_MS,
  MAX_X_RETRY_AFTER_MS,
  MAX_X_STREAM_LINE_BYTES,
  X_FILTERED_STREAM_ENDPOINT,
  X_FILTERED_STREAM_ID_RESUME_SUPPORTED,
  X_FILTERED_STREAM_RULES_ENDPOINT,
  X_FILTERED_STREAM_TRANSPORT_CONTRACT,
  X_KEEPALIVE_TIMEOUT_MS,
  X_DELETION_COMPLIANCE_READINESS,
  X_RULE_TAG_PREFIX,
  buildXAddRulesBody,
  buildXDeleteRulesBody,
  buildXFilteredStreamRules,
  buildXFilteredStreamUrl,
  buildXPostUrl,
  calculateXReconnectDelayMs,
  checkpointXPostId,
  isExactXPostIdReplay,
  normalizeXWatchHandles,
  parseXFilteredStreamLine,
  parseXRetryAfterMs,
  readXFilteredStreamStaticPreflight,
} from '../lib/newsroom-connectors';

const SECRET = 'AAAA%2FbbSports-Test_Bearer-123';
const HANDLE_A = 'adamschefter';
const HANDLE_B = 'rapsheet';
const POST_ID = '1999999999999999999';
const PREVIOUS_POST_ID = '1999999999999999998';
const AUTHOR_ID = '1234567890123456789';
const RULE_ID = '999999999999999999';

function activeEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    BBSPORTS_REALTIME_NEWSROOM_ENABLED: 'true',
    BBSPORTS_NEWSROOM_X_ENABLED: 'true',
    BBSPORTS_APPROVED_X_API: 'true',
    X_BEARER_TOKEN: SECRET,
    BBSPORTS_X_WATCH_HANDLES: HANDLE_A,
    ...overrides,
  };
}

function postEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: POST_ID,
      text: 'The team has agreed to terms, according to the club announcement.',
      author_id: AUTHOR_ID,
      created_at: '2026-07-15T16:30:00.123Z',
      edit_history_tweet_ids: [POST_ID],
      attachments: { providerBody: 'not normalized' },
    },
    includes: {
      users: [
        {
          id: AUTHOR_ID,
          username: 'AdamSchefter',
          name: 'Ignored display name',
        },
      ],
      media: [{ url: 'https://provider.invalid/body' }],
    },
    matching_rules: [{ id: RULE_ID, tag: `${X_RULE_TAG_PREFIX}${HANDLE_A}` }],
    ...overrides,
  };
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

test('X static preflight fails closed at every independent exact gate', () => {
  assert.deepEqual(readXFilteredStreamStaticPreflight({}), {
    passed: false,
    connectionAllowed: false,
    reason: 'global_disabled',
  });
  assert.deepEqual(
    readXFilteredStreamStaticPreflight(
      activeEnvironment({ BBSPORTS_REALTIME_NEWSROOM_ENABLED: 'false' }),
    ),
    { passed: false, connectionAllowed: false, reason: 'global_disabled' },
  );
  assert.deepEqual(
    readXFilteredStreamStaticPreflight(
      activeEnvironment({ BBSPORTS_REALTIME_NEWSROOM_ENABLED: 'TRUE' }),
    ),
    { passed: false, connectionAllowed: false, reason: 'global_disabled' },
  );
  assert.deepEqual(
    readXFilteredStreamStaticPreflight(activeEnvironment({ BBSPORTS_NEWSROOM_X_ENABLED: 'TRUE' })),
    { passed: false, connectionAllowed: false, reason: 'connector_disabled' },
  );
  assert.deepEqual(
    readXFilteredStreamStaticPreflight(activeEnvironment({ BBSPORTS_APPROVED_X_API: '1' })),
    { passed: false, connectionAllowed: false, reason: 'approval_missing' },
  );
  assert.deepEqual(readXFilteredStreamStaticPreflight(activeEnvironment({ X_BEARER_TOKEN: '' })), {
    passed: false,
    connectionAllowed: false,
    reason: 'credential_missing',
  });
  assert.deepEqual(
    readXFilteredStreamStaticPreflight(activeEnvironment({ X_BEARER_TOKEN: ` ${SECRET}` })),
    { passed: false, connectionAllowed: false, reason: 'credential_invalid' },
  );
  assert.deepEqual(
    readXFilteredStreamStaticPreflight(activeEnvironment({ X_BEARER_TOKEN: `${SECRET}\nInjected` })),
    { passed: false, connectionAllowed: false, reason: 'credential_invalid' },
  );
  assert.deepEqual(
    readXFilteredStreamStaticPreflight(activeEnvironment({ BBSPORTS_X_WATCH_HANDLES: ' ' })),
    { passed: false, connectionAllowed: false, reason: 'allowlist_missing' },
  );
  assert.deepEqual(
    readXFilteredStreamStaticPreflight(
      activeEnvironment({ BBSPORTS_X_WATCH_HANDLES: '@adamschefter' }),
    ),
    { passed: false, connectionAllowed: false, reason: 'allowlist_invalid' },
  );
});

test('a passing static preflight remains connection-blocked on deletion compliance', () => {
  const preflight = readXFilteredStreamStaticPreflight(
    activeEnvironment({
      BBSPORTS_X_WATCH_HANDLES: `${HANDLE_B}, AdamSchefter, ${HANDLE_B}`,
    }),
  );
  assert.equal(preflight.passed, true);
  if (!preflight.passed) return;
  assert.equal(preflight.connectionAllowed, false);
  assert.equal(preflight.activationBlocker, X_DELETION_COMPLIANCE_READINESS.blocker);
  assert.equal(X_DELETION_COMPLIANCE_READINESS.ready, false);
  assert.equal(X_DELETION_COMPLIANCE_READINESS.normalFilteredStreamProvidesDeletionEvents, false);
  assert.deepEqual(preflight.watchHandles, [HANDLE_A, HANDLE_B]);
  assert.equal(preflight.keepaliveTimeoutMs, X_KEEPALIVE_TIMEOUT_MS);
  assert.equal(preflight.idResumeSupported, false);
});

test('static preflight is deterministic, deeply frozen, and never retains its bearer credential', () => {
  const preflight = readXFilteredStreamStaticPreflight(
    activeEnvironment({ BBSPORTS_X_WATCH_HANDLES: `${HANDLE_B} ${HANDLE_A}` }),
  );
  assert.equal(preflight.passed, true);
  if (!preflight.passed) return;

  assert.equal(preflight.streamEndpoint, X_FILTERED_STREAM_ENDPOINT);
  assert.equal(preflight.rulesEndpoint, X_FILTERED_STREAM_RULES_ENDPOINT);
  assert.deepEqual(preflight.rules, [
    { value: `from:${HANDLE_A} -is:retweet`, tag: `${X_RULE_TAG_PREFIX}${HANDLE_A}` },
    { value: `from:${HANDLE_B} -is:retweet`, tag: `${X_RULE_TAG_PREFIX}${HANDLE_B}` },
  ]);
  assert.equal(Object.isFrozen(preflight), true);
  assert.equal(Object.isFrozen(preflight.watchHandles), true);
  assert.equal(Object.isFrozen(preflight.rules), true);

  const publicRepresentations = [
    JSON.stringify(preflight),
    inspect(preflight),
    buildXFilteredStreamUrl(),
  ];
  for (const value of publicRepresentations) assert.equal(value.includes(SECRET), false);
});

test('curated handles are bounded, normalized, deduplicated, and operator-safe', () => {
  assert.deepEqual(normalizeXWatchHandles(['RapSheet', 'adamschefter', 'RAPSHEET']), [
    HANDLE_A,
    HANDLE_B,
  ]);
  for (const unsafe of [
    '@adamschefter',
    'adam-schefter',
    'from:someone',
    'reporter OR nfl',
    'reporter) -is:reply',
    '',
    'a'.repeat(16),
  ]) {
    assert.throws(() => normalizeXWatchHandles([unsafe]), /curated X handle allowlist/);
  }

  const tooMany = Array.from({ length: MAX_X_FILTER_RULES + 1 }, (_, index) => `u${index}`);
  assert.throws(() => normalizeXWatchHandles(tooMany), /curated X handle allowlist/);
  assert.deepEqual(
    readXFilteredStreamStaticPreflight(
      activeEnvironment({ BBSPORTS_X_WATCH_HANDLES: tooMany.join(',') }),
    ),
    { passed: false, connectionAllowed: false, reason: 'allowlist_invalid' },
  );
});

test('rule builders produce only deterministic per-handle non-retweet rules', () => {
  assert.deepEqual(buildXFilteredStreamRules([HANDLE_B, HANDLE_A, HANDLE_B]), [
    { value: `from:${HANDLE_A} -is:retweet`, tag: `${X_RULE_TAG_PREFIX}${HANDLE_A}` },
    { value: `from:${HANDLE_B} -is:retweet`, tag: `${X_RULE_TAG_PREFIX}${HANDLE_B}` },
  ]);
  assert.deepEqual(buildXAddRulesBody([HANDLE_A]), {
    add: [{ value: `from:${HANDLE_A} -is:retweet`, tag: `${X_RULE_TAG_PREFIX}${HANDLE_A}` }],
  });
  assert.deepEqual(buildXDeleteRulesBody(['20', '10', '20']), {
    delete: { ids: ['10', '20'] },
  });
  assert.throws(() => buildXDeleteRulesBody([]), /bounded, nonempty/);
  assert.throws(() => buildXDeleteRulesBody(['1 OR 2']), /bounded, nonempty/);
});

test('official endpoint URLs are fixed, encoded, credential-free, and cannot claim ID resume', () => {
  const stream = new URL(buildXFilteredStreamUrl());
  assert.equal(`${stream.origin}${stream.pathname}`, X_FILTERED_STREAM_ENDPOINT);
  assert.equal(stream.protocol, 'https:');
  assert.equal(stream.hostname, 'api.x.com');
  assert.equal(
    stream.searchParams.get('tweet.fields'),
    'author_id,created_at,edit_history_tweet_ids',
  );
  assert.equal(stream.searchParams.get('expansions'), 'author_id');
  assert.equal(stream.searchParams.get('user.fields'), 'username');
  assert.equal(stream.searchParams.has('since_id'), false);
  assert.equal(stream.searchParams.has('cursor'), false);
  assert.equal(stream.toString().includes(SECRET), false);
  assert.deepEqual(X_FILTERED_STREAM_TRANSPORT_CONTRACT, {
    framing: 'ndjson',
    parserMaxLineBytes: MAX_X_STREAM_LINE_BYTES,
    transportMaxPrebufferBytes: MAX_X_STREAM_LINE_BYTES,
    overflowDisposition: 'abort_connection_before_parse',
  });
  assert.equal(Object.isFrozen(X_FILTERED_STREAM_TRANSPORT_CONTRACT), true);

  assert.equal(
    buildXPostUrl(POST_ID, 'AdamSchefter'),
    `https://x.com/adamschefter/status/${POST_ID}`,
  );
  assert.equal(buildXPostUrl(POST_ID), `https://x.com/i/web/status/${POST_ID}`);
  assert.throws(() => buildXPostUrl('../escape', HANDLE_A), /post ID/);
  assert.throws(() => buildXPostUrl(POST_ID, '../escape'), /username/);
});

test('one complete data line becomes a bounded, review-required lead and drops extra bodies', () => {
  const result = parseXFilteredStreamLine(serialized(postEnvelope()), [HANDLE_A]);
  assert.equal(result.status, 'lead');
  if (result.status !== 'lead') return;

  assert.deepEqual(result.action, {
    provider: 'x-filtered-stream',
    type: 'post_lead',
    trust: 'untrusted',
    reviewRequired: true,
    postId: POST_ID,
    externalId: `x:post:${POST_ID}`,
    authorId: AUTHOR_ID,
    authorUsername: HANDLE_A,
    watchedHandle: HANDLE_A,
    sourceCreatedAt: '2026-07-15T16:30:00.123Z',
    sourceUrl: `https://x.com/${HANDLE_A}/status/${POST_ID}`,
    text: 'The team has agreed to terms, according to the club announcement.',
    editLineage: {
      rootPostId: POST_ID,
      currentPostId: POST_ID,
      previousPostIds: [],
      isEdit: false,
    },
    matchingRuleIds: [RULE_ID],
    providerProblemCategories: [],
  });
  assert.equal('attachments' in result.action, false);
  assert.equal('media' in result.action, false);
  assert.equal('name' in result.action, false);
});

test('author metadata may be absent, but a curated matching tag is always required', () => {
  const withoutIncludes = postEnvelope({ includes: undefined });
  const result = parseXFilteredStreamLine(serialized(withoutIncludes), [HANDLE_A]);
  assert.equal(result.status, 'lead');
  if (result.status === 'lead') {
    assert.equal(result.action.authorUsername, null);
    assert.equal(result.action.authorId, AUTHOR_ID);
    assert.equal(result.action.sourceUrl, `https://x.com/${HANDLE_A}/status/${POST_ID}`);
  }

  assert.deepEqual(
    parseXFilteredStreamLine(
      serialized(
        postEnvelope({ matching_rules: [{ id: RULE_ID, tag: 'another-application-rule' }] }),
      ),
      [HANDLE_A],
    ),
    { status: 'ignored', reason: 'rule_not_requested' },
  );
});

test('edits carry strict chronological lineage and identify every superseded ID', () => {
  const base = postEnvelope();
  const result = parseXFilteredStreamLine(
    serialized({
      ...base,
      data: {
        ...(base.data as Record<string, unknown>),
        id: POST_ID,
        text: 'Cafe\u0301 update from the official announcement.\r\nCorrection included.',
        edit_history_tweet_ids: [PREVIOUS_POST_ID, POST_ID],
      },
    }),
    [HANDLE_A],
  );
  assert.equal(result.status, 'lead');
  if (result.status !== 'lead') return;
  assert.deepEqual(result.action.editLineage, {
    rootPostId: PREVIOUS_POST_ID,
    currentPostId: POST_ID,
    previousPostIds: [PREVIOUS_POST_ID],
    isEdit: true,
  });
  assert.equal(result.action.text.includes('\r'), false);
  assert.equal(result.action.text.startsWith('Café update'), true);
});

test('mismatched authors, ambiguous rule tags, and invalid edit lineages fail closed', () => {
  const mismatchedAuthor = postEnvelope({
    includes: { users: [{ id: AUTHOR_ID, username: HANDLE_B }] },
  });
  assert.deepEqual(parseXFilteredStreamLine(serialized(mismatchedAuthor), [HANDLE_A, HANDLE_B]), {
    status: 'rejected',
    reason: 'invalid_author',
  });

  const ambiguous = postEnvelope({
    matching_rules: [
      { id: RULE_ID, tag: `${X_RULE_TAG_PREFIX}${HANDLE_A}` },
      { id: '888888888888888888', tag: `${X_RULE_TAG_PREFIX}${HANDLE_B}` },
    ],
  });
  assert.deepEqual(parseXFilteredStreamLine(serialized(ambiguous), [HANDLE_A, HANDLE_B]), {
    status: 'rejected',
    reason: 'ambiguous_rule_match',
  });

  const invalidTag = postEnvelope({
    matching_rules: [{ id: RULE_ID, tag: `${X_RULE_TAG_PREFIX}Bad Handle` }],
  });
  assert.deepEqual(parseXFilteredStreamLine(serialized(invalidTag), [HANDLE_A]), {
    status: 'rejected',
    reason: 'invalid_matching_rules',
  });

  const base = postEnvelope();
  for (const editIds of [
    [POST_ID, PREVIOUS_POST_ID],
    [POST_ID, POST_ID],
    [PREVIOUS_POST_ID],
  ]) {
    const value = {
      ...base,
      data: { ...(base.data as Record<string, unknown>), edit_history_tweet_ids: editIds },
    };
    assert.deepEqual(parseXFilteredStreamLine(serialized(value), [HANDLE_A]), {
      status: 'rejected',
      reason: 'invalid_edit_lineage',
    });
  }
});

test('keepalives are ignored and malformed, oversized, or invalid UTF-8 lines are rejected', () => {
  for (const keepalive of ['', '\r\n', Uint8Array.from([13, 10])]) {
    assert.deepEqual(parseXFilteredStreamLine(keepalive, [HANDLE_A]), {
      status: 'ignored',
      reason: 'keepalive',
    });
  }
  assert.deepEqual(parseXFilteredStreamLine(postEnvelope(), [HANDLE_A]), {
    status: 'rejected',
    reason: 'invalid_payload_type',
  });
  assert.deepEqual(parseXFilteredStreamLine('{', [HANDLE_A]), {
    status: 'rejected',
    reason: 'invalid_json',
  });
  assert.deepEqual(parseXFilteredStreamLine('{}\n{}', [HANDLE_A]), {
    status: 'rejected',
    reason: 'invalid_json',
  });
  assert.deepEqual(
    parseXFilteredStreamLine('x'.repeat(MAX_X_STREAM_LINE_BYTES + 1), [HANDLE_A]),
    { status: 'rejected', reason: 'payload_too_large' },
  );
  assert.deepEqual(parseXFilteredStreamLine(Uint8Array.from([0xff]), [HANDLE_A]), {
    status: 'rejected',
    reason: 'invalid_utf8',
  });
  assert.deepEqual(parseXFilteredStreamLine('\ud800', [HANDLE_A]), {
    status: 'rejected',
    reason: 'invalid_utf8',
  });
  assert.deepEqual(parseXFilteredStreamLine('[]', [HANDLE_A]), {
    status: 'rejected',
    reason: 'invalid_envelope',
  });
});

test('incomplete posts and overlong or blank text are rejected before normalization', () => {
  const base = postEnvelope();
  const data = base.data as Record<string, unknown>;

  for (const mutation of [
    { ...data, created_at: undefined },
    { ...data, created_at: '2026-02-31T16:30:00.000Z' },
    { ...data, created_at: '0000-01-01T00:00:00Z' },
    { ...data, text: ' \r\n ' },
    { ...data, text: 'unsafe\u0000control' },
    { ...data, text: 'unpaired\ud800surrogate' },
    { ...data, text: 'x'.repeat(MAX_X_POST_TEXT_CHARS + 1) },
    { ...data, id: '0' },
  ]) {
    assert.deepEqual(
      parseXFilteredStreamLine(serialized({ ...base, data: mutation }), [HANDLE_A]),
      { status: 'rejected', reason: 'invalid_data' },
    );
  }
});

test('bounded partial problems attach only sanitized categories to a valid lead', () => {
  const value = postEnvelope({
    errors: [
      {
        title: SECRET,
        detail: `do not reflect ${SECRET}`,
        status: 503,
        type: `https://api.x.com/problem?token=${SECRET}`,
      },
    ],
  });
  const result = parseXFilteredStreamLine(serialized(value), [HANDLE_A]);
  assert.equal(result.status, 'lead');
  if (result.status !== 'lead') return;
  assert.deepEqual(result.action.providerProblemCategories, ['server_fault']);
  assert.equal(JSON.stringify(result).includes(SECRET), false);
});

test('operational, rate, authorization, and connection-limit envelopes become safe controls', () => {
  const operational = parseXFilteredStreamLine(
    serialized({
      errors: [
        {
          title: 'operational-disconnect',
          disconnect_type: 'UpstreamOperationalDisconnect',
          detail: SECRET,
          type: 'https://api.x.com/2/problems/operational-disconnect',
        },
      ],
    }),
    [HANDLE_A],
  );
  assert.deepEqual(operational, {
    status: 'control',
    action: {
      provider: 'x-filtered-stream',
      type: 'disconnect',
      categories: ['operational_disconnect'],
      statuses: [],
      disposition: 'reconnect',
    },
  });
  assert.equal(JSON.stringify(operational).includes(SECRET), false);

  assert.deepEqual(
    parseXFilteredStreamLine(
      serialized({
        title: 'ConnectionException',
        connection_issue: 'TooManyConnections',
        type: 'https://api.x.com/2/problems/streaming-connection',
      }),
      [HANDLE_A],
    ),
    {
      status: 'control',
      action: {
        provider: 'x-filtered-stream',
        type: 'disconnect',
        categories: ['connection_limit'],
        statuses: [],
        disposition: 'halt',
      },
    },
  );

  const mixed = parseXFilteredStreamLine(
    serialized({ errors: [{ status: 429, title: 'rate' }, { status: 401, title: SECRET }] }),
    [HANDLE_A],
  );
  assert.deepEqual(mixed, {
    status: 'control',
    action: {
      provider: 'x-filtered-stream',
      type: 'provider_problem',
      categories: ['authorization', 'rate_limited'],
      statuses: [401, 429],
      disposition: 'halt',
    },
  });
  assert.equal(JSON.stringify(mixed).includes(SECRET), false);
});

test('malformed controls are rejected without reflecting provider strings', () => {
  assert.deepEqual(parseXFilteredStreamLine(serialized({ errors: [] }), [HANDLE_A]), {
    status: 'rejected',
    reason: 'invalid_control',
  });
  assert.deepEqual(
    parseXFilteredStreamLine(
      serialized({ errors: [{ title: 'x'.repeat(257) }] }),
      [HANDLE_A],
    ),
    { status: 'rejected', reason: 'invalid_control' },
  );
  assert.deepEqual(parseXFilteredStreamLine(serialized({ title: SECRET }), [HANDLE_A]), {
    status: 'control',
    action: {
      provider: 'x-filtered-stream',
      type: 'provider_problem',
      categories: ['provider_fault'],
      statuses: [],
      disposition: 'reconnect',
    },
  });
});

test('normal filtered-stream parsing never claims deletion-compliance coverage', () => {
  for (const data of [
    {
      delete: {
        event_at: '2026-07-15T17:00:00.000Z',
        tweet: { id: POST_ID, author_id: AUTHOR_ID },
      },
    },
    { delete: { tweet: { id: POST_ID } } },
    {
      delete: {
        event_at: '2026-07-15T17:00:00.000Z',
        tweet: { id: POST_ID },
      },
      id: POST_ID,
    },
  ]) {
    assert.deepEqual(
      parseXFilteredStreamLine(serialized({ data }), [HANDLE_A]),
      { status: 'rejected', reason: 'unsupported_compliance_envelope' },
    );
  }

  const result = parseXFilteredStreamLine(
    serialized({
      data: {
        delete: {
          event_at: '2026-07-15T17:00:00.000Z',
          tweet: { id: POST_ID, author_id: AUTHOR_ID },
        },
      },
    }),
    [HANDLE_A],
  );
  assert.deepEqual(result, { status: 'rejected', reason: 'unsupported_compliance_envelope' });
  assert.notEqual(result.status, 'lead');
});

test('last-seen IDs support exact replay detection but never claim provider resume semantics', () => {
  const checkpoint = checkpointXPostId(POST_ID);
  assert.deepEqual(checkpoint, {
    lastSeenPostId: POST_ID,
    idResumeSupported: false,
  });
  assert.equal(X_FILTERED_STREAM_ID_RESUME_SUPPORTED, false);
  assert.equal(isExactXPostIdReplay(checkpoint, POST_ID), true);
  assert.equal(isExactXPostIdReplay(checkpoint, PREVIOUS_POST_ID), false);
  assert.equal(isExactXPostIdReplay(undefined, POST_ID), false);
  assert.throws(() => checkpointXPostId('0'), /post ID/);
  assert.throws(
    () => isExactXPostIdReplay({ lastSeenPostId: 'bad', idResumeSupported: false }, POST_ID),
    /checkpoint/,
  );
  assert.throws(
    () =>
      isExactXPostIdReplay(
        { lastSeenPostId: POST_ID, idResumeSupported: true as false },
        POST_ID,
      ),
    /checkpoint/,
  );
});

test('Retry-After parsing accepts spec forms, rejects ambiguity, and enforces hard caps', () => {
  const nowMs = Date.parse('2026-07-15T16:00:00.000Z');
  assert.equal(parseXRetryAfterMs('12', { nowMs }), 12_000);
  assert.equal(
    parseXRetryAfterMs('Wed, 15 Jul 2026 16:00:30 GMT', { nowMs }),
    30_000,
  );
  assert.equal(parseXRetryAfterMs('999999999999999999999', { nowMs }), MAX_X_RETRY_AFTER_MS);
  assert.equal(parseXRetryAfterMs(' 12', { nowMs }), null);
  assert.equal(parseXRetryAfterMs('1.5', { nowMs }), null);
  assert.equal(parseXRetryAfterMs('Tue, 15 Jul 2026 16:00:30 GMT', { nowMs }), null);
  assert.equal(parseXRetryAfterMs('not-a-date', { nowMs }), null);
  assert.equal(parseXRetryAfterMs(null, { nowMs }), null);
  assert.throws(() => parseXRetryAfterMs('1', { nowMs, capMs: MAX_X_RETRY_AFTER_MS + 1 }));
});

test('reconnect delays follow bounded strategies and deterministic injected jitter', () => {
  assert.equal(calculateXReconnectDelayMs({ kind: 'immediate', attempt: 0 }), 0);
  assert.equal(calculateXReconnectDelayMs({ kind: 'network', attempt: 0 }), 250);
  assert.equal(
    calculateXReconnectDelayMs({ kind: 'network', attempt: 1_000 }),
    MAX_X_NETWORK_BACKOFF_MS,
  );
  assert.equal(calculateXReconnectDelayMs({ kind: 'http', attempt: 0 }), 5_000);
  assert.equal(
    calculateXReconnectDelayMs({ kind: 'http', attempt: 1_000 }),
    MAX_X_HTTP_BACKOFF_MS,
  );
  assert.equal(calculateXReconnectDelayMs({ kind: 'rate_limit', attempt: 0 }), 60_000);
  assert.equal(
    calculateXReconnectDelayMs({ kind: 'rate_limit', attempt: 1_000 }),
    MAX_X_RATE_LIMIT_BACKOFF_MS,
  );
  assert.equal(
    calculateXReconnectDelayMs({
      kind: 'http',
      attempt: 0,
      retryAfter: '30',
      nowMs: 0,
      jitter: () => 0.5,
    }),
    31_500,
  );
  assert.equal(
    calculateXReconnectDelayMs({
      kind: 'http',
      attempt: 1_000,
      jitter: () => 1,
    }),
    MAX_X_HTTP_BACKOFF_MS,
  );
  assert.throws(
    () => calculateXReconnectDelayMs({ kind: 'network', attempt: -1 }),
    /attempt/,
  );
  assert.throws(
    () => calculateXReconnectDelayMs({ kind: 'network', attempt: 0, jitter: () => 1.1 }),
    /Jitter/,
  );
});

test('the connector surface cannot mutate editorial state or use browser collection paths', () => {
  const source = readFileSync(
    new URL('../lib/newsroom-connectors/x-filtered-stream.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /\b(?:publish|publication|evidence|verify|verified|verification)\b/i);
  assert.doesNotMatch(source, /\b(?:playwright|puppeteer|selenium|scrap(?:e|ing))\b/i);

  const lead = parseXFilteredStreamLine(serialized(postEnvelope()), [HANDLE_A]);
  assert.equal(lead.status, 'lead');
  if (lead.status !== 'lead') return;
  const keys = JSON.stringify(lead.action);
  assert.doesNotMatch(keys, /publish|evidence|verify|verified|verification/i);
  assert.equal(lead.action.trust, 'untrusted');
  assert.equal(lead.action.reviewRequired, true);
});
