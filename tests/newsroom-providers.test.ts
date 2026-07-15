import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProviderExternalIdentity,
  createProviderPayloadHash,
  credentialPresenceDigest,
  evaluateProviderActivation,
  isHarmlessBootstrapNotice,
  NEWSROOM_PROVIDER_CATALOG,
  NEWSROOM_PROVIDER_KEYS,
  readCredentialPresence,
  summarizeProviderDeskSources,
} from '../lib/newsroom-providers';
import {
  canWriteWithFence,
  decideProviderLeaseAction,
  isProviderLeaseExpired,
  leaseExpiryFrom,
} from '../lib/newsroom-provider-leases';

test('provider catalog covers every governed key and defaults dark', () => {
  for (const key of NEWSROOM_PROVIDER_KEYS) {
    const entry = NEWSROOM_PROVIDER_CATALOG[key];
    assert.equal(entry.providerKey, key);
    assert.equal(entry.configEnabledDefault, false);
    assert.notEqual(entry.commercialStatus, 'approved');
    assert.ok(entry.retentionPosture.storeRawPayload === false);
    assert.ok(entry.retentionPosture.storeSourceBodies === false);
    assert.ok(entry.attributionPosture.length > 20);
  }
});

test('credential presence never returns secret material', () => {
  const env = {
    X_BEARER_TOKEN: 'super-secret-bearer-token-value',
    XAI_API_KEY: 'xai-secret-key-value-here',
  };
  assert.equal(readCredentialPresence('x_filtered_stream', env), 'present');
  assert.equal(readCredentialPresence('xai_x_search', env), 'present');
  assert.equal(readCredentialPresence('bluesky_jetstream', {}), 'present');
  assert.equal(readCredentialPresence('x_filtered_stream', {}), 'absent');
  assert.equal(
    readCredentialPresence('x_filtered_stream', { X_BEARER_TOKEN: ' short ' }),
    'invalid',
  );

  const digest = credentialPresenceDigest('x_filtered_stream', env);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(digest, /super-secret/);
  assert.doesNotMatch(JSON.stringify(env), /should not appear in digest checks only/);
});

test('activation evaluation never allows transport from configuration alone', () => {
  const snapshot = evaluateProviderActivation({
    providerKey: 'x_filtered_stream',
    configEnabled: true,
    commercialStatus: 'approved',
    environment: {
      BBSPORTS_REALTIME_NEWSROOM_ENABLED: 'true',
      BBSPORTS_NEWSROOM_X_ENABLED: 'true',
      BBSPORTS_APPROVED_X_API: 'true',
      X_BEARER_TOKEN: 'valid-looking-bearer-token',
    },
    runtime: {
      leaseHeld: true,
      recentSuccess: true,
      degraded: false,
    },
  });

  assert.equal(snapshot.transportAllowed, false);
  assert.equal(snapshot.blockers.length, 0);
  assert.equal(snapshot.operationalLabel, 'live');
  assert.deepEqual(snapshot.credentialEnvNames, ['X_BEARER_TOKEN']);
});

test('missing gates collect blockers and keep the desk inactive', () => {
  const snapshot = evaluateProviderActivation({
    providerKey: 'rss',
    configEnabled: false,
    commercialStatus: 'review_required',
    environment: {
      BBSPORTS_REALTIME_NEWSROOM_ENABLED: 'false',
    },
  });

  assert.equal(snapshot.transportAllowed, false);
  assert.equal(snapshot.operationalLabel, 'inactive');
  assert.ok(snapshot.blockers.includes('global_disabled'));
  assert.ok(snapshot.blockers.includes('connector_disabled'));
  assert.ok(snapshot.blockers.includes('env_approval_missing'));
  assert.ok(snapshot.blockers.includes('config_disabled'));
  assert.ok(snapshot.blockers.includes('commercial_review_required'));
});

test('desk source summary never upgrades configuration crumbs to live', () => {
  const inactive = evaluateProviderActivation({
    providerKey: 'bluesky_jetstream',
    configEnabled: false,
    commercialStatus: 'review_required',
    environment: {},
  });
  assert.equal(summarizeProviderDeskSources([inactive]), 'Manual only');

  // A credential alone is not desk "configured monitoring."
  const credentialOnly = evaluateProviderActivation({
    providerKey: 'x_filtered_stream',
    configEnabled: false,
    commercialStatus: 'review_required',
    environment: { X_BEARER_TOKEN: 'valid-looking-bearer-token' },
  });
  assert.equal(summarizeProviderDeskSources([credentialOnly]), 'Manual only');

  const configured = evaluateProviderActivation({
    providerKey: 'x_filtered_stream',
    configEnabled: true,
    commercialStatus: 'review_required',
    environment: {},
  });
  assert.equal(summarizeProviderDeskSources([configured]), 'Monitoring configured');
});

test('payload hashes and external identities are deterministic and provider-scoped', () => {
  const left = createProviderPayloadHash('x_filtered_stream', '123', {
    text: 'hello',
    author: 'a',
  });
  const right = createProviderPayloadHash('x_filtered_stream', '123', {
    text: 'hello',
    author: 'a',
  });
  const different = createProviderPayloadHash('x_filtered_stream', '123', {
    text: 'hello!',
    author: 'a',
  });
  assert.equal(left, right);
  assert.notEqual(left, different);
  assert.match(left, /^[a-f0-9]{64}$/);
  assert.equal(
    createProviderExternalIdentity('bluesky_jetstream', 'did:plc:abc/post/1'),
    'bluesky_jetstream:did:plc:abc/post/1',
  );
  assert.throws(() => createProviderExternalIdentity('rss', '  '));
});

test('lease fencing increases only on acquire and rejects foreign owners', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');
  const acquire = decideProviderLeaseAction({
    existing: null,
    ownerId: 'worker-a',
    now,
  });
  assert.equal(acquire.action, 'acquire');
  if (acquire.action !== 'acquire') throw new Error('expected acquire');
  assert.equal(acquire.nextFenceToken, 1);

  const held = {
    providerKey: 'x_filtered_stream',
    ownerId: 'worker-a',
    fenceToken: 3,
    acquiredAt: new Date('2026-07-15T11:59:00.000Z'),
    renewedAt: new Date('2026-07-15T11:59:30.000Z'),
    expiresAt: new Date('2026-07-15T12:00:30.000Z'),
    heartbeatAt: new Date('2026-07-15T11:59:30.000Z'),
  };

  const renew = decideProviderLeaseAction({
    existing: held,
    ownerId: 'worker-a',
    offeredFenceToken: 3,
    now,
  });
  assert.equal(renew.action, 'renew');

  const foreign = decideProviderLeaseAction({
    existing: held,
    ownerId: 'worker-b',
    now,
  });
  assert.deepEqual(foreign, { action: 'reject', reason: 'held_by_other' });

  const expired = decideProviderLeaseAction({
    existing: { ...held, expiresAt: new Date('2026-07-15T11:59:59.000Z') },
    ownerId: 'worker-b',
    now,
  });
  assert.equal(expired.action, 'acquire');
  if (expired.action !== 'acquire') throw new Error('expected acquire');
  assert.equal(expired.nextFenceToken, 4);

  assert.equal(
    canWriteWithFence({ lease: held, ownerId: 'worker-a', fenceToken: 3, now }),
    true,
  );
  assert.equal(
    canWriteWithFence({ lease: held, ownerId: 'worker-a', fenceToken: 2, now }),
    false,
  );
  assert.equal(isProviderLeaseExpired(held, now), false);
  assert.ok(leaseExpiryFrom(now, 30_000).getTime() > now.getTime());
});

test('harmless bootstrap notices are filtered without hiding warnings or errors', () => {
  assert.equal(
    isHarmlessBootstrapNotice({
      severity: 'NOTICE',
      message: 'relation "news_providers" already exists, skipping',
    }),
    true,
  );
  assert.equal(
    isHarmlessBootstrapNotice({
      severity: 'NOTICE',
      message: 'column "config_enabled" of relation "news_providers" already exists, skipping',
    }),
    true,
  );
  assert.equal(
    isHarmlessBootstrapNotice({
      severity: 'NOTICE',
      message: 'extension "pgcrypto" already exists, skipping',
    }),
    true,
  );
  assert.equal(
    isHarmlessBootstrapNotice({
      severity: 'NOTICE',
      message:
        'constraint "articles_published_snapshot_complete" of relation "articles" does not exist, skipping',
    }),
    true,
  );
  assert.equal(
    isHarmlessBootstrapNotice({
      severity: 'NOTICE',
      message:
        'trigger "articles_guarded_delete" for relation "articles" does not exist, skipping',
    }),
    true,
  );

  assert.equal(
    isHarmlessBootstrapNotice({
      severity: 'WARNING',
      message: 'relation "news_providers" already exists, skipping',
    }),
    false,
  );
  assert.equal(
    isHarmlessBootstrapNotice({
      severity: 'ERROR',
      message: 'relation "news_providers" already exists, skipping',
    }),
    false,
  );
  assert.equal(
    isHarmlessBootstrapNotice({
      severity: 'NOTICE',
      message: 'there is no transaction in progress',
    }),
    false,
  );
  assert.equal(
    isHarmlessBootstrapNotice({
      severity: 'NOTICE',
      message: 'permission denied for table news_providers',
    }),
    false,
  );
  assert.equal(
    isHarmlessBootstrapNotice({
      severity: 'NOTICE',
      message: 'duplicate key value violates unique constraint "news_providers_pkey"',
    }),
    false,
  );
});
