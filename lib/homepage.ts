import type { Article } from './articles';

/**
 * Homepage primary actions.
 *
 * Front page is a chronological feed of the most recent sports news,
 * not split by sport. Sport filtering still lives on /articles for
 * archive browsing.
 */
export const HOME_PRIMARY_ACTIONS = [
  { label: 'Latest', href: '#latest', external: false },
  { label: 'Rankings', href: '/rankings', external: false },
  { label: 'Search', href: '/search', external: false },
  { label: 'Support', href: '/support', external: false },
  { label: 'Tips', href: '/contact', external: false },
  { label: 'X', href: 'https://x.com/bbsports', external: true },
] as const;

export type HomepageDesk = {
  lead: Article | null;
  topStories: Article[];
  latest: Article[];
  /** ISO date of newest published article, or null when empty. */
  lastUpdated: string | null;
  /** Slugs rendered on the page (lead + latest) — guaranteed unique. */
  renderedSlugs: string[];
  provider: {
    liveScoresApproved: boolean;
    flag: 'BBSPORTS_APPROVED_LIVE_SCORES';
    label: string;
    disclaimer: string;
  };
};

export function isLiveScoreProviderApproved(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.BBSPORTS_APPROVED_LIVE_SCORES === 'true' ||
    env.BBSPORTS_APPROVED_LIVE_SCORES_FEED === 'true'
  );
}

/**
 * Build the homepage feed. Chronological-only — no sport categorisation
 * on the front page (the directive is the front page shows the most
 * recent sports news regardless of which sport it is).
 */
export function buildHomepageDesk(
  articles: Article[],
  env: Record<string, string | undefined> = process.env,
): HomepageDesk {
  // Newest first; stable slug secondary so equal timestamps don't thrash.
  const sorted = [...articles].sort((a, b) => {
    const byDate = +new Date(b.date) - +new Date(a.date);
    if (byDate !== 0) return byDate;
    return a.slug.localeCompare(b.slug);
  });
  const [lead, ...rest] = sorted;
  // topStories: rail-sized subset; latest: broader feed excluding lead (no card dupes).
  const topStories = rest.slice(0, 4);
  const latest = rest.slice(0, 8);
  const renderedSlugs = [lead?.slug, ...latest.map((a) => a.slug)].filter(
    (s): s is string => Boolean(s),
  );
  // Invariant: unique slugs across lead + latest.
  const unique = new Set(renderedSlugs);
  if (unique.size !== renderedSlugs.length) {
    // Should be impossible after lead split; fail closed to unique list.
    const seen = new Set<string>();
    const cleanLatest = latest.filter((a) => {
      if (!lead || a.slug === lead.slug) return false;
      if (seen.has(a.slug)) return false;
      seen.add(a.slug);
      return true;
    });
    return {
      lead: lead ?? null,
      topStories,
      latest: cleanLatest,
      lastUpdated: lead?.date ?? null,
      renderedSlugs: [lead?.slug, ...cleanLatest.map((a) => a.slug)].filter(
        (s): s is string => Boolean(s),
      ),
      provider: providerPosture(env),
    };
  }

  return {
    lead: lead ?? null,
    topStories,
    latest,
    lastUpdated: lead?.date ?? null,
    renderedSlugs,
    provider: providerPosture(env),
  };
}

function providerPosture(env: Record<string, string | undefined>) {
  return {
    liveScoresApproved: isLiveScoreProviderApproved(env),
    flag: 'BBSPORTS_APPROVED_LIVE_SCORES' as const,
    label: isLiveScoreProviderApproved(env) ? 'Live scores approved' : 'Editorial board only',
    disclaimer: isLiveScoreProviderApproved(env)
      ? 'Commercial live-score provider approved. Surface may show provider-backed scores with freshness timestamps.'
      : 'No live scores or standings are rendered until a commercial provider is approved and documented.',
  };
}
