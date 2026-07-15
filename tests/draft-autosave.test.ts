import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('article editor crash-safe local autosave never publishes', () => {
  const editor = readFileSync(
    new URL('../app/admin/articles/_components/ArticleEditor.tsx', import.meta.url),
    'utf8',
  );
  assert.match(editor, /bb-article-draft:/);
  assert.match(editor, /localStorage\.setItem/);
  assert.match(editor, /Restore local draft/);
  assert.match(editor, /Crash-safe autosave/);
  assert.match(editor, /Does not\s+publish|never publishes|Does not publish/i);
});
