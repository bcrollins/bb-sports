import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FACT_CHECK_CHECKLIST,
  factCheckRequiredIds,
  isFactCheckComplete,
} from '../lib/fact-check-checklist';

test('fact-check checklist has required floors and complete helper', () => {
  assert.ok(FACT_CHECK_CHECKLIST.length >= 6);
  const required = factCheckRequiredIds();
  assert.ok(required.includes('source_url'));
  assert.ok(required.includes('numbers_fresh'));
  assert.equal(isFactCheckComplete([]), false);
  assert.equal(isFactCheckComplete(required), true);
  assert.equal(isFactCheckComplete([...required, 'rankings_directive']), true);
});

test('findings admin surfaces the checklist without auto-rewrite language', () => {
  const page = readFileSync(new URL('../app/admin/findings/page.tsx', import.meta.url), 'utf8');
  const component = readFileSync(
    new URL('../components/FactCheckChecklist.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /FactCheckChecklist/);
  assert.match(component, /Advisory only/);
  assert.doesNotMatch(component, /auto-?publish|rewrite live/i);
});
