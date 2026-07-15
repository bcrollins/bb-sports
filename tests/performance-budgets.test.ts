import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CWV_BUDGETS,
  ROUTE_PAYLOAD_BUDGETS,
  budgetsSatisfied,
  checkNumericBudget,
} from '../lib/performance-budgets';

test('CWV budgets match soft-launch mobile floors', () => {
  assert.equal(CWV_BUDGETS.lcpMs, 2500);
  assert.equal(CWV_BUDGETS.inpMs, 200);
  assert.equal(CWV_BUDGETS.cls, 0.1);
  assert.ok(ROUTE_PAYLOAD_BUDGETS.homepageJsKb <= 250);
});

test('budget helpers flag oversize samples', () => {
  assert.equal(checkNumericBudget('lcp', 2000, 2500), null);
  const bad = checkNumericBudget('lcp', 3000, 2500);
  assert.ok(bad);
  assert.equal(bad?.actual, 3000);
  assert.equal(
    budgetsSatisfied([
      { metric: 'lcp', actual: 2400, budget: 2500 },
      { metric: 'cls', actual: 0.05, budget: 0.1 },
    ]),
    true,
  );
  assert.equal(
    budgetsSatisfied([{ metric: 'lcp', actual: 3000, budget: 2500 }]),
    false,
  );
});

test('next config avoids third-party script CDNs (perf + CSP)', () => {
  const cfg = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
  assert.match(cfg, /Content-Security-Policy/);
  assert.doesNotMatch(cfg, /googletagmanager|facebook\.net|hotjar/i);
  assert.match(cfg, /output:\s*'standalone'/);
});
