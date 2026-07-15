import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  evaluatePublishSourceGate,
  hasInlineHttpsCitation,
  looksFactHeavy,
} from '../lib/article-source-gate';
import { evaluateProductionEnv, productionEnvPublicDto } from '../lib/production-env';
import { SEED_EDITORIAL_FINDINGS } from '../lib/editorial-findings';

test('source gate requires citations for fact-heavy bodies unless opinion-only', () => {
  const heavy =
    'The team went 14-3 with a 68% third-down rate according to the league. That is historic.';
  assert.equal(looksFactHeavy(heavy), true);
  assert.equal(hasInlineHttpsCitation(heavy), false);
  const blocked = evaluatePublishSourceGate({ body: heavy, rationale: 'Looks good to ship today.' });
  assert.equal(blocked.ok, false);

  const linked = evaluatePublishSourceGate({
    body: `${heavy} See [league report](https://www.nfl.com/stats).`,
    rationale: 'Sourced.',
  });
  assert.equal(linked.ok, true);
  if (linked.ok) assert.equal(linked.mode, 'linked');

  const opinion = evaluatePublishSourceGate({
    body: heavy,
    rationale: 'opinion-only pure take from the couch.',
  });
  assert.equal(opinion.ok, true);
  if (opinion.ok) assert.equal(opinion.mode, 'opinion_only');

  const light = evaluatePublishSourceGate({
    body: 'I think the Bears are fun this year. That is all.',
    rationale: 'Ship it.',
  });
  assert.equal(light.ok, true);
});

test('production env posture never serializes secret values', () => {
  const posture = evaluateProductionEnv({
    NODE_ENV: 'production',
    RAILWAY_ENVIRONMENT: 'production',
    DATABASE_URL: 'postgres://x',
    JWT_SECRET: 'secret',
    GATE_COOKIE_SECRET: 'cookie',
    GATE_PASSWORD: 'pass',
    NEXT_PUBLIC_SITE_URL: 'https://bbsports.fans',
  });
  assert.equal(posture.ok, true);
  const dto = productionEnvPublicDto({
    NODE_ENV: 'production',
    JWT_SECRET: 'super-secret-value',
  });
  assert.ok(dto.missing.includes('DATABASE_URL'));
  assert.doesNotMatch(JSON.stringify(dto), /super-secret-value/);
});

test('publish path and ready health integrate gates; findings seed present', () => {
  const publish = readFileSync(
    new URL('../lib/article-publication-queries.ts', import.meta.url),
    'utf8',
  );
  assert.match(publish, /evaluatePublishSourceGate/);
  const ready = readFileSync(new URL('../app/api/health/ready/route.ts', import.meta.url), 'utf8');
  assert.match(ready, /productionEnvPublicDto/);
  assert.ok(SEED_EDITORIAL_FINDINGS.some((f) => f.articleSlug.includes('cowboys')));
  const bootstrap = readFileSync(new URL('../lib/db/bootstrap.ts', import.meta.url), 'utf8');
  assert.match(bootstrap, /editorial_findings/);
  const audience = readFileSync(new URL('../app/admin/audience/page.tsx', import.meta.url), 'utf8');
  assert.match(audience, /Confidential tip redacted/);
});
