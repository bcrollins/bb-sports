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
  return env.BBSPORTS_APPROVED_LIVE_SCORES === 'true';
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
  const sorted = [...articles].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const [lead, ...rest] = sorted;

  return {
    lead: lead ?? null,
    topStories: rest.slice(0, 4),
    latest: rest.slice(0, 8),
    provider: {
      liveScoresApproved: isLiveScoreProviderApproved(env),
      flag: 'BBSPORTS_APPROVED_LIVE_SCORES',
      label: isLiveScoreProviderApproved(env) ? 'Live scores approved' : 'Editorial board only',
      disclaimer: isLiveScoreProviderApproved(env)
        ? 'Commercial live-score provider approved. Surface may show provider-backed scores with freshness timestamps.'
        : 'No live scores or standings are rendered until a commercial provider is approved and documented.',
    },
  };
}
