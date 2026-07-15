import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function handlerSource(relativePath: string, method: string): string {
  const contents = source(relativePath);
  const marker = `export async function ${method}`;
  const start = contents.indexOf(marker);
  assert.notEqual(start, -1, `${relativePath} must export ${method}`);
  const next = contents.indexOf('export async function ', start + marker.length);
  return contents.slice(start, next === -1 ? undefined : next);
}

test('every live-desk route enforces active database auth before protected work', () => {
  const contracts = [
    ['app/api/admin/news-desk/route.ts', 'GET', /getNewsroomSnapshot\s*\(/],
    ['app/api/admin/news-desk/signals/route.ts', 'POST', /readJson\s*\(/],
    ['app/api/admin/news-desk/events/[id]/route.ts', 'GET', /getNewsEventSnapshot\s*\(/],
    ['app/api/admin/news-desk/events/[id]/route.ts', 'PATCH', /readJson\s*\(/],
    ['app/api/admin/news-desk/events/[id]/evidence/route.ts', 'POST', /readJson\s*\(/],
    ['app/api/admin/news-desk/events/[id]/verify/route.ts', 'POST', /readJson\s*\(/],
    ['app/api/admin/news-desk/events/[id]/dismiss/route.ts', 'POST', /readJson\s*\(/],
    ['app/api/admin/news-desk/stream/route.ts', 'GET', /listNewsroomActivity\s*\(/],
  ] as const;

  for (const [file, method, sensitive] of contracts) {
    const handler = handlerSource(file, method);
    const authAt = handler.search(/getCurrentUser\s*\(/);
    const denialAt = handler.search(/Unauthorized/);
    const sensitiveAt = handler.search(sensitive);
    assert.notEqual(authAt, -1, `${method} ${file} must call getCurrentUser`);
    assert.notEqual(denialAt, -1, `${method} ${file} must reject unauthorized callers`);
    assert.notEqual(sensitiveAt, -1, `${method} ${file} sensitive contract is stale`);
    assert.ok(authAt < sensitiveAt, `${method} ${file} must authenticate first`);
    assert.ok(denialAt < sensitiveAt, `${method} ${file} must deny before protected work`);
  }
});

test('the live-desk page guards before its first server query', () => {
  const page = source('app/admin/news-desk/page.tsx');
  const guardAt = page.search(/requireAdminPage\s*\(/);
  const queryAt = page.search(/getNewsroomSnapshot\s*\(/);
  assert.notEqual(guardAt, -1);
  assert.notEqual(queryAt, -1);
  assert.ok(guardAt < queryAt);
});

test('newsroom SSE is replayable, bounded, abort-aware, and proxy-safe', () => {
  const stream = source('app/api/admin/news-desk/stream/route.ts');
  assert.match(stream, /last-event-id/i);
  assert.match(stream, /after/);
  assert.match(stream, /text\/event-stream/i);
  assert.match(stream, /no-transform/i);
  assert.match(stream, /X-Accel-Buffering/);
  assert.match(stream, /MAX_CONNECTION_MS/);
  assert.match(stream, /req\.signal\.aborted/);
  assert.match(stream, /clearInterval/);
  assert.match(stream, /listNewsroomActivity/);
});

test('foundation UI cannot publish or invoke AI', () => {
  const ui = source('app/admin/news-desk/_components/NewsDesk.tsx');
  assert.doesNotMatch(ui, /\/api\/admin\/articles/);
  assert.doesNotMatch(ui, /\bpublish(?:ed|ing)?\b/i);
  assert.doesNotMatch(ui, /\b(?:grok|xai|openai)\b/i);
});

test('live desk exposes truthful fallback, accessible review, and append-only correction controls', () => {
  const page = source('app/admin/news-desk/page.tsx');
  const ui = source('app/admin/news-desk/_components/NewsDesk.tsx');
  assert.match(page, /BBSPORTS_REALTIME_NEWSROOM_ENABLED/);
  assert.match(page, /automationEnabled/);
  assert.match(ui, /new EventSource/);
  assert.match(ui, /5_000/);
  assert.match(ui, /Activity stream off/);
  assert.match(ui, /aria-modal="true"/);
  assert.match(ui, /event\.key !== 'Tab'/);
  assert.match(ui, /previousFocusRef/);
  assert.match(ui, /supersedesEvidenceId/);
  assert.match(ui, /Decision history/);
  assert.match(ui, /Notification\.requestPermission/);
  assert.match(ui, /const breakingEvents = next\.events\.filter/);
  assert.match(ui, /notifiedRef\.current\.has\(event\.id\)/);
  assert.match(ui, /five-second polling fallback/);
});

test('desk transport health never masquerades as external source monitoring', () => {
  const desk = source('app/admin/news-desk/_components/NewsDesk.tsx');
  assert.match(desk, /Desk live/);
  assert.match(desk, /Activity stream connected/);
  assert.match(desk, /Sources: Manual only/);
  assert.match(desk, /external X, Bluesky, and RSS monitoring is not active/);
  assert.doesNotMatch(desk, /label: 'Live', detail: 'Stream connected'/);
});
