/**
 * /admin/rankings — internal preview of the franchise rankings state.
 *
 * Brad-facing dashboard that shows:
 *   1. Every league's current top-25 with movement annotations.
 *   2. Every demotion that any published article has applied, with the
 *      slug + drop value so Brad can audit "is this what I meant?" before
 *      a column ships.
 *   3. A copy-pasteable directive template + link to the spec.
 */
import Link from 'next/link';
import { getAllArticles, sportLabel, type Article } from '@/lib/articles';
import {
  buildAllRankings,
  type LeagueRanking,
  type RankedFranchise,
  readTrashedTeams,
  type TrashedTeam,
} from '@/lib/rankings';

export const metadata = {
  title: 'Rankings · Newsroom',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type DirectiveTrace = {
  article: Article;
  entries: TrashedTeam[];
};

export default async function AdminRankingsPage() {
  const articles = await getAllArticles();
  const rankings = buildAllRankings(articles);

  const directiveLog: DirectiveTrace[] = articles
    .map((article) => ({ article, entries: readTrashedTeams(article) }))
    .filter((trace) => trace.entries.length > 0)
    .sort((a, b) => +new Date(b.article.date) - +new Date(a.article.date));

  const totalDirectives = directiveLog.reduce((sum, t) => sum + t.entries.length, 0);
  const totalMovements = rankings.reduce((sum, r) => sum + r.movements.length, 0);

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-navy/55">
          Franchise rankings
        </p>
        <h1 className="mt-1 font-display text-3xl italic text-navy">
          Top-25 control room
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-navy/75">
          Live state of the public{' '}
          <Link href="/rankings" className="underline decoration-breaking underline-offset-4 hover:text-breaking">
            /rankings
          </Link>{' '}
          page. Baseline order is defined in <code className="rounded bg-bone-50 px-1.5 py-0.5 text-[11px]">lib/rankings.ts</code>.
          Movement is driven by <code className="rounded bg-bone-50 px-1.5 py-0.5 text-[11px]">{`<!-- bb:trash ... -->`}</code>{' '}
          directives in article bodies — every directive published anywhere shows up below.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <StatPill label="Demotion directives" value={totalDirectives} />
          <StatPill label="Teams currently moved" value={totalMovements} />
          <StatPill label="Articles with directives" value={directiveLog.length} />
        </div>
      </header>

      <section className="rounded-lg border border-navy/10 bg-white p-5">
        <h2 className="font-display text-xl italic text-navy">Directive log</h2>
        <p className="mt-1 text-sm text-navy/70">
          Every published article that touches the rankings, newest first. Click an
          article to open it; the demotion engine treats the newest column as the
          surface reason on the league page.
        </p>
        {directiveLog.length === 0 ? (
          <p className="mt-4 rounded border border-dashed border-navy/15 bg-bone-50 p-4 text-sm text-navy/70">
            No published article currently contains a{' '}
            <code className="rounded bg-white px-1.5 py-0.5 text-[11px]">{`<!-- bb:trash ... -->`}</code>{' '}
            directive. The rankings page shows the baseline order until you publish one.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-navy/10">
            {directiveLog.map((trace) => (
              <li key={trace.article.slug} className="py-3">
                <Link
                  href={`/articles/${trace.article.slug}`}
                  className="font-serif font-bold text-navy hover:text-breaking"
                >
                  {trace.article.title}
                </Link>
                <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-navy/55">
                  {sportLabel(trace.article.sport)} ·{' '}
                  {new Date(trace.article.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <ul className="mt-2 grid gap-1 text-sm text-navy/85 sm:grid-cols-2">
                  {trace.entries.map((entry, idx) => (
                    <li key={`${entry.league}-${entry.team}-${idx}`} className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-breaking">
                        {entry.league.toUpperCase()}
                      </span>
                      <span className="font-semibold">{entry.team}</span>
                      <span className="text-xs text-navy/55">
                        drops {entry.drop ?? 3}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {rankings.map((ranking) => (
          <LeagueCard key={ranking.league} ranking={ranking} />
        ))}
      </div>

      <section className="rounded-lg border border-navy/10 bg-white p-5">
        <h2 className="font-display text-xl italic text-navy">Directive cheat-sheet</h2>
        <p className="mt-1 text-sm text-navy/70">
          Paste this into an article body anywhere you want the rankings to move.
          One directive per team. Drop defaults to 3, clamped to [1, 10]. League
          must be one of <code className="rounded bg-bone-50 px-1.5 py-0.5 text-[11px]">nfl</code>,{' '}
          <code className="rounded bg-bone-50 px-1.5 py-0.5 text-[11px]">mlb</code>,{' '}
          <code className="rounded bg-bone-50 px-1.5 py-0.5 text-[11px]">nhl</code>,{' '}
          <code className="rounded bg-bone-50 px-1.5 py-0.5 text-[11px]">nba</code>. Team
          ids are listed inline on every league card above.
        </p>
        <pre className="mt-4 overflow-x-auto rounded border border-navy/15 bg-navy p-3 text-[12px] leading-relaxed text-bone">
{`<!-- bb:trash league=nba team=lakers drop=6 reason="The roster around LeBron is a YMCA pickup squad." -->`}
        </pre>
        <p className="mt-3 text-xs text-navy/55">
          Spec lives in <code className="rounded bg-bone-50 px-1.5 py-0.5 text-[11px]">docs/RANKINGS-DEMOTION-DIRECTIVE.md</code>.
        </p>
      </section>
    </div>
  );
}

function LeagueCard({ ranking }: { ranking: LeagueRanking }) {
  return (
    <section className="rounded-lg border border-navy/10 bg-white">
      <header className="flex items-baseline justify-between border-b border-navy/10 px-4 py-3">
        <h2 className="font-display text-xl italic text-navy">{ranking.label}</h2>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-navy/55">
          {ranking.movements.length} moved
        </span>
      </header>
      <ol className="divide-y divide-navy/5 text-sm">
        {ranking.ranked.map((team) => (
          <TeamRow key={team.id} team={team} />
        ))}
      </ol>
    </section>
  );
}

function TeamRow({ team }: { team: RankedFranchise }) {
  const moved = team.currentRank - team.baseRank;
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
      <span className="font-display text-lg italic font-black text-navy/85">{team.currentRank}</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-navy">
          {team.city} {team.name}
        </span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.18em] text-navy/45">
          id: {team.id}
        </span>
      </span>
      {moved !== 0 ? (
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
            moved > 0 ? 'bg-breaking/10 text-breaking' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {moved > 0 ? '▼' : '▲'} {Math.abs(moved)} · was #{team.baseRank}
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
    </li>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-bone-50 px-3 py-1">
      <span className="font-mono font-bold text-navy">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-navy/55">
        {label}
      </span>
    </span>
  );
}
