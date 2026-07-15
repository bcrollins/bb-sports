'use client';

import { useEffect, useState } from 'react';
import type { SportSlug } from '@/lib/sports';
import {
  FAVORITE_SPORT_OPTIONS,
  loadFavoriteSports,
  saveFavoriteSports,
} from '@/lib/reader-favorites';

export default function FavoriteSports({
  onChange,
}: {
  onChange?: (sports: SportSlug[]) => void;
}) {
  const [favorites, setFavorites] = useState<SportSlug[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = loadFavoriteSports();
    setFavorites(next);
    onChange?.(next);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: SportSlug) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      saveFavoriteSports(next);
      onChange?.(next);
      return next;
    });
  }

  if (!ready) {
    return (
      <div className="rounded border border-navy/10 bg-white p-4 text-sm text-navy/50" aria-hidden>
        Favorite sports
      </div>
    );
  }

  return (
    <section
      className="rounded border border-navy/15 bg-white p-4"
      aria-labelledby="favorite-sports-heading"
    >
      <h2 id="favorite-sports-heading" className="font-serif text-xl font-bold text-navy-900">
        Your sports
      </h2>
      <p className="mt-1 text-sm text-charcoal/75">
        Local only — no account. The main latest feed stays chronological for everyone.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {FAVORITE_SPORT_OPTIONS.map((opt) => {
          const on = favorites.includes(opt.id);
          return (
            <li key={opt.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(opt.id)}
                className={`inline-flex min-h-[44px] items-center rounded border px-3 text-[11px] font-black uppercase tracking-[0.14em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-breaking ${
                  on
                    ? 'border-navy bg-navy text-bone'
                    : 'border-navy/20 bg-bone-50 text-navy hover:border-navy/40'
                }`}
              >
                {on ? '★ ' : '☆ '}
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>
      {favorites.length > 0 ? (
        <button
          type="button"
          className="mt-3 inline-flex min-h-[44px] text-xs font-bold uppercase tracking-[0.16em] text-breaking underline-offset-4 hover:underline"
          onClick={() => {
            setFavorites([]);
            saveFavoriteSports([]);
            onChange?.([]);
          }}
        >
          Clear favorites
        </button>
      ) : null}
    </section>
  );
}
