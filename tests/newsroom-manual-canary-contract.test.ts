import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { manualNewsSignalInputSchema } from '../lib/newsroom-validation';
import { assessNewsVerification, type VerificationEvidence } from '../lib/newsroom-verification';

function evidence(partial: Partial<VerificationEvidence> = {}): VerificationEvidence {
  return {
    stance: 'supporting',
    evidenceClass: 'reporting',
    ownerKey: 'reporter-a',
    sourceTier: 'tier_2',
    credible: true,
    sourceId: null,
    signalId: null,
    url: null,
    excerpt: '',
    notes: '',
    ...partial,
  };
}

test('manual lead schema accepts a desk canary fixture and rejects junk', () => {
  const ok = manualNewsSignalInputSchema.safeParse({
    headline: 'Canary: Bears practice injury report filed',
    summary: 'Manual desk canary — not for public publish without Brad approval.',
    canonicalUrl: 'https://bbsports.fans/status',
    sport: 'NFL',
    urgency: 'watch',
  });
  assert.equal(ok.success, true);

  const bad = manualNewsSignalInputSchema.safeParse({
    headline: 'x',
    summary: '',
    sport: 'NFL',
  });
  assert.equal(bad.success, false);
});

test('single uncorroborated lead cannot satisfy verification readiness alone', () => {
  // One tier_2 reporter without primary/official and without a second owner fails floors.
  const assessment = assessNewsVerification([
    evidence({
      url: 'https://example.com/single-reporter',
      sourceTier: 'tier_2',
      evidenceClass: 'reporting',
      ownerKey: 'reporter-a',
      credible: true,
    }),
  ]);
  assert.equal(assessment.passes, false);
  assert.equal(assessment.reason, 'insufficient_support');
});

test('worker entry serves health without enabling provider transport by default', () => {
  const worker = readFileSync(new URL('../worker/newsroom-worker.ts', import.meta.url), 'utf8');
  assert.match(worker, /BBSPORTS_NEWSROOM_WORKER_ENABLED/);
  assert.match(worker, /health/);
  assert.match(worker, /does not open provider|connectionAllowed|idle/i);
});

test('manual signal route is auth-gated and uses createManualNewsSignal', () => {
  const route = readFileSync(
    new URL('../app/api/admin/news-desk/signals/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(route, /getCurrentUser/);
  assert.match(route, /createManualNewsSignal/);
  assert.match(route, /manualNewsSignalInputSchema/);
});
