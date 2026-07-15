import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { manualNewsSignalInputSchema } from '../lib/newsroom-validation';
import { assessNewsVerification } from '../lib/newsroom-verification';

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
  // Pure verification assessment — one tier_2 reporter is not enough to pass floors.
  const assessment = assessNewsVerification([
    {
      stance: 'supporting',
      label: 'Single reporter claim',
      evidenceClass: 'reporting',
      sourceTier: 'tier_2',
      credible: true,
      ownerKey: 'reporter-a',
    },
  ] as never);
  assert.equal(assessment.passes, false);
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
