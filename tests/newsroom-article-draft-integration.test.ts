import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('verified-event draft endpoint authenticates before params and bounded strict JSON', () => {
  const route = source('app/api/admin/news-desk/events/[id]/draft/route.ts');
  const handler = route.slice(route.indexOf('export async function POST'));
  const authAt = handler.indexOf('getCurrentUser()');
  const rejectAt = handler.indexOf("'Unauthorized'");
  const paramsAt = handler.indexOf('await params');
  const bodyAt = handler.indexOf('readBoundedJson(request, 1_024)');
  const createAt = handler.indexOf('createVerifiedEventArticleDraft(');

  assert.ok(authAt >= 0 && rejectAt > authAt);
  assert.ok(paramsAt > rejectAt && bodyAt > paramsAt && createAt > bodyAt);
  assert.match(route, /z\.object\(\{\}\)\.strict\(\)/);
  assert.match(route, /PublicationError/);
  assert.match(route, /Cache-Control': 'private, no-store'/);
});

test('verified-event endpoint returns a minimal draft pointer and has no publish capability', () => {
  const route = source('app/api/admin/news-desk/events/[id]/draft/route.ts');
  assert.match(route, /articleId: result\.article\.id/);
  assert.match(route, /revisionId: result\.revision\.id/);
  assert.match(route, /contentHash: result\.revision\.contentHash/);
  assert.doesNotMatch(route, /publishArticleRevision|published:\s*true|confirmation/);
});

test('Live Desk exposes draft creation only for verified events and opens the editor', () => {
  const desk = source('app/admin/news-desk/_components/NewsDesk.tsx');
  const createStart = desk.indexOf('async function createArticleDraft');
  const notificationStart = desk.indexOf('async function requestNotifications', createStart);
  const create = desk.slice(createStart, notificationStart);

  assert.ok(createStart >= 0 && notificationStart > createStart);
  assert.match(create, /detail\.event\.state !== 'verified'/);
  assert.match(create, /\/api\/admin\/news-desk\/events\/\$\{detail\.event\.id\}\/draft/);
  assert.match(create, /method: 'POST'/);
  assert.match(create, /body: '\{\}'/);
  assert.match(create, /window\.location\.assign\(`\/admin\/articles\/\$\{encodeURIComponent\(result\.articleId\)\}\/edit`\)/);
  assert.match(desk, /detail\.event\.state === 'verified'/);
  assert.match(desk, /Create article draft/);
  assert.match(desk, /Creates a cited working draft only/);
  assert.match(desk, /separate approval gate/);
});

test('verified event draft query is idempotent, race-safe, and never publishes', () => {
  const queries = source('lib/article-publication-queries.ts');
  const start = queries.indexOf('export async function createVerifiedEventArticleDraft');
  const create = queries.slice(start);

  assert.ok(start >= 0);
  assert.match(create, /SELECT id FROM news_events WHERE id = \$\{eventId\} FOR UPDATE/);
  assert.match(create, /return \{ \.\.\.existing, created: false \}/);
  assert.match(create, /slug: deterministicEventSlug\(snapshot\.slug, event\.id\)/);
  assert.match(create, /\.onConflictDoNothing\(\{ target: articles\.slug \}\)/);
  assert.match(create, /createdUnderApprovalGate: true/);
  assert.match(create, /published: false/);
  assert.match(create, /return \{ article, revision, link, created: true \}/);
  assert.doesNotMatch(create, /published: true|publishArticleRevision/);
});
