import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import RankingsImpactPill from '@/components/RankingsImpactPill';
import { getAllArticles, sportLabel, type SportSlug } from '@/lib/articles';
import {
  ARCHIVE_SPORTS,
  archiveActiveChips,
  buildArchiveHref,
  filterArchiveArticles,
  parseArchiveFilters,
  type ArchiveSort,
} from '@/lib/archive-filters';

export const metadata = {
  title: 'Articles',
  description:
    'Every BB Sports take, organized by sport. NFL, MLB, NHL, NBA, college football, soccer, MMA — bias turned all the way up.',
};

// Revalidate every 60s as a safety net; explicit publish/unpublish operations
// invalidate this archive immediately, while unapproved draft edits stay private.
export const revalidate = 60;

const SPORT_LABELS: { value: (typeof ARCHIVE_SPORTS)[number]; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'nfl', label: 'NFL' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  { value: 'nba', label: 'NBA' },
  { value: 'college-football', label: 'College Football' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'mma', label: 'MMA' },
];

type Props = { searchParams: Promise<{ sport?: string; q?: string; sort?: string }> };

export default async function ArticlesPage({ searchParams }: Props) {
  const all = await getAllArticles();
  const params = await searchParams;
  const filters = parseArchiveFilters(params);
  const filtered = filterArchiveArticles(all, filters);
  const chips = archiveActiveChips(filters);
  const sort: ArchiveSort = filters.sort;

  return (
    <div className="bg-bone min-h-[60vh]">
      <section className="bg-navy-deep text-bone relative overflow-hidden">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">The Archive</p>
          <h1
            className="mt-3 font-display uppercase italic text-bone leading-[0.92] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(2.25rem, 7vw, 5rem)' }}
          >
            Every take.
            <br />
            Organized.
          </h1>
          <p className="mt-4 text-bone/85 max-w-2xl">
            Filter by sport. Search by keyword. Sort newest or oldest. Filters live in the URL so
            refresh, back, and shared links keep the same desk view.
          </p>

          <form className="mt-7 flex flex-col gap-3 sm:flex-row" role="search" action="/articles" method="get">
            <label className="sr-only" htmlFor="article-search">
              Search articles
            </label>
            <input
              id="article-search"
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Search takes — e.g. 'Bears', 'playoff hockey', 'Florida'…"
              className="flex-1 min-h-[48px] px-4 py-2 rounded-sm border-2 border-bone/30 bg-bone/10 text-bone placeholder:text-bone/50 focus:outline-none focus:ring-2 focus:ring-breaking focus:bg-bone/20 text-base"
            />
            {filters.sport !== 'all' ? (
              <input type="hidden" name="sport" value={filters.sport} />
            ) : null}
            {sort !== 'newest' ? <input type="hidden" name="sort" value={sort} /> : null}
            <button type="submit" className="bb-button-primary !bg-breaking hover:!bg-breaking/90 min-h-[48px]">
              Search
            </button>
          </form>

          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Filter by sport">
            {SPORT_LABELS.map((s) => (
              <li key={s.value}>
                <Link
                  href={buildArchiveHref({ sport: s.value, q: filters.q, sort })}
                  className={`inline-flex items-center min-h-[44px] px-4 py-1.5 rounded-sm text-[11px] uppercase tracking-[0.22em] font-black border-2 transition-colors ${
                    filters.sport === s.value
                      ? 'bg-breaking text-white border-breaking'
                      : 'bg-transparent text-bone border-bone/40 hover:bg-bone/10 hover:border-bone'
                  }`}
                  aria-current={filters.sport === s.value ? 'page' : undefined}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/55">Sort</span>
            <Link
              href={buildArchiveHref({ ...filters, sort: 'newest' })}
              className={`inline-flex min-h-[44px] items-center rounded-sm border px-3 text-[11px] font-black uppercase tracking-[0.18em] ${
                sort === 'newest'
                  ? 'border-breaking bg-breaking text-white'
                  : 'border-bone/40 text-bone hover:bg-bone/10'
              }`}
              aria-current={sort === 'newest' ? 'page' : undefined}
            >
              Newest
            </Link>
            <Link
              href={buildArchiveHref({ ...filters, sort: 'oldest' })}
              className={`inline-flex min-h-[44px] items-center rounded-sm border px-3 text-[11px] font-black uppercase tracking-[0.18em] ${
                sort === 'oldest'
                  ? 'border-breaking bg-breaking text-white'
                  : 'border-bone/40 text-bone hover:bg-bone/10'
              }`}
              aria-current={sort === 'oldest' ? 'page' : undefined}
            >
              Oldest
            </Link>
          </div>

          {chips.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/55">Active</span>
              {chips.map((chip) => (
                <Link
                  key={chip.key}
                  href={chip.clearHref}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-bone/40 bg-bone/10 px-3 text-sm text-bone hover:bg-bone/20"
                >
                  <span>{chip.label}</span>
                  <span aria-hidden="true" className="font-black">
                    ×
                  </span>
                  <span className="sr-only">Remove {chip.label} filter</span>
                </Link>
              ))}
              <Link
                href="/articles"
                className="inline-flex min-h-[44px] items-center px-2 text-[11px] font-black uppercase tracking-[0.18em] text-breaking underline-offset-4 hover:underline"
              >
                Clear all
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-navy/55" aria-live="polite">
          {filtered.length} take{filtered.length === 1 ? '' : 's'}
          {filters.sport !== 'all' ? ` · ${sportLabel(filters.sport as SportSlug)}` : ''}
          {filters.q ? ` · matching “${filters.q}”` : ''}
          {sort === 'oldest' ? ' · oldest first' : ' · newest first'}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white border border-navy/15 rounded p-8 text-center">
            <h2 className="font-serif text-2xl font-bold text-navy-900">No takes here yet.</h2>
            <p className="mt-2 text-charcoal/80">
              Either Brad hasn&rsquo;t covered this corner of the sports world yet — or the search came
              up empty.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/articles" className="bb-link min-h-[44px] inline-flex items-center">
                Clear filters →
              </Link>
              <Link href="/search" className="bb-link min-h-[44px] inline-flex items-center">
                Try full search →
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((a) => (
              <div key={a.slug} className="relative">
                <ArticleCard article={a} />
                <RankingsImpactPill article={a} className="mt-2" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
