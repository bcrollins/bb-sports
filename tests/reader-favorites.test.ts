import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FAVORITES_STORAGE_KEY,
  FAVORITE_SPORT_OPTIONS,
  parseFavoriteSports,
} from '../lib/reader-favorites';

test('parseFavoriteSports validates and dedupes sports', () => {
  assert.deepEqual(parseFavoriteSports(['nfl', 'nfl', 'bogus', 'mlb']), ['nfl', 'mlb']);
  assert.deepEqual(parseFavoriteSports(null), []);
  assert.deepEqual(parseFavoriteSports('nfl'), []);
  assert.deepEqual(parseFavoriteSports([1, 'nba', 'nba']), ['nba']);
});

test('favorite sport options cover major desk sports', () => {
  const ids = FAVORITE_SPORT_OPTIONS.map((o) => o.id);
  for (const id of ['nfl', 'mlb', 'nhl', 'nba', 'college-football', 'soccer', 'mma'] as const) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  assert.equal(FAVORITES_STORAGE_KEY, 'bb_favorite_sports_v1');
});

test('homepage favorites rail is local-first and after latest feed', () => {
  const page = readFileSync(new URL('../app/(site)/page.tsx', import.meta.url), 'utf8');
  const rail = readFileSync(
    new URL('../components/FavoriteArticlesRail.tsx', import.meta.url),
    'utf8',
  );
  const picker = readFileSync(
    new URL('../components/FavoriteSports.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /FavoriteArticlesRail/);
  // Rail must come after the #latest section, not replace it.
  const latestIdx = page.indexOf('id="latest"');
  const railIdx = page.indexOf('<FavoriteArticlesRail');
  assert.ok(latestIdx >= 0 && railIdx > latestIdx, 'favorites rail after latest feed');
  assert.match(rail, /FavoriteSports/);
  assert.match(rail, /Latest feed above|chronological/i);
  assert.match(rail, /Local only|no account/i);
  assert.match(picker, /localStorage|loadFavoriteSports|saveFavoriteSports/);
  assert.match(picker, /Local only|no account/i);
  assert.match(picker, /aria-pressed/);
  assert.match(picker, /Clear favorites/);
});
