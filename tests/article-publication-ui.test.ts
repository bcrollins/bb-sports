import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const EDITOR_PATH = 'app/admin/articles/_components/ArticleEditor.tsx';
const ROW_ACTIONS_PATH = 'app/admin/articles/_components/ArticleRowActions.tsx';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function section(contents: string, startMarker: string, endMarker: string): string {
  const start = contents.indexOf(startMarker);
  const end = contents.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return contents.slice(start, end);
}

test('normal article editing is an explicit draft-only payload with no publication field', () => {
  const editor = source(EDITOR_PATH);
  const formContract = section(editor, 'export interface ArticleFormValues', 'type PublicationRevision');
  const saveContract = section(editor, 'function savePayload', 'function fingerprint');
  const submitContract = section(editor, 'async function onSubmit', 'async function prepareRevision');

  assert.doesNotMatch(formContract, /\bpublished\b/);
  assert.doesNotMatch(saveContract, /\bpublished\b/);
  assert.doesNotMatch(submitContract, /publishOverride|willPublish|\bpublished\b/);
  assert.match(submitContract, /method:\s*mode === 'new' \? 'POST' : 'PUT'/);
  assert.match(editor, /Saving never publishes/);
  assert.doesNotMatch(editor, /Publish now|Published \(live on|field\(['"]published['"]/);

  for (const field of [
    'slug',
    'title',
    'dek',
    'body',
    'sport',
    'hero',
    'heroAlt',
    'heroCredit',
    'authorName',
    'aiAssisted',
    'bradsTake',
  ]) {
    assert.match(saveContract, new RegExp(`${field}: values\\.${field}`));
  }
});

test('publication approval binds the exact server revision and hash to Brad confirmation', () => {
  const editor = source(EDITOR_PATH);
  const publishContract = section(editor, 'async function publishRevision', 'async function unpublishArticle');

  assert.match(
    editor,
    /BRAD APPROVES THIS EXACT ARTICLE FOR PUBLICATION/,
    'client must require the canonical confirmation phrase',
  );
  assert.doesNotMatch(
    editor,
    /from ['"]@\/lib\/article-publication['"]|from ['"]\.\.\/.*article-publication['"]/,
    'client component must not import the node:crypto publication module',
  );
  assert.match(editor, /\/api\/admin\/articles\/\$\{v\.id\}\/revision/);
  assert.match(editor, /method:\s*'POST'/);
  assert.match(publishContract, /\/api\/admin\/articles\/\$\{v\.id\}\/publish/);
  assert.match(publishContract, /articleId:\s*v\.id/);
  assert.match(publishContract, /expectedRevisionId:\s*preparedRevision\.id/);
  assert.match(publishContract, /expectedContentHash:\s*preparedRevision\.contentHash/);
  assert.match(publishContract, /confirmation,/);
  assert.match(publishContract, /rationale:\s*approvalRationale\.trim\(\)/);
  assert.match(
    editor,
    /preparedRevision\.contentHash === publicationStatus\.draftHash/,
    'prepared approval must match the current server draft hash',
  );
});

test('any local edit or save invalidates the prepared revision', () => {
  const editor = source(EDITOR_PATH);
  const fieldContract = section(editor, 'function field<', 'async function onSubmit');
  const submitContract = section(editor, 'async function onSubmit', 'async function prepareRevision');

  assert.match(fieldContract, /setPreparedRevision\(null\)/);
  assert.match(fieldContract, /setConfirmation\(['"]['"]\)/);
  assert.match(submitContract, /setPreparedRevision\(null\)/);
  assert.match(editor, /hasUnsavedChanges/);
  assert.match(editor, /Save the draft before preparing its exact approval revision/);
  assert.match(editor, /No revision is prepared in this review session/);
});

test('publish and unpublish controls fail closed to the exact super-admin role', () => {
  const editor = source(EDITOR_PATH);
  const editPage = source('app/admin/articles/[id]/edit/page.tsx');
  const newPage = source('app/admin/articles/new/page.tsx');
  const unpublishContract = section(editor, 'async function unpublishArticle', 'const needsPublicationApproval');

  assert.match(editor, /const isSuperAdmin = userRole === 'super_admin'/);
  assert.match(editor, /if \(!v\.id \|\| !isSuperAdmin\) return/);
  assert.match(unpublishContract, /!v\.id \|\| !isSuperAdmin \|\| !publicationStatus\?\.published/);
  assert.match(unpublishContract, /method:\s*'DELETE'/);
  assert.match(unpublishContract, /window\.confirm\(/);
  assert.match(unpublishContract, /unpublishRationale\.trim\(\)\.length < MIN_RATIONALE_LENGTH/);
  assert.match(editPage, /const user = await requireAdminPage/);
  assert.match(editPage, /userRole=\{user\.role\}/);
  assert.match(newPage, /const user = await requireAdminPage/);
  assert.match(newPage, /userRole=\{user\.role\}/);
});

test('article roster exposes live snapshots without a direct publish toggle', () => {
  const rowActions = source(ROW_ACTIONS_PATH);
  const articleIndex = source('app/admin/articles/page.tsx');

  assert.doesNotMatch(
    rowActions,
    /method:\s*'PUT'|\btoggle\s*\(|>\s*Publish\s*<|>\s*Unpublish\s*</,
  );
  assert.match(rowActions, /View live/);
  assert.match(rowActions, /method:\s*'DELETE'/);
  assert.match(rowActions, /window\.confirm\(/);
  assert.match(rowActions, /!published && canDelete \? \(/);
  assert.match(rowActions, /canDelete:\s*boolean/);
  assert.match(rowActions, /role="alert"/);
  assert.match(articleIndex, /getAllArticlesForAdmin\(\)/);
  assert.match(articleIndex, /liveArticle:\s*live/);
  assert.match(articleIndex, /canPublishArticle\(user\.role\)/);
  assert.match(articleIndex, /canDelete=\{canDelete\s*&&\s*canDeleteVirginDraft\}/);
  assert.match(articleIndex, /canDeleteVirginDraft/);
  assert.match(articleIndex, /live\?\.title \?\?/);
  assert.match(articleIndex, /Unpublished draft changes/);
  assert.match(articleIndex, /live\?\.slug \?\? null/);
  assert.match(articleIndex, /liveSlug=/);
});

test('publication workflow exposes accessible async, error, and touch states', () => {
  const editor = source(EDITOR_PATH);
  const rowActions = source(ROW_ACTIONS_PATH);

  assert.match(editor, /aria-live="polite"/);
  assert.match(editor, /aria-busy=/);
  assert.match(editor, /role="status"/);
  assert.match(editor, /role="alert"/);
  assert.match(editor, /statusOffline/);
  assert.match(editor, /label htmlFor=\{id\}/);
  assert.match(editor, /min-h-11/);
  assert.match(editor, /motion-reduce:animate-none/);
  assert.match(rowActions, /min-h-11/);
});

test('editor states the durable managed-media publication requirement precisely', () => {
  const editor = source(EDITOR_PATH);
  assert.match(
    editor,
    /Publication requires an approved \/api\/media\/assets\/\{uuid\}\/file path from the BB Sports media library\./,
  );
  assert.doesNotMatch(editor, /Optional\. Full URL or \/api\/media asset path\./);
});
