import Link from 'next/link';
import { Search } from 'lucide-react';
import { AnalyticsEventBeacon } from '@/components/AnalyticsTracker';
import ArticleCard from '@/components/ArticleCard';
import { getAllArticles, sportLabel, type SportSlug } from '@/lib/articles';
import { normalizeSearchQuery, searchArticles, SEARCH_MIN_QUERY_LENGTH } from '@/lib/search';

export const metadata = {
  title: 'Search',
  description: 'Search BB Sports articles by team, sport, topic, and Brad Benson take.',
};

export const dynamic = 'force-dynamic';

const SPORTS: { value: SportSlug | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'nfl', label: 'NFL' },
  { value: 'nhl', label: 'NHL' },
  { value: 'college-football', label: 'College' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'nba', label: 'NBA' },
  { value: 'mma', label: 'MMA' },
];

type Props = { searchParams: Promise<{ q?: string; sport?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const sport = normalizeSport(params.sport);
  const articles = await getAllArticles();
  const results = query.length >= SEARCH_MIN_QUERY_LENGTH
    ? searchArticles(articles, query, sport).slice(0, 24)
    : [];

  return (
    <main className="min-h-[70vh] bg-bone">
      {query.length >= SEARCH_MIN_QUERY_LENGTH ? (
        <AnalyticsEventBeacon
          eventName="search_performed"
          path="/search"
          source="search-page"
          properties={{
            query_length: query.length,
            result_count: results.length,
            sport,
            filtered: sport !== 'all',
          }}
        />
      ) : null}
      <section className="bg-navy-deep text-bone">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex items-center gap-3 text-breaking">
            <Search size={24} strokeWidth={2.5} aria-hidden="true" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.28em]">Search desk</span>
          </div>
          <h1
            className="mt-4 font-display uppercase italic leading-[0.92] tracking-[-0.025em] text-bone"
            style={{ fontSize: 'clamp(2.5rem, 7.5vw, 5.75rem)' }}
          >
            Find the take.
          </h1>
          <p className="mt-4 max-w-2xl text-bone/82">
            Search every published BB Sports article by team, sport, player, topic, and Brad&rsquo;s angle.
          </p>

          <form className="mt-7 grid w-full min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_180px_140px]" role="search">
            <label className="sr-only" htmlFor="site-search">Search BB Sports</label>
            <input
              id="site-search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Bears, playoff hockey, Florida, Man United..."
              className="min-h-[50px] w-full min-w-0 rounded-sm border-2 border-bone/30 bg-bone/10 px-4 py-2 text-base text-bone placeholder:text-bone/50 focus:bg-bone/20 focus:outline-none focus:ring-2 focus:ring-breaking"
            />
            <label className="sr-only" htmlFor="sport-filter">Sport</label>
            <select
              id="sport-filter"
              name="sport"
              defaultValue={sport}
              className="min-h-[50px] w-full min-w-0 rounded-sm border-2 border-bone/30 bg-navy px-4 py-2 text-base font-semibold text-bone focus:outline-none focus:ring-2 focus:ring-breaking"
            >
              {SPORTS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <button type="submit" className="bb-button-primary w-full min-w-0 !bg-breaking hover:!bg-breaking/90">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {query.length < SEARCH_MIN_QUERY_LENGTH ? (
          <EmptyState
            title="Start with two characters."
            text="Search by team, league, article title, or whatever phrase is stuck in your head."
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="No take matched that."
            text={`No published BB Sports article matched "${query}"${sport !== 'all' ? ` in ${sportLabel(sport)}` : ''}.`}
          />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-navy/15 pb-3">
              <div>
                <h2 className="font-display text-3xl italic text-navy">{results.length} result{results.length === 1 ? '' : 's'}</h2>
                <p className="mt-1 text-sm text-charcoal/70">
                  Ranked by title, dek, tags, sport, and recency.
                </p>
              </div>
              <Link href="/articles" className="bb-link text-sm">Browse archive -&gt;</Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((result) => (
                <div key={result.article.slug}>
                  <ArticleCard article={result.article} />
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-navy/50">
                    Match: {result.matchedFields.join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function normalizeSport(value: string | undefined): SportSlug | 'all' {
  const allowed = new Set(SPORTS.map((item) => item.value));
  return allowed.has(value as SportSlug | 'all') ? (value as SportSlug | 'all') : 'all';
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-sm border border-navy/15 bg-white p-8 text-center">
      <h2 className="font-serif text-2xl font-bold text-navy">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-charcoal/75">{text}</p>
    </div>
  );
}
