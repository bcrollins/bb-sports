import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertProviderMayRun,
  evaluateProviderPosture,
  PROVIDER_REGISTRY,
} from '../lib/provider-registry';
import { evaluatePackageLicenses, licenseAllowed } from '../lib/license-policy';
import { auditTop100Ledger } from '../lib/top100-ledger';

const root = new URL('..', import.meta.url);

test('provider registry has unique ids and pending commercial fails closed', () => {
  const ids = PROVIDER_REGISTRY.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  const stripe = PROVIDER_REGISTRY.find((p) => p.id === 'stripe')!;
  assert.equal(evaluateProviderPosture(stripe, {}), 'not_configured');
  assert.equal(
    evaluateProviderPosture(stripe, {
      STRIPE_SECRET_KEY: 'sk',
      STRIPE_WEBHOOK_SECRET: 'wh',
    }),
    'yellow',
  );
  const blocked = assertProviderMayRun('stripe', {
    STRIPE_SECRET_KEY: 'sk',
    STRIPE_WEBHOOK_SECRET: 'wh',
  });
  assert.equal(blocked.ok, false);
  const live = PROVIDER_REGISTRY.find((p) => p.id === 'live-scores')!;
  assert.equal(live.blocksRuntimeWhenRed, true);
});

test('license policy allows MIT and rejects GPL-only unknown', () => {
  assert.equal(licenseAllowed('MIT').ok, true);
  assert.equal(licenseAllowed('GPL-3.0-only').ok, false);
  const evaled = evaluatePackageLicenses([
    { name: 'ok', license: 'MIT' },
    { name: 'bad', license: 'UNKNOWN' },
  ]);
  assert.equal(evaled.ok, false);
  assert.ok(evaled.findings.some((f) => f.name === 'bad' && !f.ok));
});

test('top-100 ledger is structurally complete (100 unique ranks + status)', () => {
  const md = readFileSync(
    new URL(
      '../docs/operations/top100/TOP100-2026-07-15-bb-sports-value-engine.md',
      import.meta.url,
    ),
    'utf8',
  );
  const audit = auditTop100Ledger(md);
  assert.equal(audit.count, 100, `expected 100 items, got ${audit.count}`);
  assert.deepEqual(audit.missingRanks, []);
  assert.deepEqual(audit.duplicateRanks, []);
  assert.deepEqual(audit.unknownStatus, []);
  assert.equal(audit.ok, true);
});

test('ops handbook, secret rotation, a11y gates, provider docs exist', () => {
  for (const rel of [
    'docs/operations/NEWSROOM-HANDBOOK.md',
    'docs/operations/SECRET-ROTATION.md',
    'docs/operations/A11Y-GATES.md',
  ]) {
    assert.ok(existsSync(join(root.pathname, rel)), rel);
  }
  const handbook = readFileSync(
    new URL('../docs/operations/NEWSROOM-HANDBOOK.md', import.meta.url),
    'utf8',
  );
  assert.match(handbook, /never auto-publishes|Never auto-publish/i);
  assert.match(handbook, /ROLLBACK/);
  assert.match(handbook, /receipt/i);
});

test('a11y route inventory: primary public surfaces have main landmarks', () => {
  const paths = [
    'app/(site)/layout.tsx',
    'app/(site)/page.tsx',
    'app/(site)/articles/page.tsx',
    'app/(site)/search/page.tsx',
    'app/(site)/rankings/page.tsx',
    'app/(site)/contact/page.tsx',
    'app/(site)/support/page.tsx',
    'app/(site)/status/page.tsx',
    'app/(site)/privacy/page.tsx',
  ];
  const layout = readFileSync(new URL('../app/(site)/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /Skip to main content/);
  assert.match(layout, /id="main"/);
  for (const rel of paths) {
    const src = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
    assert.ok(src.length > 50, rel);
  }
});
