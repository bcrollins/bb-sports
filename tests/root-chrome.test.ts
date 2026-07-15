import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('root layout leaves public chrome to the site route group', async () => {
  const [rootLayout, siteLayout, adminLayout, adminLogin] = await Promise.all([
    readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/(site)/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/login/page.tsx', import.meta.url), 'utf8'),
  ]);

  for (const publicChromeImport of ['SiteHeader', 'SiteFooter', 'BreakingNewsBar', 'AnalyticsTracker']) {
    assert.equal(rootLayout.includes(publicChromeImport), false);
    assert.equal(siteLayout.includes(publicChromeImport), true);
  }
  assert.match(rootLayout, /<body>\{children\}<\/body>/);
  assert.match(siteLayout, /<main id="main">/);
  assert.match(adminLayout, /<main id="main"/);
  assert.match(adminLogin, /<main id="main"/);
});

test('public pages live in the site route group without changing URLs', async () => {
  const publicPages = [
    '../app/(site)/page.tsx',
    '../app/(site)/about/page.tsx',
    '../app/(site)/articles/page.tsx',
    '../app/(site)/articles/[slug]/page.tsx',
    '../app/(site)/contact/page.tsx',
    '../app/(site)/search/page.tsx',
    '../app/(site)/support/page.tsx',
  ];

  await Promise.all(publicPages.map((page) => access(new URL(page, import.meta.url))));
  await assert.rejects(() => access(new URL('../app/page.tsx', import.meta.url)));
});

test('access wall is isolated from public chrome and keyboard focus order', async () => {
  const [wallPage, wallForm] = await Promise.all([
    readFile(new URL('../app/coming-soon/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/coming-soon/GateForm.tsx', import.meta.url), 'utf8'),
  ]);

  await assert.rejects(() => access(new URL('../app/(site)/coming-soon/page.tsx', import.meta.url)));
  assert.match(wallPage, /<GateForm/);
  assert.match(wallForm, /aria-label="BB Sports access wall"/);
  for (const publicChromeImport of ['SiteHeader', 'SiteFooter', 'BreakingNewsBar', 'AnalyticsTracker']) {
    assert.equal(wallPage.includes(publicChromeImport), false);
    assert.equal(wallForm.includes(publicChromeImport), false);
  }
});
