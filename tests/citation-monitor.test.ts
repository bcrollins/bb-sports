import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractCitationLinks, assertPublicHttpsUrl } from '../lib/citation-monitor';

test('extractCitationLinks finds markdown and bare https only', () => {
  const body = `
See [report](https://www.example.com/a) and https://www.example.com/b
Ignore http://insecure.example and [x](javascript:alert(1))
`;
  const links = extractCitationLinks(body);
  assert.equal(links.length, 2);
  assert.equal(links[0]?.kind, 'markdown');
  assert.equal(links[1]?.kind, 'bare');
});

test('assertPublicHttpsUrl rejects non-https and localhost', async () => {
  await assert.rejects(() => assertPublicHttpsUrl('http://example.com'), /https/i);
  await assert.rejects(() => assertPublicHttpsUrl('https://localhost/x'), /Private|local/i);
});

test('admin citation probe route authenticates first', () => {
  const route = readFileSync(
    new URL('../app/api/admin/citations/probe/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(route, /getCurrentUser/);
  assert.match(route, /extractCitationLinks/);
  assert.match(route, /probeCitationUrl/);
  const post = route.slice(route.indexOf('export async function POST'));
  assert.ok(post.indexOf('getCurrentUser') < post.indexOf('req.json'));
});
