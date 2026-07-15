import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('news desk mounts watchlist preview', () => {
  const desk = readFileSync(
    new URL('../app/admin/news-desk/_components/NewsDesk.tsx', import.meta.url),
    'utf8',
  );
  assert.match(desk, /NewsroomWatchlistPreview/);
  assert.match(desk, /sourceAuthorized:\s*true/);
});

test('commercial canary runbook exists and package script wires dry canaries', () => {
  assert.ok(
    existsSync(
      new URL('../docs/operations/COMMERCIAL-CANARIES.md', import.meta.url),
    ),
  );
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { scripts: Record<string, string> };
  assert.match(pkg.scripts['canaries:dry'] ?? '', /run-provider-canaries/);
  const doc = readFileSync(
    new URL('../docs/operations/COMMERCIAL-CANARIES.md', import.meta.url),
    'utf8',
  );
  assert.match(doc, /#34|#37|#45|Resend|Stripe|R2/);
  assert.match(doc, /Kill switches/i);
});
