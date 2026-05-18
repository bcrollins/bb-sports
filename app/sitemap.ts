import type { MetadataRoute } from 'next';
import { getAllArticles } from '@/lib/articles';
import { LEAGUE_ORDER, buildLeagueRanking } from '@/lib/rankings';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans';
  const articles = await getAllArticles();

  // /coming-soon is the soft-launch gate — not a public destination, omitted
  // from the sitemap. /admin is already disallowed in robots.txt.
  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/articles',
    '/rankings',
    '/search',
    '/podcast',
    '/videos',
    '/about',
    '/support',
    '/support/terms',
    '/contact',
    '/editorial-standards',
    '/corrections',
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: path === '' ? 1.0 : 0.7
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${baseUrl}/articles/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: 'weekly',
    priority: 0.8
  }));

  // 100 franchise pages — every team in every league. lastModified
  // reflects the most-recent demotion on that specific team if it has
  // one (so a team that was just trashed in a column shows fresh to
  // Google); otherwise falls back to the most-recent article in that
  // league so the page still has a meaningful freshness signal.
  const teamRoutes: MetadataRoute.Sitemap = LEAGUE_ORDER.flatMap((league) => {
    const ranking = buildLeagueRanking(league, articles);
    const leagueLatestArticle = articles
      .filter((a) => a.sport === league)
      .reduce<Date | null>((latest, a) => {
        const d = new Date(a.date);
        return !latest || d > latest ? d : latest;
      }, null);
    return ranking.ranked.map((team) => {
      const teamLatestDemotion = team.demotions[0]?.date
        ? new Date(team.demotions[0]!.date)
        : null;
      const lastModified = teamLatestDemotion ?? leagueLatestArticle ?? new Date();
      return {
        url: `${baseUrl}/rankings/${league}/${team.id}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: teamLatestDemotion ? 0.7 : 0.6,
      };
    });
  });

  return [...staticRoutes, ...articleRoutes, ...teamRoutes];
}
