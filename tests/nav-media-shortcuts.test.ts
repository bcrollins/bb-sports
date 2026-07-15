import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_NAV,
  isNavActive,
  parseNavPreference,
  resolveNavItems,
} from '../lib/nav';
import {
  isSafeShortcutHref,
  parseShortcutIds,
  resolveShortcuts,
  SHORTCUTS_MAX,
} from '../lib/reader-shortcuts';
import { getPodcastStatus, getVideoStatus } from '../lib/media-status';

test('nav preference cannot hide core destinations', () => {
  const pref = parseNavPreference({
    order: ['/support', '/articles', '/podcast'],
    hidden: ['/articles', '/search', '/podcast', '/videos'],
  });
  assert.ok(!pref.hidden.includes('/articles'));
  assert.ok(!pref.hidden.includes('/search'));
  assert.ok(pref.hidden.includes('/podcast'));
  const items = resolveNavItems(pref);
  assert.ok(items.some((i) => i.href === '/articles'));
  assert.ok(items.some((i) => i.href === '/search'));
  assert.ok(!items.some((i) => i.href === '/podcast'));
  assert.equal(items[0]?.href, '/support');
});

test('nav active state is section-aware', () => {
  assert.equal(isNavActive('/articles/foo', '/articles'), true);
  assert.equal(isNavActive('/article', '/articles'), false);
  assert.equal(isNavActive('/rankings', '/rankings'), true);
});

test('default nav marks podcast/videos as soon and includes reading list', () => {
  const pod = DEFAULT_NAV.find((n) => n.href === '/podcast');
  const vid = DEFAULT_NAV.find((n) => n.href === '/videos');
  assert.equal(pod?.status, 'soon');
  assert.equal(vid?.status, 'soon');
  assert.ok(DEFAULT_NAV.some((n) => n.href === '/reading-list'));
});

test('shortcuts allowlist rejects external and unsafe hrefs', () => {
  assert.equal(isSafeShortcutHref('/articles'), true);
  assert.equal(isSafeShortcutHref('https://evil.com'), false);
  assert.equal(isSafeShortcutHref('//evil.com'), false);
  assert.equal(isSafeShortcutHref('javascript:alert(1)'), false);
  assert.equal(isSafeShortcutHref('/not-in-catalog'), false);
  assert.equal(parseShortcutIds(['articles', 'articles', 'nope']).length, 1);
  assert.ok(resolveShortcuts(['articles', 'rankings']).length <= SHORTCUTS_MAX);
});

test('media status fails closed without launch flags', () => {
  const pod = getPodcastStatus({});
  const vid = getVideoStatus({});
  assert.equal(pod.state, 'not_launched');
  assert.equal(pod.hasPlayableContent, false);
  assert.equal(vid.state, 'not_launched');
  assert.equal(vid.hasPlayableContent, false);
  assert.equal(getPodcastStatus({ BBSPORTS_PODCAST_LIVE: 'true' }).hasPlayableContent, true);
});

test('podcast and videos pages are honest (no fake players/clips)', () => {
  const pod = readFileSync(new URL('../app/(site)/podcast/page.tsx', import.meta.url), 'utf8');
  const vid = readFileSync(new URL('../app/(site)/videos/page.tsx', import.meta.url), 'utf8');
  assert.match(pod, /getPodcastStatus|Coming soon|not live/i);
  assert.match(pod, /No player|no episode/i);
  assert.doesNotMatch(pod, /<audio|<video|PLACEHOLDER/);
  assert.match(vid, /getVideoStatus|No clips published/i);
  assert.doesNotMatch(vid, /PLACEHOLDER_CLIPS/);
  assert.doesNotMatch(vid, /<video/);
});

test('header uses PrimaryNav; homepage mounts QuickAccessRail', () => {
  const header = readFileSync(new URL('../components/SiteHeader.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../app/(site)/page.tsx', import.meta.url), 'utf8');
  const primary = readFileSync(new URL('../components/PrimaryNav.tsx', import.meta.url), 'utf8');
  assert.match(header, /PrimaryNav/);
  assert.match(header, /Sign in to the newsroom/);
  assert.match(page, /QuickAccessRail/);
  assert.match(primary, /aria-current/);
  assert.match(primary, /Customize nav|Reset navigation/);
  assert.match(primary, /localStorage|NAV_STORAGE_KEY/);
});
