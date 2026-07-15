import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildCanonicalArticleUrl,
  buildFacebookShareUrl,
  buildMailtoShareUrl,
  buildSharePayload,
  buildXIntentUrl,
  CANONICAL_SITE_ORIGIN,
} from '../lib/share';
import {
  exportReadingListJson,
  parseReadingList,
  READING_LIST_STORAGE_KEY,
} from '../lib/reading-list';

test('canonical article URL strips junk and stays on apex', () => {
  assert.equal(
    buildCanonicalArticleUrl('why-the-bears-finally-have-a-real-shot'),
    `${CANONICAL_SITE_ORIGIN}/articles/why-the-bears-finally-have-a-real-shot`,
  );
  // Path junk must not become a plausible article id.
  assert.equal(buildCanonicalArticleUrl('../evil'), `${CANONICAL_SITE_ORIGIN}/articles`);
  assert.equal(buildCanonicalArticleUrl(''), `${CANONICAL_SITE_ORIGIN}/articles`);
});

test('share payload and outbound intents use canonical URL only', () => {
  const p = buildSharePayload({ title: 'Bears take', slug: 'bears-take' });
  assert.equal(p.url, `${CANONICAL_SITE_ORIGIN}/articles/bears-take`);
  assert.match(buildXIntentUrl(p), /x\.com\/intent\/tweet/);
  assert.match(buildXIntentUrl(p), /bears-take/);
  assert.match(buildFacebookShareUrl(p.url), /facebook\.com\/sharer/);
  assert.match(buildMailtoShareUrl(p), /^mailto:\?/);
});

test('reading list parse validates, dedupes, caps, sorts newest first', () => {
  const items = parseReadingList([
    { slug: 'a', title: 'A', savedAt: '2020-01-01T00:00:00.000Z' },
    { slug: 'a', title: 'A2', savedAt: '2021-01-01T00:00:00.000Z' },
    { slug: '../bad', title: 'Bad' },
    { slug: 'b', title: 'B', savedAt: '2022-01-01T00:00:00.000Z' },
    null,
    'nope',
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].slug, 'b');
  assert.equal(items[1].slug, 'a');
  assert.equal(READING_LIST_STORAGE_KEY, 'bb_reading_list_v1');
});

test('export reading list JSON is portable versioned envelope', () => {
  const json = exportReadingListJson([
    { slug: 'one', title: 'One', savedAt: '2024-01-01T00:00:00.000Z' },
  ]);
  const bag = JSON.parse(json) as { version: number; items: unknown[] };
  assert.equal(bag.version, 1);
  assert.equal(bag.items.length, 1);
});

test('article page uses ShareActions and SaveToReadingList (no bare trackers)', () => {
  const page = readFileSync(
    new URL('../app/(site)/articles/[slug]/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /ShareActions/);
  assert.match(page, /SaveToReadingList/);
  assert.doesNotMatch(page, /platform\.twitter\.com\/widgets/);
  assert.doesNotMatch(page, /connect\.facebook\.net/);
});

test('reading list route and nav entry exist', () => {
  const route = readFileSync(
    new URL('../app/(site)/reading-list/page.tsx', import.meta.url),
    'utf8',
  );
  const nav = readFileSync(new URL('../lib/nav.ts', import.meta.url), 'utf8');
  assert.match(route, /ReadingListManager/);
  assert.match(route, /Local utility|local/i);
  assert.match(nav, /\/reading-list/);
});
