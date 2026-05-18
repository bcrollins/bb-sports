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

  // 4 league pages + 100 franchise pages. Team lastModified reflects
  // the most-recent demotion on that specific team if it has one (so a
  // team just trashed in a column shows fresh to Google); otherwise
  // falls back to the most-recent article in that league.
  const leagueRoutes: MetadataRoute.Sitemap = [];
  const teamRoutes: MetadataRoute.Sitemap = [];

  for (const league of LEAGUE_ORDER) {
    const ranking = buildLeagueRanking(league, articles);
    const leagueLatestArticle = articles
      .filter((a) => a.sport === league)
      .reduce<Date | null>((latest, a) => {
        const d = new Date(a.date);
        return !latest || d > latest ? d : latest;
      }, null);
    const leagueLatestDemotion = ranking.ranked
      .flatMap((t) => t.demotions.map((d) => new Date(d.date)))
      .reduce<Date | null>((latest, d) => (!latest || d > latest ? d : latest), null);

    leagueRoutes.push({
      url: `${baseUrl}/rankings/${league}`,
      lastModified: leagueLatestDemotion ?? leagueLatestArticle ?? new Date(),
      changeFrequency: 'weekly',
      priority: 0.75,
    });

    for (const team of ranking.ranked) {
      const teamLatestDemotion = team.demotions[0]?.date
        ? new Date(team.demotions[0]!.date)
        : null;
      const lastModified = teamLatestDemotion ?? leagueLatestArticle ?? new Date();
      teamRoutes.push({
        url: `${baseUrl}/rankings/${league}/${team.id}`,
        lastModified,
        changeFrequency: 'weekly',
        priority: teamLatestDemotion ? 0.7 : 0.6,
      });
    }
  }

  return [...staticRoutes, ...articleRoutes, ...leagueRoutes, ...teamRoutes];
}
