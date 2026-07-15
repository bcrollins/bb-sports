import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dismissNewsEventInputSchema,
  manualNewsSignalInputSchema,
  newsEvidenceInputSchema,
  updateNewsEventInputSchema,
  verifyNewsEventInputSchema,
} from '../lib/newsroom-validation';

const EVENT_ID = '0f20e4aa-90f6-4eab-af33-dcc04b2989d7';
const EVIDENCE_ID = '336c238c-0c83-4f51-9e3d-a09603599e26';

test('manual signal validation trims text, applies safe defaults, and coerces dates', () => {
  const value = manualNewsSignalInputSchema.parse({
    headline: '  Team announces a major roster move  ',
    canonicalUrl: 'https://example.com/report',
    sourcePublishedAt: '2026-07-15T12:00:00.000Z',
  });
  assert.equal(value.headline, 'Team announces a major roster move');
  assert.equal(value.summary, '');
  assert.equal(value.sport, 'General');
  assert.equal(value.urgency, 'routine');
  assert.equal(value.sourcePublishedAt?.toISOString(), '2026-07-15T12:00:00.000Z');
});

test('manual signal validation rejects insecure source URLs and thin headlines', () => {
  assert.equal(
    manualNewsSignalInputSchema.safeParse({ headline: 'Major roster move', canonicalUrl: 'http://example.com' })
      .success,
    false,
  );
  assert.equal(manualNewsSignalInputSchema.safeParse({ headline: 'No' }).success, false);
});

test('evidence requires provenance and enforces source classification integrity', () => {
  const valid = newsEvidenceInputSchema.parse({
    eventId: EVENT_ID,
    supersedesEvidenceId: EVIDENCE_ID,
    stance: 'supporting',
    evidenceClass: 'official',
    ownerKey: '  NFL-COMMS ',
    sourceTier: 'official',
    credible: true,
    label: 'Official league transaction wire',
    url: 'https://example.com/transactions/1',
  });
  assert.equal(valid.ownerKey, 'nfl-comms');
  assert.equal(valid.supersedesEvidenceId, EVIDENCE_ID);

  assert.equal(
    newsEvidenceInputSchema.safeParse({
      eventId: EVENT_ID,
      stance: 'supporting',
      evidenceClass: 'official',
      ownerKey: 'league',
      sourceTier: 'tier_1',
      credible: true,
      label: 'Mismatched official evidence',
      excerpt: 'Source text',
    }).success,
    false,
  );
  assert.equal(
    newsEvidenceInputSchema.safeParse({
      eventId: EVENT_ID,
      stance: 'supporting',
      evidenceClass: 'reporting',
      ownerKey: 'unknown',
      sourceTier: 'unverified',
      credible: true,
      label: 'Unverified post',
      excerpt: 'Source text',
    }).success,
    false,
  );
});

test('evidence rejects empty provenance payloads and non-HTTPS links', () => {
  const base = {
    eventId: EVENT_ID,
    stance: 'context',
    evidenceClass: 'context',
    ownerKey: 'desk-notes',
    sourceTier: 'unverified',
    credible: false,
    label: 'Desk note',
  } as const;
  assert.equal(newsEvidenceInputSchema.safeParse(base).success, false);
  assert.equal(newsEvidenceInputSchema.safeParse({ ...base, url: 'http://example.com/note' }).success, false);
  assert.equal(newsEvidenceInputSchema.safeParse({ ...base, notes: 'brief' }).success, false);
  assert.equal(
    newsEvidenceInputSchema.safeParse({ ...base, notes: 'Phone interview notes recorded by the newsroom.' }).success,
    true,
  );
});

test('verification and dismissal require explicit, meaningful rationales', () => {
  assert.equal(
    verifyNewsEventInputSchema.safeParse({ eventId: EVENT_ID, expectedVersion: 2, rationale: 'Too short' })
      .success,
    false,
  );
  assert.equal(
    verifyNewsEventInputSchema.safeParse({
      eventId: EVENT_ID,
      expectedVersion: 2,
      rationale: 'Official transaction log confirms every material claim.',
    }).success,
    true,
  );
  assert.equal(
    dismissNewsEventInputSchema.safeParse({
      eventId: EVENT_ID,
      expectedVersion: 2,
      rationale: 'Duplicate report',
    }).success,
    true,
  );
});

test('general event updates cannot bypass the evidence-gated verified state', () => {
  assert.equal(updateNewsEventInputSchema.safeParse({ eventId: EVENT_ID, expectedVersion: 1 }).success, false);
  assert.equal(
    updateNewsEventInputSchema.safeParse({
      eventId: EVENT_ID,
      expectedVersion: 1,
      targetState: 'verified',
    }).success,
    false,
  );
  assert.equal(
    updateNewsEventInputSchema.safeParse({
      eventId: EVENT_ID,
      expectedVersion: 1,
      targetState: 'verification_ready',
    }).success,
    true,
  );
});
