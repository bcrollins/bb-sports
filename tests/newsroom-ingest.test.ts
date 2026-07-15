import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blueskyPostLeadToIngestCandidate,
  decideProviderIngestGate,
  normalizeProviderIngestCandidate,
  PROVIDER_INGEST_FORBIDDEN_ACTIONS,
  providerIntakeSourceKey,
  xPostLeadToIngestCandidate,
} from '../lib/newsroom-ingest';
import type { XPostLeadAction } from '../lib/newsroom-connectors/x-filtered-stream';

const baseXLead: XPostLeadAction = {
  provider: 'x-filtered-stream',
  type: 'post_lead',
  trust: 'untrusted',
  reviewRequired: true,
  postId: '1234567890123456789',
  externalId: 'x:post:1234567890123456789',
  authorId: '9876543210',
  authorUsername: 'ReporterName',
  watchedHandle: 'reportername',
  sourceCreatedAt: '2026-07-15T12:00:00.000Z',
  sourceUrl: 'https://x.com/ReporterName/status/1234567890123456789',
  text: 'Breaking: the Bears trade for a franchise left tackle.',
  matchingRuleIds: ['1'],
  providerProblemCategories: [],
  editLineage: {
    rootPostId: '1234567890123456789',
    currentPostId: '1234567890123456789',
    previousPostIds: [],
    isEdit: false,
  },
};

test('normalizeProviderIngestCandidate bounds fields and excludes restricted body storage', () => {
  const normalized = normalizeProviderIngestCandidate({
    providerKey: 'x_filtered_stream',
    externalId: 'x:post:1',
    ownerKey: 'X:Reporter',
    ownerIdentity: 'x:user:1',
    headline: '  Bears make a trade  ',
    summary: 'Short alert summary',
    canonicalUrl: 'https://x.com/Reporter/status/1',
    provenance: { postId: '1', trust: 'untrusted' },
  });

  assert.equal(normalized.ownerKey, 'x:reporter');
  assert.equal(normalized.sourceKey, 'provider-intake:x_filtered_stream');
  assert.match(normalized.exactContentHash, /^[a-f0-9]{64}$/);
  assert.match(normalized.payloadHash, /^[a-f0-9]{64}$/);
  assert.equal(normalized.rawPayload.intake, 'provider');
  assert.equal(normalized.rawPayload.providerKey, 'x_filtered_stream');
  // Full free-form body keys must not be stored under rawPayload.
  assert.equal('text' in normalized.rawPayload, false);
  assert.equal('body' in normalized.rawPayload, false);
  assert.deepEqual(normalized.provenance, { postId: '1', trust: 'untrusted' });
});

test('normalize rejects secret-bearing provenance and payload hash mismatch', () => {
  assert.throws(
    () =>
      normalizeProviderIngestCandidate({
        providerKey: 'rss',
        externalId: 'guid-1',
        ownerKey: 'ncaa',
        ownerIdentity: 'https://www.ncaa.com/',
        headline: 'Score update',
        provenance: { bearerToken: 'nope' },
      }),
    /secret-bearing/i,
  );

  assert.throws(
    () =>
      normalizeProviderIngestCandidate({
        providerKey: 'rss',
        externalId: 'guid-1',
        ownerKey: 'ncaa',
        ownerIdentity: 'https://www.ncaa.com/',
        headline: 'Score update',
        payloadHash: '0'.repeat(64),
      }),
    /payloadHash does not match/i,
  );
});

test('X and Bluesky lead mappers produce DID/handle-safe candidates', () => {
  const xCandidate = xPostLeadToIngestCandidate(baseXLead);
  assert.equal(xCandidate.providerKey, 'x_filtered_stream');
  assert.equal(xCandidate.externalId, baseXLead.externalId);
  assert.equal(xCandidate.ownerKey, 'x:reportername');
  assert.match(String(xCandidate.headline), /Bears trade/i);
  assert.equal(xCandidate.provenance?.trust, 'untrusted');

  const bsky = blueskyPostLeadToIngestCandidate({
    provider: 'bluesky-jetstream',
    type: 'post_lead',
    did: 'did:plc:abcdefghijklmnopqrstuvwx',
    rkey: '3k2a',
    text: 'Official: free agent signs with the Bears.',
    sourceCreatedAt: '2026-07-15T12:01:00.000Z',
    handle: 'beat.bsky.social',
    trust: 'untrusted',
    reviewRequired: true,
  });
  assert.equal(bsky.providerKey, 'bluesky_jetstream');
  assert.equal(bsky.ownerIdentity, 'did:plc:abcdefghijklmnopqrstuvwx');
  assert.equal(bsky.ownerKey, 'bluesky:did:plc:abcdefghijklmnopqrstuvwx');
  assert.equal(bsky.provenance?.identityBasis, 'did');
  assert.notEqual(bsky.ownerKey, 'bluesky:beat.bsky.social');

  const normalized = normalizeProviderIngestCandidate(bsky);
  assert.equal(normalized.sourceKey, providerIntakeSourceKey('bluesky_jetstream'));
});

test('ingest gate fails closed for dark, prohibited, and mismatched sources', () => {
  assert.deepEqual(
    decideProviderIngestGate({
      provider: null,
      source: null,
      candidateOwnerKey: 'x:a',
    }),
    { allowed: false, reason: 'provider_missing' },
  );

  assert.equal(
    decideProviderIngestGate({
      provider: {
        providerKey: 'x_filtered_stream',
        configEnabled: false,
        commercialStatus: 'approved',
      },
      source: {
        sourceKey: 'provider-intake:x_filtered_stream',
        enabled: true,
        ownerKey: 'provider:x_filtered_stream',
        commercialStatus: 'approved',
      },
      candidateOwnerKey: 'x:a',
    }).allowed,
    false,
  );

  const prohibited = decideProviderIngestGate({
    provider: {
      providerKey: 'x_filtered_stream',
      configEnabled: true,
      commercialStatus: 'prohibited',
    },
    source: {
      sourceKey: 'provider-intake:x_filtered_stream',
      enabled: true,
      ownerKey: 'provider:x_filtered_stream',
      commercialStatus: 'approved',
    },
    candidateOwnerKey: 'x:a',
  });
  assert.equal(prohibited.allowed, false);
  if (!prohibited.allowed) assert.equal(prohibited.reason, 'provider_prohibited');

  const allowed = decideProviderIngestGate({
    provider: {
      providerKey: 'x_filtered_stream',
      configEnabled: true,
      commercialStatus: 'approved',
    },
    source: {
      sourceKey: 'provider-intake:x_filtered_stream',
      enabled: true,
      ownerKey: 'provider:x_filtered_stream',
      commercialStatus: 'review_required',
    },
    candidateOwnerKey: 'x:reporter',
  });
  assert.deepEqual(allowed, { allowed: true });

  const mismatched = decideProviderIngestGate({
    provider: {
      providerKey: 'x_filtered_stream',
      configEnabled: true,
      commercialStatus: 'approved',
    },
    source: {
      sourceKey: 'account-x-reporter',
      enabled: true,
      ownerKey: 'x:other',
      commercialStatus: 'approved',
    },
    candidateOwnerKey: 'x:reporter',
  });
  assert.equal(mismatched.allowed, false);
  if (!mismatched.allowed) assert.equal(mismatched.reason, 'source_owner_mismatch');
});

test('forbidden editorial actions are enumerated for contract tests', () => {
  assert.ok(PROVIDER_INGEST_FORBIDDEN_ACTIONS.includes('event.verified'));
  assert.ok(PROVIDER_INGEST_FORBIDDEN_ACTIONS.includes('article.published'));
});
