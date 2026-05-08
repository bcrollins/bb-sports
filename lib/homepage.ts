import type { Article, SportSlug } from './articles';
import { sportLabel } from './articles';

export const SPORT_DESK_ORDER: SportSlug[] = [
  'nfl',
  'nhl',
  'college-football',
  'soccer',
  'nba',
  'mma',
];

export const HOME_PRIMARY_ACTIONS = [
  { label: 'Latest', href: '#latest', external: false },
  { label: 'Search', href: '/articles', external: false },
  { label: 'Support', href: '/support', external: false },
  { label: 'Tips', href: '/contact', external: false },
  { label: 'X', href: 'https://x.com/bbsports', external: true },
] as const;

export type SportHub = {
  sport: SportSlug;
  label: string;
  href: string;
  count: number;
  lead: Article | null;
  latest: Article[];
};

export type WatchBoardItem = {
  sport: SportSlug;
  label: string;
  href: string;
  status: 'Covered' | 'Open';
  detail: string;
  freshnessLabel: string;
};

export type HomepageDesk = {
  lead: Article | null;
  topStories: Article[];
  latest: Article[];
  sportHubs: SportHub[];
  watchBoard: WatchBoardItem[];
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

export function buildHomepageDesk(
  articles: Article[],
  env: Record<string, string | undefined> = process.env,
): HomepageDesk {
  const sorted = [...articles].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const [lead, ...rest] = sorted;
  const sportHubs = SPORT_DESK_ORDER.map((sport) => {
    const sportArticles = sorted.filter((article) => article.sport === sport);
    return {
      sport,
      label: sportLabel(sport),
      href: `/articles?sport=${sport}`,
      count: sportArticles.length,
      lead: sportArticles[0] ?? null,
      latest: sportArticles.slice(1, 3),
    };
  });

  return {
    lead: lead ?? null,
    topStories: rest.slice(0, 4),
    latest: rest.slice(4, 10),
    sportHubs,
    watchBoard: buildWatchBoard(sportHubs),
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

function buildWatchBoard(hubs: SportHub[]): WatchBoardItem[] {
  return hubs.map((hub) => ({
    sport: hub.sport,
    label: hub.label,
    href: hub.href,
    status: hub.lead ? 'Covered' : 'Open',
    detail: hub.lead?.title ?? `${hub.label} desk is open for Brad's next take.`,
    freshnessLabel: hub.lead ? 'Latest BB take' : 'No published take yet',
  }));
}
