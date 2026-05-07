import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import { getAllArticles, sportLabel, type SportSlug } from '@/lib/articles';

export const metadata = {
  title: 'Articles',
  description:
    'Every BB Sports take, organized by sport. NFL, NHL, college football, soccer, NBA, MMA — written like a fan, sourced like a reporter.'
};

// Revalidate every 60s so newly published articles appear without a redeploy
// and the layout's BreakingNewsBar / footer tagline reflect admin edits.
export const revalidate = 60;

const SPORTS: { value: SportSlug | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'nfl', label: 'NFL' },
  { value: 'nhl', label: 'NHL' },
  { value: 'college-football', label: 'College Football' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'nba', label: 'NBA' },
  { value: 'mma', label: 'MMA' }
];

type Props = { searchParams: Promise<{ sport?: string; q?: string }> };

export default async function ArticlesPage({ searchParams }: Props) {
  const all = await getAllArticles();
  const params = await searchParams;
  const sport = (params.sport ?? 'all') as SportSlug | 'all';
  const q = (params.q ?? '').trim().toLowerCase();

  const filtered = all.filter((a) => {
    const okSport = sport === 'all' || a.sport === sport;
    const haystack = `${a.title} ${a.dek ?? ''} ${a.tags.join(' ')} ${sportLabel(a.sport)}`.toLowerCase();
    const okQuery = q.length === 0 || haystack.includes(q);
    return okSport && okQuery;
  });

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
            Every take.<br/>Organized.
          </h1>
          <p className="mt-4 text-bone/85 max-w-2xl">
            Filter by sport. Search by keyword. New takes go up the moment Brad approves them.
          </p>

          <form className="mt-7 flex flex-col sm:flex-row gap-3" role="search">
            <label className="sr-only" htmlFor="article-search">
              Search articles
            </label>
            <input
              id="article-search"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search takes — e.g. 'Bears', 'playoff hockey', 'Florida'…"
              className="flex-1 min-h-[48px] px-4 py-2 rounded-sm border-2 border-bone/30 bg-bone/10 text-bone placeholder:text-bone/50 focus:outline-none focus:ring-2 focus:ring-breaking focus:bg-bone/20 text-base"
            />
            <input type="hidden" name="sport" value={sport} />
            <button type="submit" className="bb-button-primary !bg-breaking hover:!bg-breaking/90">
              Search
            </button>
          </form>

          <ul className="mt-6 flex flex-wrap gap-2">
            {SPORTS.map((s) => (
              <li key={s.value}>
                <Link
                  href={`/articles?sport=${s.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className={`inline-flex items-center min-h-[40px] px-4 py-1.5 rounded-sm text-[11px] uppercase tracking-[0.22em] font-black border-2 transition-colors ${
                    sport === s.value
                      ? 'bg-breaking text-white border-breaking'
                      : 'bg-transparent text-bone border-bone/40 hover:bg-bone/10 hover:border-bone'
                  }`}
                  aria-current={sport === s.value ? 'page' : undefined}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {filtered.length === 0 ? (
          <div className="bg-white border border-navy/15 rounded p-8 text-center">
            <h2 className="font-serif text-2xl font-bold text-navy-900">No takes here yet.</h2>
            <p className="mt-2 text-charcoal/80">
              Either Brad hasn’t covered this corner of the sports world yet — or the search came up empty.
            </p>
            <Link href="/articles" className="mt-4 inline-block bb-link">
              See all articles →
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
