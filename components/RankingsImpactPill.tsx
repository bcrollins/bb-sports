import type { Article } from '@/lib/articles';
import { readTrashedTeams, LEAGUE_LABELS, type RankingLeague } from '@/lib/rankings';

type Props = {
  article: Article;
  className?: string;
};

/**
 * Renders a small mono pill describing the rankings impact of an
 * article — "▼ Moved MLB ranking" / "▼ Moved NBA · NFL rankings".
 *
 * Returns null when the article has no demotion directives, so it can
 * be dropped into any list without a wrapper guard.
 *
 * Used on /articles, the homepage Latest grid, and anywhere else
 * ArticleCard surfaces a column. One renderer keeps the format
 * consistent everywhere a reader scans the archive.
 */
export default function RankingsImpactPill({ article, className }: Props) {
  const trashed = readTrashedTeams(article);
  if (trashed.length === 0) return null;
  const labels = Array.from(
    new Set(
      trashed.map((t) =>
        LEAGUE_LABELS[t.league as RankingLeague] ?? t.league.toUpperCase(),
      ),
    ),
  );
  return (
    <p
      className={[
        'inline-flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-breaking',
        className ?? '',
      ].join(' ')}
    >
      <span aria-hidden="true">▼</span>
      Moved {labels.join(' · ')} ranking{trashed.length === 1 ? '' : 's'}
    </p>
  );
}
