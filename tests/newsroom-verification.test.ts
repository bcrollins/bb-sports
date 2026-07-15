import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessNewsVerification,
  type VerificationEvidence,
} from '../lib/newsroom-verification';

function evidence(overrides: Partial<VerificationEvidence> = {}): VerificationEvidence {
  return {
    id: crypto.randomUUID(),
    supersedesEvidenceId: null,
    stance: 'supporting',
    evidenceClass: 'reporting',
    ownerKey: 'source-one',
    sourceTier: 'tier_1',
    credible: true,
    sourceId: null,
    signalId: null,
    url: 'https://example.com/report',
    excerpt: '',
    notes: '',
    ...overrides,
  };
}

test('one supporting primary or official item satisfies verification', () => {
  const primary = assessNewsVerification([
    evidence({ evidenceClass: 'primary', sourceTier: 'primary', credible: true }),
  ]);
  assert.equal(primary.passes, true);
  assert.equal(primary.reason, 'primary_or_official_support');

  const official = assessNewsVerification([
    evidence({ evidenceClass: 'official', sourceTier: 'official', credible: true }),
  ]);
  assert.equal(official.passes, true);
  assert.equal(official.qualifyingPrimaryOrOfficialCount, 1);
});

test('primary or official classification never bypasses credibility review', () => {
  const result = assessNewsVerification([
    evidence({ evidenceClass: 'official', sourceTier: 'official', credible: false }),
  ]);
  assert.equal(result.passes, false);
  assert.equal(result.reason, 'insufficient_support');
  assert.equal(result.qualifyingPrimaryOrOfficialCount, 0);
});

test('credible classifications never bypass substantive provenance', () => {
  const result = assessNewsVerification([
    evidence({
      evidenceClass: 'official',
      sourceTier: 'official',
      credible: true,
      url: null,
      sourceId: null,
      signalId: null,
      excerpt: 'thin',
      notes: '',
    }),
  ]);
  assert.equal(result.passes, false);
  assert.equal(result.reason, 'insufficient_support');
});

test('two credible sources must have distinct normalized owner keys', () => {
  const independent = assessNewsVerification([
    evidence({ ownerKey: 'league-wire' }),
    evidence({ ownerKey: 'local-beat' }),
  ]);
  assert.equal(independent.passes, true);
  assert.equal(independent.reason, 'independent_credible_support');

  const sameOwner = assessNewsVerification([
    evidence({ ownerKey: ' Associated-Press ' }),
    evidence({ ownerKey: 'associated-press' }),
  ]);
  assert.equal(sameOwner.passes, false);
  assert.deepEqual(sameOwner.independentCredibleOwnerKeys, ['associated-press']);
});

test('unverified and context evidence never inflate independent corroboration', () => {
  const result = assessNewsVerification([
    evidence({ ownerKey: 'credible-one' }),
    evidence({ ownerKey: 'anonymous-post', sourceTier: 'unverified', credible: true }),
    evidence({ ownerKey: 'context-file', stance: 'context', credible: true }),
  ]);
  assert.equal(result.passes, false);
  assert.equal(result.supportingCount, 2);
  assert.deepEqual(result.independentCredibleOwnerKeys, ['credible-one']);
});

test('any unresolved contradiction blocks even otherwise qualifying support', () => {
  const result = assessNewsVerification([
    evidence({ evidenceClass: 'official', sourceTier: 'official' }),
    evidence({ stance: 'contradicting', ownerKey: 'unverified-tip', sourceTier: 'unverified', credible: false }),
  ]);
  assert.equal(result.passes, false);
  assert.equal(result.reason, 'contradiction_present');
  assert.equal(result.contradictionCount, 1);
});

test('append-only superseding evidence resolves a contradiction without erasing history', () => {
  const contradiction = evidence({
    id: 'evidence-contradiction',
    stance: 'contradicting',
    ownerKey: 'first-tip',
    sourceTier: 'unverified',
    credible: false,
  });
  const resolution = evidence({
    id: 'evidence-resolution',
    stance: 'context',
    evidenceClass: 'context',
    ownerKey: 'review-desk',
    sourceTier: 'unverified',
    credible: false,
    supersedesEvidenceId: 'evidence-contradiction',
  });
  const result = assessNewsVerification([
    evidence({ evidenceClass: 'official', sourceTier: 'official' }),
    contradiction,
    resolution,
  ]);
  assert.equal(result.passes, true);
  assert.equal(result.reason, 'primary_or_official_support');
  assert.equal(result.contradictionCount, 0);
});

test('superseding a supporting item also removes it from the active threshold', () => {
  const support = evidence({ id: 'old-support', evidenceClass: 'official', sourceTier: 'official' });
  const correction = evidence({
    stance: 'context',
    evidenceClass: 'context',
    ownerKey: 'review-desk',
    sourceTier: 'unverified',
    credible: false,
    supersedesEvidenceId: 'old-support',
  });
  const result = assessNewsVerification([support, correction]);
  assert.equal(result.passes, false);
  assert.equal(result.reason, 'insufficient_support');
});
