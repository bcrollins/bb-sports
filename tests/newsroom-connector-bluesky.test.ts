import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  BLUESKY_JETSTREAM_ENDPOINT,
  BLUESKY_JETSTREAM_ENDPOINTS,
  BLUESKY_JETSTREAM_TRANSPORT_CONTRACT,
  BLUESKY_POST_COLLECTION,
  DEFAULT_JETSTREAM_REWIND_US,
  MAX_BLUESKY_POST_TEXT_CHARS,
  MAX_JETSTREAM_LOOKBACK_US,
  MAX_JETSTREAM_PAYLOAD_BYTES,
  MAX_JETSTREAM_REWIND_US,
  buildBlueskyJetstreamSubscriptionPlan,
  buildBlueskyJetstreamUrl,
  buildBlueskyPostUrl,
  calculateJetstreamReplayCursor,
  checkpointJetstreamCursor,
  parseBlueskyJetstreamMessage as parseBlueskyJetstreamWireMessage,
  readBlueskyJetstreamStaticPreflight,
  selectBlueskyJetstreamEndpoint,
} from '../lib/newsroom-connectors';

const DID_A = 'did:plc:abcdefghijklmnopqrstuvwx';
const DID_B = 'did:plc:zyxwvutsrqponmlkjihgfedc';
const DID_UNAPPROVED = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
const RKEY = '3l5sportsreport:1';
const TIME_US = 1_752_595_200_123_000;

function activeEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    BBSPORTS_REALTIME_NEWSROOM_ENABLED: 'true',
    BBSPORTS_NEWSROOM_BLUESKY_ENABLED: 'true',
    BBSPORTS_APPROVED_BLUESKY_JETSTREAM: 'true',
    BBSPORTS_BLUESKY_WANTED_DIDS: DID_A,
    ...overrides,
  };
}

function parseBlueskyJetstreamMessage(payload: unknown, wantedDids: readonly string[]) {
  const wirePayload =
    typeof payload === 'string' || payload instanceof Uint8Array
      ? payload
      : JSON.stringify(payload);
  return parseBlueskyJetstreamWireMessage(wirePayload, wantedDids);
}

function commitEnvelope(
  operation: 'create' | 'update' | 'delete',
  overrides: Record<string, unknown> = {},
) {
  return {
    did: DID_A,
    time_us: TIME_US,
    kind: 'commit',
    commit: {
      operation,
      collection: BLUESKY_POST_COLLECTION,
      rkey: RKEY,
      cid: 'bafyreicid123',
      ...(operation === 'delete'
        ? {}
        : {
            record: {
              $type: BLUESKY_POST_COLLECTION,
              text: 'Team confirms the transaction in an official announcement.',
              createdAt: '2026-07-15T12:00:00.000Z',
              embed: { ignored: 'Provider body is deliberately not normalized.' },
            },
          }),
      ...overrides,
    },
  };
}

test('Bluesky static preflight requires exact global and provider gates', () => {
  assert.deepEqual(readBlueskyJetstreamStaticPreflight({}), {
    passed: false,
    connectionAllowed: false,
    reason: 'global_disabled',
  });
  assert.deepEqual(
    readBlueskyJetstreamStaticPreflight(
      activeEnvironment({ BBSPORTS_REALTIME_NEWSROOM_ENABLED: 'false' }),
    ),
    { passed: false, connectionAllowed: false, reason: 'global_disabled' },
  );
  assert.deepEqual(
    readBlueskyJetstreamStaticPreflight(
      activeEnvironment({ BBSPORTS_REALTIME_NEWSROOM_ENABLED: 'TRUE-ish' }),
    ),
    { passed: false, connectionAllowed: false, reason: 'global_disabled' },
  );
  assert.deepEqual(
    readBlueskyJetstreamStaticPreflight(
      activeEnvironment({ BBSPORTS_NEWSROOM_BLUESKY_ENABLED: 'TRUE' }),
    ),
    { passed: false, connectionAllowed: false, reason: 'connector_disabled' },
  );
  assert.deepEqual(
    readBlueskyJetstreamStaticPreflight(
      activeEnvironment({ BBSPORTS_APPROVED_BLUESKY_JETSTREAM: '1' }),
    ),
    { passed: false, connectionAllowed: false, reason: 'approval_missing' },
  );
  assert.deepEqual(
    readBlueskyJetstreamStaticPreflight(
      activeEnvironment({ BBSPORTS_BLUESKY_WANTED_DIDS: ' ' }),
    ),
    { passed: false, connectionAllowed: false, reason: 'allowlist_missing' },
  );
  assert.deepEqual(
    readBlueskyJetstreamStaticPreflight(
      activeEnvironment({ BBSPORTS_BLUESKY_WANTED_DIDS: 'did:web:reporter.example' }),
    ),
    { passed: false, connectionAllowed: false, reason: 'allowlist_invalid' },
  );
});

test('a passing static preflight is immutable but never claims a live connection', () => {
  const preflight = readBlueskyJetstreamStaticPreflight(
    activeEnvironment({
      BBSPORTS_BLUESKY_WANTED_DIDS: `${DID_B}, ${DID_A}\n${DID_B}`,
    }),
  );
  assert.equal(preflight.passed, true);
  if (!preflight.passed) return;
  assert.equal(preflight.connectionAllowed, false);
  assert.equal(preflight.activationBlocker, 'runtime_transport_not_implemented');
  assert.deepEqual(preflight.endpoints, BLUESKY_JETSTREAM_ENDPOINTS);
  assert.equal(preflight.collection, BLUESKY_POST_COLLECTION);
  assert.deepEqual(preflight.wantedDids, [DID_A, DID_B]);
  assert.equal(Object.isFrozen(preflight), true);
  assert.equal(Object.isFrozen(preflight.endpoints), true);
  assert.equal(Object.isFrozen(preflight.wantedDids), true);
});

test('subscription plans use only approved failover endpoints and bounded transport parameters', () => {
  assert.throws(() => buildBlueskyJetstreamUrl({ wantedDids: [] }), /nonempty curated/);
  assert.throws(
    () => buildBlueskyJetstreamUrl({ wantedDids: [DID_A, 'did:web:reporter.example'] }),
    /nonempty curated/,
  );

  assert.deepEqual(
    Array.from({ length: 8 }, (_, attempt) => selectBlueskyJetstreamEndpoint(attempt)),
    [...BLUESKY_JETSTREAM_ENDPOINTS, ...BLUESKY_JETSTREAM_ENDPOINTS],
  );
  assert.throws(() => selectBlueskyJetstreamEndpoint(-1), /failoverAttempt/);

  const plan = buildBlueskyJetstreamSubscriptionPlan({
    wantedDids: [DID_B, DID_A],
    failoverAttempt: 4,
  });
  const value = plan.url;
  assert.match(value, /wantedCollections=app\.bsky\.feed\.post/);
  assert.match(value, /wantedDids=did%3Aplc%3A/);
  const url = new URL(value);
  assert.equal(`${url.origin}${url.pathname}`, BLUESKY_JETSTREAM_ENDPOINT);
  assert.equal(plan.endpoint, BLUESKY_JETSTREAM_ENDPOINT);
  assert.equal(plan.retentionGap, false);
  assert.deepEqual(url.searchParams.getAll('wantedCollections'), [BLUESKY_POST_COLLECTION]);
  assert.deepEqual(url.searchParams.getAll('wantedDids'), [DID_A, DID_B]);
  assert.equal(url.searchParams.get('maxMessageSizeBytes'), String(MAX_JETSTREAM_PAYLOAD_BYTES));
  assert.equal(url.searchParams.has('cursor'), false);
  assert.deepEqual(BLUESKY_JETSTREAM_TRANSPORT_CONTRACT, {
    framing: 'websocket_message',
    parserMaxPayloadBytes: MAX_JETSTREAM_PAYLOAD_BYTES,
    transportMaxPrebufferBytes: MAX_JETSTREAM_PAYLOAD_BYTES,
    overflowDisposition: 'terminate_connection_before_parse',
  });
});

test('post URLs use encoded, validated path segments', () => {
  assert.equal(
    buildBlueskyPostUrl(DID_A, RKEY),
    'https://bsky.app/profile/did%3Aplc%3Aabcdefghijklmnopqrstuvwx/post/3l5sportsreport%3A1',
  );
  assert.throws(() => buildBlueskyPostUrl(DID_A, '../escape'), /record key/);
  assert.throws(() => buildBlueskyPostUrl('did:web:reporter.example', RKEY), /DID/);
});

test('cursor checkpoints advance monotonically and replay rewind is bounded', () => {
  assert.deepEqual(checkpointJetstreamCursor(undefined, 500), { timeUs: 500 });
  assert.deepEqual(checkpointJetstreamCursor({ timeUs: 500 }, 499), { timeUs: 500 });
  assert.deepEqual(checkpointJetstreamCursor({ timeUs: 500 }, 501), { timeUs: 501 });
  assert.throws(() => checkpointJetstreamCursor(undefined, -1), /nonnegative safe integer/);

  const nowUs = 2_000_000_000_000_000;
  assert.deepEqual(
    calculateJetstreamReplayCursor(
      { timeUs: nowUs - 10_000_000 },
      { nowUs, rewindUs: MAX_JETSTREAM_REWIND_US * 10 },
    ),
    {
      cursorUs: nowUs - 10_000_000 - MAX_JETSTREAM_REWIND_US,
      retentionGap: false,
      rewindClamped: true,
    },
  );
  assert.deepEqual(
    calculateJetstreamReplayCursor({ timeUs: nowUs + 50_000_000 }, { nowUs }),
    {
      cursorUs: nowUs - DEFAULT_JETSTREAM_REWIND_US,
      retentionGap: false,
      rewindClamped: false,
    },
  );
  assert.deepEqual(
    calculateJetstreamReplayCursor({ timeUs: 1 }, { nowUs }),
    {
      cursorUs: nowUs - MAX_JETSTREAM_LOOKBACK_US,
      retentionGap: true,
      rewindClamped: false,
    },
  );
});

test('subscription URLs include only a bounded replay cursor', () => {
  const nowUs = 2_000_000_000_000_000;
  const plan = buildBlueskyJetstreamSubscriptionPlan({
    wantedDids: [DID_A],
    checkpoint: { timeUs: nowUs - 1_000_000 },
    nowUs,
    rewindUs: 10_000_000,
  });
  const url = new URL(plan.url);
  assert.equal(url.searchParams.get('cursor'), String(nowUs - 11_000_000));
  assert.equal(plan.retentionGap, false);

  const clamped = buildBlueskyJetstreamSubscriptionPlan({
    wantedDids: [DID_A],
    checkpoint: { timeUs: 1 },
    nowUs,
  });
  assert.equal(clamped.retentionGap, true);
  assert.equal(clamped.cursor?.cursorUs, nowUs - MAX_JETSTREAM_LOOKBACK_US);
});

test('create and update commits normalize bounded metadata and drop provider body fields', () => {
  for (const operation of ['create', 'update'] as const) {
    const result = parseBlueskyJetstreamMessage(commitEnvelope(operation), [DID_A]);
    assert.equal(result.status, 'action');
    if (result.status !== 'action') continue;
    assert.equal(result.action.type, 'post_upsert');
    if (result.action.type !== 'post_upsert') continue;
    assert.equal(result.action.operation, operation);
    assert.equal(result.action.did, DID_A);
    assert.equal(result.action.accountKey, `bluesky:${DID_A}`);
    assert.equal(result.action.trust, 'untrusted');
    assert.equal(result.action.reviewRequired, true);
    assert.equal(result.action.externalId, `at://${DID_A}/${BLUESKY_POST_COLLECTION}/${RKEY}`);
    assert.equal(result.action.sourceCreatedAt, '2026-07-15T12:00:00.000Z');
    assert.equal(result.action.text, 'Team confirms the transaction in an official announcement.');
    assert.equal('embed' in result.action, false);
  }
});

test('delete commits produce tombstone actions without requiring a record body', () => {
  const result = parseBlueskyJetstreamMessage(commitEnvelope('delete'), [DID_A]);
  assert.equal(result.status, 'action');
  if (result.status !== 'action') return;
  assert.deepEqual(
    {
      type: result.action.type,
      operation: result.action.type === 'post_delete' ? result.action.operation : undefined,
      externalId: result.action.externalId,
    },
    {
      type: 'post_delete',
      operation: 'delete',
      externalId: `at://${DID_A}/${BLUESKY_POST_COLLECTION}/${RKEY}`,
    },
  );
});

test('non-allowlisted DIDs and non-post collections are ignored', () => {
  assert.deepEqual(
    parseBlueskyJetstreamMessage({ ...commitEnvelope('create'), did: DID_UNAPPROVED }, [DID_A]),
    { status: 'ignored', reason: 'not_allowlisted' },
  );
  assert.deepEqual(
    parseBlueskyJetstreamMessage(
      commitEnvelope('create', { collection: 'app.bsky.feed.like' }),
      [DID_A],
    ),
    { status: 'ignored', reason: 'collection_not_requested' },
  );
});

test('identity and ordinary account envelopes preserve only lifecycle metadata', () => {
  const identity = parseBlueskyJetstreamMessage(
    {
      did: DID_A,
      time_us: TIME_US,
      kind: 'identity',
      identity: { did: DID_A, handle: 'Reporter.Sports.Example', displayName: 'Ignored' },
    },
    [DID_A],
  );
  assert.equal(identity.status, 'action');
  if (identity.status === 'action' && identity.action.type === 'identity') {
    assert.equal(identity.action.handle, 'reporter.sports.example');
    assert.equal(identity.action.accountKey, `bluesky:${DID_A}`);
    assert.equal(identity.action.trust, 'untrusted');
    assert.equal(identity.action.reviewRequired, true);
    assert.equal('displayName' in identity.action, false);
  } else {
    assert.fail('Expected an identity action');
  }

  const account = parseBlueskyJetstreamMessage(
    {
      did: DID_A,
      time_us: TIME_US,
      kind: 'account',
      account: { did: DID_A, active: false, status: 'deactivated', privateData: 'ignored' },
    },
    [DID_A],
  );
  assert.equal(account.status, 'action');
  if (account.status === 'action' && account.action.type === 'account') {
    assert.equal(account.action.active, false);
    assert.equal(account.action.status, 'deactivated');
    assert.equal(account.action.accountKey, `bluesky:${DID_A}`);
    assert.equal(account.action.trust, 'untrusted');
    assert.equal(account.action.reviewRequired, true);
    assert.equal('privateData' in account.action, false);
  } else {
    assert.fail('Expected an account action');
  }
});

test('documented account takendown is explicit while a synthetic fourth kind is ignored', () => {
  const account = parseBlueskyJetstreamMessage(
    {
      did: DID_A,
      time_us: TIME_US,
      kind: 'account',
      account: { did: DID_A, active: false, status: 'takendown' },
    },
    [DID_A],
  );
  assert.equal(account.status, 'action');
  if (account.status === 'action') {
    assert.equal(account.action.type, 'account_takedown');
    if (account.action.type === 'account_takedown') {
      assert.equal(account.action.active, false);
      assert.equal(account.action.status, 'takendown');
      assert.equal(account.action.trust, 'untrusted');
      assert.equal(account.action.reviewRequired, true);
    }
  }

  const synthetic = parseBlueskyJetstreamMessage(
    {
      did: DID_A,
      time_us: TIME_US,
      kind: 'takedown',
      takedown: {
        did: DID_A,
        subject: 'record',
        collection: BLUESKY_POST_COLLECTION,
        rkey: RKEY,
        reason: 'provider-takedown',
      },
    },
    [DID_A],
  );
  assert.deepEqual(synthetic, { status: 'ignored', reason: 'unsupported_kind' });
});

test('post timestamps are strict RFC 3339 and retained text is NFC with fatal controls', () => {
  const normalized = parseBlueskyJetstreamMessage(
    commitEnvelope('create', {
      record: {
        $type: BLUESKY_POST_COLLECTION,
        text: 'Cafe\u0301 update\r\nconfirmed',
        createdAt: '2026-07-15T08:00:00-04:00',
      },
    }),
    [DID_A],
  );
  assert.equal(normalized.status, 'action');
  if (normalized.status === 'action' && normalized.action.type === 'post_upsert') {
    assert.equal(normalized.action.text, 'Café update\nconfirmed');
    assert.equal(normalized.action.sourceCreatedAt, '2026-07-15T12:00:00.000Z');
  } else {
    assert.fail('Expected a normalized post action');
  }

  for (const createdAt of [
    '2026-07-15',
    '0000-01-01T00:00:00Z',
    '2026-02-31T12:00:00Z',
    '2026-07-15T12:00:00+24:00',
    '2026-07-15 12:00:00Z',
  ]) {
    assert.deepEqual(
      parseBlueskyJetstreamMessage(
        commitEnvelope('create', {
          record: {
            $type: BLUESKY_POST_COLLECTION,
            text: 'Valid text',
            createdAt,
          },
        }),
        [DID_A],
      ),
      { status: 'rejected', reason: 'invalid_record' },
    );
  }

  for (const text of ['unsafe\u0000control', 'unpaired\ud800surrogate', '\r\n\t']) {
    assert.deepEqual(
      parseBlueskyJetstreamMessage(
        commitEnvelope('create', {
          record: {
            $type: BLUESKY_POST_COLLECTION,
            text,
            createdAt: '2026-07-15T12:00:00Z',
          },
        }),
        [DID_A],
      ),
      { status: 'rejected', reason: 'invalid_record' },
    );
  }
});

test('malformed, oversized, and invalid UTF-8 payloads are rejected deterministically', () => {
  assert.deepEqual(parseBlueskyJetstreamWireMessage(commitEnvelope('create'), [DID_A]), {
    status: 'rejected',
    reason: 'invalid_payload_type',
  });
  assert.deepEqual(parseBlueskyJetstreamMessage('{', [DID_A]), {
    status: 'rejected',
    reason: 'invalid_json',
  });
  assert.deepEqual(
    parseBlueskyJetstreamMessage('x'.repeat(MAX_JETSTREAM_PAYLOAD_BYTES + 1), [DID_A]),
    { status: 'rejected', reason: 'payload_too_large' },
  );
  assert.deepEqual(parseBlueskyJetstreamMessage(Uint8Array.from([0xff]), [DID_A]), {
    status: 'rejected',
    reason: 'invalid_utf8',
  });
  assert.deepEqual(parseBlueskyJetstreamWireMessage('\ud800', [DID_A]), {
    status: 'rejected',
    reason: 'invalid_utf8',
  });
  assert.deepEqual(
    parseBlueskyJetstreamMessage(
      commitEnvelope('create', {
        record: {
          $type: BLUESKY_POST_COLLECTION,
          text: 'x'.repeat(MAX_BLUESKY_POST_TEXT_CHARS + 1),
          createdAt: '2026-07-15T12:00:00.000Z',
        },
      }),
      [DID_A],
    ),
    { status: 'rejected', reason: 'invalid_record' },
  );
  assert.deepEqual(
    parseBlueskyJetstreamMessage(
      { ...commitEnvelope('create'), did: `did:plc:${'a'.repeat(25)}` },
      [DID_A],
    ),
    { status: 'rejected', reason: 'invalid_envelope' },
  );
});

test('mismatched nested identities are rejected and synthetic removals stay unsupported', () => {
  assert.deepEqual(
    parseBlueskyJetstreamMessage(
      {
        did: DID_A,
        time_us: TIME_US,
        kind: 'identity',
        identity: { did: DID_B, handle: 'reporter.example' },
      },
      [DID_A],
    ),
    { status: 'rejected', reason: 'invalid_identity' },
  );
  assert.deepEqual(
    parseBlueskyJetstreamMessage(
      {
        did: DID_A,
        time_us: TIME_US,
        kind: 'takedown',
        takedown: {
          subject: 'record',
          collection: BLUESKY_POST_COLLECTION,
          rkey: '../escape',
        },
      },
      [DID_A],
    ),
    { status: 'ignored', reason: 'unsupported_kind' },
  );
});

test('the pure connector has no editorial, persistence, browser, or transport side effects', () => {
  const source = readFileSync(
    new URL('../lib/newsroom-connectors/bluesky-jetstream.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /\b(?:publish|publication|evidence|verified|verification)\b/i);
  assert.doesNotMatch(source, /from ['"](?:@?\/?.*\/(?:db|queries)|drizzle|pg)['"]/i);
  assert.doesNotMatch(source, /\b(?:fetch|WebSocket|playwright|puppeteer|selenium)\s*\(/);

  const action = parseBlueskyJetstreamMessage(commitEnvelope('create'), [DID_A]);
  assert.equal(action.status, 'action');
  if (action.status !== 'action') return;
  assert.equal(action.action.trust, 'untrusted');
  assert.equal(action.action.reviewRequired, true);
  assert.equal('ownerKey' in action.action, false);
});
