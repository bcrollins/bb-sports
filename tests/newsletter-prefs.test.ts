import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  NEWSLETTER_FREQUENCIES,
  NEWSLETTER_TOPIC_KEYS,
  newsletterSignupSchema,
} from '../lib/intake-validation';

test('newsletter preferences validate frequency and topics', () => {
  assert.ok(NEWSLETTER_FREQUENCIES.includes('when_i_publish'));
  assert.ok(NEWSLETTER_TOPIC_KEYS.includes('nfl'));
  const ok = newsletterSignupSchema.parse({
    email: 'fan@example.com',
    frequency: 'major_only',
    topics: ['nba', 'nhl'],
  });
  assert.equal(ok.frequency, 'major_only');
  assert.deepEqual(ok.topics, ['nba', 'nhl']);
});

test('newsletter signup UI and schema store prefs', () => {
  const ui = readFileSync(new URL('../components/NewsletterSignup.tsx', import.meta.url), 'utf8');
  const schema = readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('../lib/db/bootstrap.ts', import.meta.url), 'utf8');
  const queries = readFileSync(new URL('../lib/queries.ts', import.meta.url), 'utf8');
  assert.match(ui, /frequency/);
  assert.match(ui, /topics/);
  assert.match(schema, /frequency:/);
  assert.match(schema, /topics:/);
  assert.match(bootstrap, /frequency varchar/);
  assert.match(queries, /frequency,/);
});
