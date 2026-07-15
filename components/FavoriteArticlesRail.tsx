'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { SportSlug } from '@/lib/sports';
import { sportLabel } from '@/lib/sports';
import FavoriteSports from '@/components/FavoriteSports';

/** Slim article props for the client rail — never ship full body HTML. */
export type FavoriteRailArticle = {
  slug: string;
  title: string;
  sport: SportSlug;
};

/**
 * Optional rail after the universal latest feed — never replaces chronology.
 * Favorites are local-only (no account, no server PII).
 */
export default function FavoriteArticlesRail({
  articles,
}: {
  articles: FavoriteRailArticle[];
}) {
  const [favorites, setFavorites] = useState<SportSlug[]>([]);

  const filtered = useMemo(() => {
    if (favorites.length === 0) return [];
    return articles.filter((a) => favorites.includes(a.sport)).slice(0, 6);
  }, [articles, favorites]);

  return (
    <section
      className="border-t border-navy/15 bg-bone-50 px-4 py-10 sm:px-6"
      aria-labelledby="favorites-rail-heading"
    >
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p className="bb-eyebrow !text-breaking">Optional for you</p>
          <h2
            id="favorites-rail-heading"
            className="mt-2 font-display text-3xl italic uppercase text-navy-900"
          >
            From your sports
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-charcoal/75">
            This rail is a convenience layer. The Latest feed above is still the full chronological
            desk. Local only — no account.
          </p>
          {favorites.length === 0 ? (
            <p className="mt-6 text-sm text-navy/60">
              Star sports on the right to populate this rail.
            </p>
          ) : filtered.length === 0 ? (
            <p className="mt-6 text-sm text-navy/60">
              No published takes in {favorites.map((s) => sportLabel(s)).join(', ')} yet.
            </p>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {filtered.map((a) => (
                <li key={a.slug} className="rounded border border-navy/10 bg-white p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-navy/45">
                    {sportLabel(a.sport)}
                  </p>
                  <Link
                    href={`/articles/${a.slug}`}
                    className="mt-1 block font-serif text-lg font-bold text-navy-900 hover:text-breaking"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FavoriteSports onChange={setFavorites} />
      </div>
    </section>
  );
}
