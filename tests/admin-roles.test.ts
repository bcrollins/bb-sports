import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertCapability, roleHasCapability } from '../lib/admin-roles';

test('role capability matrix enforces least privilege', () => {
  assert.equal(roleHasCapability('super_admin', 'publish'), true);
  assert.equal(roleHasCapability('admin', 'publish'), false);
  assert.equal(roleHasCapability('editor', 'publish'), false);
  assert.equal(roleHasCapability('editor', 'write_drafts'), true);
  assert.equal(roleHasCapability('editor', 'manage_access_wall'), false);
  assert.equal(roleHasCapability('admin', 'moderate_comments'), true);
  assert.equal(roleHasCapability('viewer', 'write_drafts'), false);
  assert.equal(assertCapability('editor', 'manage_site_config').ok, false);
  assert.equal(assertCapability('super_admin', 'publish').ok, true);
});

test('sensitive admin routes assert capabilities', () => {
  const comments = readFileSync(
    new URL('../app/api/admin/comments/[id]/route.ts', import.meta.url),
    'utf8',
  );
  const wall = readFileSync(new URL('../app/api/admin/access-wall/route.ts', import.meta.url), 'utf8');
  const site = readFileSync(new URL('../app/api/admin/site/route.ts', import.meta.url), 'utf8');
  const cite = readFileSync(
    new URL('../app/api/admin/citations/probe/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(comments, /moderate_comments/);
  assert.match(wall, /manage_access_wall/);
  assert.match(site, /manage_site_config/);
  assert.match(cite, /probe_citations/);
});
