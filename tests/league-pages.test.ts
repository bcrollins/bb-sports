/**
 * Tests for /rankings/[league] — one page per major league.
 *
 * generateStaticParams() is the source of truth for which league
 * pages prerender. A regression silently shrinks the set; lock the
 * contract here.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateStaticParams,
  generateMetadata,
} from '../app/(site)/rankings/[league]/page';
import { LEAGUE_ORDER, LEAGUE_LABELS } from '../lib/rankings';

test('generateStaticParams emits one entry per major league in canonical order', async () => {
  const params = await generateStaticParams();
  assert.deepEqual(
    params.map((p) => p.league),
    LEAGUE_ORDER,
  );
});

test('generateMetadata sets canonical + JSON alternate for each league', async () => {
  for (const league of LEAGUE_ORDER) {
    const params = Promise.resolve({ league });
    const meta = await generateMetadata({ params });
    assert.ok(meta.title, `${league} has a title`);
    assert.ok(
      typeof meta.title === 'string' && meta.title.includes(LEAGUE_LABELS[league]),
      `${league} title mentions league label`,
    );
    assert.ok(meta.description, `${league} has a description`);
    assert.equal(meta.alternates?.canonical, `/rankings/${league}`);
    const types = meta.alternates?.types ?? {};
    assert.equal(
      (types as Record<string, string>)['application/json'],
      `/api/rankings?league=${league}`,
      `${league} exposes JSON alternate`,
    );
  }
});

test('generateMetadata returns empty for unknown leagues so the page can notFound()', async () => {
  const params = Promise.resolve({ league: 'cricket' });
  const meta = await generateMetadata({ params });
  assert.deepEqual(meta, {});
});
